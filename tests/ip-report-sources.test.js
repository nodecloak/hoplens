// Source adapters distinguish no observation, provider denial, wrong addresses and DNSBL resolver failures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportSources, classifyDNSBLAnswer } from '../common/ip-report-sources.js';
import { createReportLoader } from '../common/ip-report.js';
const ip='157.254.32.95';
test('report deadlines release stalled sources and coalesced callers',async()=>{
  const adapters=Object.fromEntries(['network','ipapi','proxycheck','rdap','rdns','internetdb','abuseipdb','radar','dnsbl'].map(id=>[id,()=>new Promise(()=>{})]));
  const load=createReportLoader({adapters,evidence:()=>({}),timeoutMs:10});
  const [first,second]=await Promise.all([load(ip),load(ip)]);
  assert.ok(first.sources.every(row=>row.status==='timeout'));
  assert.equal(first.risk.score,null);assert.deepEqual(first.sources,second.sources);
});
test('DNSBL error and policy codes never become a clean or generic malicious result',()=>{
  assert.equal(classifyDNSBLAnswer(['127.255.255.254'],'spamhaus').status,'error');
  assert.equal(classifyDNSBLAnswer(['127.0.0.10'],'spamhaus').data.policyListed,true);
  assert.equal(classifyDNSBLAnswer(['127.0.0.10'],'spamhaus').data.listed,false);
  assert.equal(classifyDNSBLAnswer(['127.0.0.2'],'spamcop').data.listed,true);
  assert.equal(classifyDNSBLAnswer(['1.2.3.4'],'spamcop').status,'error');
});
test('passive 404 means not recorded and a wrong-IP 200 is rejected',async()=>{
  let wrong=false;
  const sources=createReportSources({fetch:async()=>wrong?Response.json({ip:'1.1.1.1',ports:[]}):new Response('',{status:404}),env:()=>({})});
  assert.equal((await sources.internetdb(ip)).status,'empty');wrong=true;
  assert.equal((await sources.internetdb(ip)).status,'error');
});
test('optional partner credentials are not sent or requested when unconfigured',async()=>{
  let called=0;
  const sources=createReportSources({fetch:async()=>{called++;throw new Error('Unexpected');},env:()=>({})});
  assert.equal((await sources.abuseipdb(ip)).status,'disabled');
  assert.equal((await sources.radar(402139)).status,'disabled');
  assert.equal(called,0);
});
test('DNSBL requires working positive and negative controls before reporting no listing',async()=>{
  let calls=0;
  const sources=createReportSources({resolve4:async()=>{calls++;throw Object.assign(new Error('NXDOMAIN'),{code:'ENOTFOUND'});},env:()=>({})});
  assert.equal((await sources.dnsbl(ip,'spamcop')).status,'error');assert.equal(calls,2);
});
test('healthy DNSBL NXDOMAIN for target is an explicit negative observation',async()=>{
  const sources=createReportSources({resolve4:async host=>{
    if(host.startsWith('2.0.0.127.')) return ['127.0.0.2'];
    throw Object.assign(new Error('NXDOMAIN'),{code:'ENOTFOUND'});
  },env:()=>({})});
  const response=await sources.dnsbl(ip,'spamcop');assert.equal(response.status,'ok');assert.equal(response.data.listed,false);
});
test('PTR absence differs from a resolver outage',async()=>{
  let code='ENODATA';const sources=createReportSources({reverse:async()=>{throw Object.assign(new Error('DNS'),{code});},env:()=>({})});
  assert.equal((await sources.rdns(ip)).data.exists,false);code='ETIMEOUT';assert.equal((await sources.rdns(ip)).status,'error');
});
test('public proxy adapter ignores provider numeric risk and treats quota responses as limited',async()=>{
  let limited=false;
  const sources=createReportSources({fetch:async url=>{
    assert.ok(String(url).startsWith('https://proxycheck.io/v3/'));
    return limited?new Response('',{status:429}):Response.json({status:'ok',[ip]:{detections:{proxy:false,hosting:false,risk:80}}});
  },env:()=>({})});
  const response=await sources.proxycheck(ip);assert.equal(response.data.risk,undefined);
  limited=true;assert.equal((await sources.proxycheck(ip)).status,'limited');
});

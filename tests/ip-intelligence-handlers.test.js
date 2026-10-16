// Public intelligence handlers use fixed providers and retain explicit partial/limited states.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import networkHandler from '../api/network-info.js';
import { createIPRiskHandler } from '../api/ip-risk.js';
import { createReportLoader } from '../common/ip-report.js';
import geoHandler from '../api/ipapi-com.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});

test('network overview retains valid routing when geolocation fails', async()=>{
  const calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));return String(url).includes('stat.ripe.net')?Response.json({data:{prefix:'9.9.9.0/24',asns:[19281]}}):new Response('',{status:503});};
  const res=response();await networkHandler({query:{ip:'9.9.9.9'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.asn,19281);
  assert.equal(res.body.status.routing,'ok');assert.equal(res.body.status.whois,'unavailable');
  assert.equal(calls.length,2);
});

test('risk assessment keeps source failures incomplete without inventing a clean score', async()=>{
  const adapters=Object.fromEntries(['network','ipapi','proxycheck','rdap','rdns','internetdb','abuseipdb','radar','dnsbl'].map(id=>[id,async()=>{throw new Error('Unavailable');}]));
  const handler=createIPRiskHandler({load:createReportLoader({evidence:()=>({}),adapters})});
  const res=response();await handler({query:{ip:'9.9.9.9'}},res);
  assert.equal(res.body.status,'partial');assert.equal(res.body.score,null);assert.equal(res.body.coverage.checked,0);
});

test('risk source observations are cached and coalesced for identical lookups', async()=>{
  let calls=0;
  const adapters=Object.fromEntries(['network','ipapi','proxycheck','rdap','rdns','internetdb','abuseipdb','radar','dnsbl'].map(id=>[id,async()=>({status:'empty'})]));
  adapters.ipapi=async()=>{calls++;return {status:'ok',data:{proxy:false,hosting:false}};};
  const handler=createIPRiskHandler({load:createReportLoader({evidence:()=>({}),adapters})});
  const res=response();await Promise.all([handler({query:{ip:'1.0.0.1'}},res),handler({query:{ip:'1.0.0.1'}},response())]);
  assert.equal(res.body.score,0);assert.equal(res.body.scoreKind,'observed');assert.equal(res.body.status,'partial');
  assert.equal(res.body.coverage.checked,2);assert.equal(calls,1);
});

test('cached classification never pins the previous local risk snapshot',async()=>{
  const asOf=new Date().toISOString();let hit=false,calls=0;
  const adapters=Object.fromEntries(['network','ipapi','proxycheck','rdap','rdns','internetdb','abuseipdb','radar'].map(id=>[id,async()=>({status:'disabled'})]));
  adapters.ipapi=async()=>{calls++;return {status:'ok',data:{proxy:false,hosting:false}};};
  adapters.internetdb=async()=>({status:'ok',data:{vulnerabilities:[]}});adapters.dnsbl=async()=>({status:'ok',data:{listed:false}});
  const handler=createIPRiskHandler({load:createReportLoader({adapters,
    evidence:()=>({drop:{status:'ok',hit,asOf},tor:{status:'ok',hit:false,asOf}}),
  })});
  const first=response();await handler({query:{ip:'8.8.8.8'}},first);assert.equal(first.body.score,0);
  hit=true;const next=response();await handler({query:{ip:'8.8.8.8'}},next);
  assert.equal(next.body.score,70);assert.equal(calls,1);
});

test('IP-API preserves only explicit classification flags and keeps unknowns absent', async()=>{
  globalThis.fetch=async()=>Response.json({query:'8.8.8.8',hosting:false,proxy:true});
  const res=response();await geoHandler({query:{ip:'8.8.8.8'}},res);
  assert.equal(res.body.isHosting,false);assert.equal(res.body.isProxy,true);assert.equal(res.body.isMobile,undefined);
});

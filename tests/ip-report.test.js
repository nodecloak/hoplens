// Full IP assessment preserves provenance, partial-source uncertainty and independent scenario rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePassiveHost, normalizeProxyObservation, normalizeRegistration, normalizeAbuseObservation, assessReportRisk, buildIPReport, reportToText } from '../common/ip-report-model.js';
import { assessPlatformRegions } from '../common/ip-report-policy.js';
import { IP_REPORT_POLICIES } from '../common/ip-report-policy-data.js';
import { ALPHA2_TO_NUMERIC } from '../frontend/data/country-numeric.js';
const ip='157.254.32.95',date='2026-10-16T07:00:00.000Z',now=Date.parse(date);
const source=(id,data,status='ok')=>({id,status,data,durationMs:12,observedAt:date});
const fixtures=()=>[
  source('drop',{hit:false,asOf:date}),source('tor',{hit:false,asOf:date}),
  source('ipapi',{ip,proxy:false,hosting:false,mobile:false,countryCode:'HK',country:'Hong Kong',city:'Central'}),
  source('internetdb',{ip,ports:[],vulnerabilities:[],hostnames:[],tags:[]}),
  source('dnsbl-spamcop',{listed:false}),source('dnsbl-psbl',{listed:false}),source('dnsbl-dronebl',{listed:false}),
  source('rdns',{names:[],exists:false}),
  source('network',{ip,asn:402139,asnName:'Peekabo Networks',prefix:'157.254.32.0/24'}),
  source('rdap',{countryCode:'US',name:'NETWORK',start:'157.254.32.0',end:'157.254.33.255'}),
  source('abuseipdb',null,'disabled'),source('dnsbl-spamhaus',null,'disabled'),
];

test('passive host observations reject the wrong IP and retain only valid bounded fields',()=>{
  assert.equal(normalizePassiveHost({ip:'1.1.1.1',ports:[443]},ip),null);
  const data=normalizePassiveHost({ip,ports:[443,22,443,-1,'80',65536],vulns:['CVE-2025-12345','bad'],hostnames:['test.example.com'],tags:['vpn']},ip);
  assert.deepEqual(data.ports,[22,443]);assert.deepEqual(data.vulnerabilities,['CVE-2025-12345']);
  assert.equal(normalizePassiveHost({ip,ports:[443]},ip).vulnerabilities,null);
  assert.equal(normalizePassiveHost({ip,ports:[443],vulns:['invalid']},ip).vulnerabilities,null);
});

test('official policies use current country codes, including supported GB/FR/BJ/BF/RS/TL',()=>{
  for(const row of Object.values(IP_REPORT_POLICIES)) for(const code of row.countries) assert.ok(Object.hasOwn(ALPHA2_TO_NUMERIC,code)||code==='XK',code);
  for(const code of ['GB','FR','BJ','BF','RS','TL']) for(const row of assessPlatformRegions(code,now)) assert.equal(row.status,'supported',code+' '+row.id);
  for(const row of assessPlatformRegions('ZZ',now)) assert.equal(row.status,'unknown');
});
test('proxy observations preserve explicit flags and scoped estimates without reusing provider scores',()=>{
  const data=normalizeProxyObservation({status:'ok',[ip]:{network:{type:'Business',range:'157.254.32.0/23'},device_estimate:{subnet:6},detections:{proxy:false,vpn:false,hosting:false,risk:99},last_updated:date}},ip);
  assert.equal(data.type,'business');assert.equal(data.subnetDevices,6);assert.equal(data.risk,undefined);
  assert.equal(data.proxy,false);assert.equal(data.hosting,false);
  assert.equal(normalizeProxyObservation({status:'ok','1.1.1.1':{}},ip),null);
});
test('homepage risk summary retains the report network type and its actual source',()=>{
  for(const type of ['business','residential','education','hosting','mobile']) {
    const report=buildIPReport(ip,[...fixtures(),source('proxycheck',{type})],now);
    assert.equal(report.profile.type,type);
    assert.equal(report.risk.usageType,type);
    assert.equal(report.risk.usageTypeSource,'proxycheck.io');
  }
  for(const [flags,type] of [[{mobile:true},'mobile'],[{hosting:true},'hosting'],[{mobile:false,hosting:false},'unknown']]) {
    const report=buildIPReport(ip,fixtures().map(row=>row.id==='ipapi'?source('ipapi',flags):row),now);
    assert.equal(report.profile.type,type);
    assert.equal(report.risk.usageType,type);
    assert.equal(report.risk.usageTypeSource,type==='unknown'?null:'IP-API');
  }
});
test('registration is accepted only when its range contains the queried IP and excludes contacts',()=>{
  assert.equal(normalizeRegistration({startAddress:'1.1.1.0',endAddress:'1.1.1.255'},ip),null);
  const result=normalizeRegistration({startAddress:'157.254.32.0',endAddress:'157.254.33.255',country:'US',name:'NET',entities:[{email:'private@example.com'}]},ip);
  assert.equal(result.countryCode,'US');assert.equal(result.entities,undefined);
});
test('abuse observations require same IP and report-count evidence rather than importing the provider score',()=>{
  assert.equal(normalizeAbuseObservation({data:{ipAddress:'1.1.1.1'}},ip),null);
  const result=normalizeAbuseObservation({data:{ipAddress:ip,totalReports:22,numDistinctUsers:6,abuseConfidenceScore:90}},ip);
  assert.equal(result.totalReports,22);assert.equal(result.providerConfidence,90);
});
test('complete observations produce a complete score and coverage',()=>{
  const result=assessReportRisk(fixtures(),now);
  assert.equal(result.score,0);assert.equal(result.model,'nodecloak-ip-risk-v2');
  assert.equal(result.coverage.checked,result.coverage.total);
  assert.equal(result.scoreKind,'complete');assert.equal(result.status,'ok');
  assert.equal(result.checks.find(row=>row.id==='abuse').status,'disabled');
});
test('missing passive records still produce an observed score with partial coverage and uncertainty',()=>{
  const sources=fixtures().map(row=>row.id==='internetdb'?source('internetdb',null,'empty'):row);
  const result=assessReportRisk(sources,now);
  assert.equal(result.score,0);assert.equal(result.scoreKind,'observed');assert.equal(result.status,'partial');
  assert.equal(result.coverage.checked,result.coverage.total-1);
  assert.deepEqual(result.range,{min:0,max:10});
  assert.equal(result.checks.find(row=>row.id==='services').hit,null);
});
test('Tor/proxy are deduplicated and DNSBL errors are not treated as clean observations',()=>{
  const sources=fixtures().map(row=>row.id==='tor'?source('tor',{hit:true,asOf:date}):row.id==='ipapi'?source('ipapi',{ip,proxy:true,hosting:true}):row.id==='dnsbl-dronebl'?source(row.id,null,'error'):row);
  const result=assessReportRisk(sources,now);
  assert.equal(result.observedPoints,40);assert.equal(result.score,40);
  assert.equal(result.scoreKind,'observed');assert.equal(result.status,'partial');
  assert.deepEqual(result.range,{min:40,max:65});
  assert.equal(result.checks.find(row=>row.id==='proxy').points,0);
});
test('geography differences and PTR absence do not lower overall risk or claim broadcast status',()=>{
  const report=buildIPReport(ip,fixtures(),now);
  assert.equal(report.profile.registrationRelation,'different');assert.equal(report.profile.nativeType,'unknown');
  assert.equal(report.risk.score,0);assert.equal(report.profile.rdns.exists,false);
  const mail=report.scenarios.find(row=>row.id==='email');
  const gaming=report.scenarios.find(row=>row.id==='gaming');
  assert.ok(mail.range.min<gaming.range.min);
});
test('disabled partner source is disclosed, but configured source failure remains unknown',()=>{
  const sources=fixtures();assert.equal(assessReportRisk(sources,now).score,0);
  sources[sources.findIndex(row=>row.id==='abuseipdb')]=source('abuseipdb',null,'limited');
  const result=assessReportRisk(sources,now);assert.equal(result.score,0);assert.equal(result.status,'partial');assert.equal(result.range.max,30);
});
test('abuse count thresholds are applied before capping totals and influence scenarios by their own weights',()=>{
  const sources=fixtures().map(row=>row.id==='drop'?source('drop',{hit:true,asOf:date}):row.id==='tor'?source('tor',{hit:true,asOf:date}):row.id==='abuseipdb'?source('abuseipdb',{totalReports:1,distinctReporters:1}):row);
  assert.equal(assessReportRisk(sources,now).score,100);
  const onlyAbuse=fixtures().map(row=>row.id==='abuseipdb'?source('abuseipdb',{totalReports:1,distinctReporters:1}):row);
  assert.equal(assessReportRisk(onlyAbuse,now).score,5);
});
test('successful source envelopes with missing booleans or report counts remain incomplete',()=>{
  const sources=fixtures().map(row=>row.id==='drop'?source('drop',{asOf:date}):row.id==='abuseipdb'?source('abuseipdb',{}):row);
  const risk=assessReportRisk(sources,now);assert.equal(risk.score,0);assert.equal(risk.status,'partial');assert.equal(risk.checks.find(row=>row.id==='abuse').status,'missing');
});

test('a positive observation from a partially available blacklist group still contributes to the score',()=>{
  const sources=fixtures().map(row=>row.status==='disabled'?row:source(row.id,null,'error'));
  sources.push(source('dnsbl-extra',{listed:true}));
  const risk=assessReportRisk(sources,now);
  assert.equal(risk.score,25);assert.equal(risk.scoreKind,'observed');assert.equal(risk.status,'partial');
  assert.equal(risk.coverage.checked,0);assert.equal(risk.checks.find(row=>row.id==='dnsbl').status,'partial');
});

test('no usable observations do not fabricate a clean zero score',()=>{
  const sources=fixtures().map(row=>row.status==='disabled'?row:source(row.id,null,'error'));
  const risk=assessReportRisk(sources,now);
  assert.equal(risk.score,null);assert.equal(risk.scoreKind,'unavailable');assert.equal(risk.status,'partial');
  assert.deepEqual(risk.coverage,{checked:0,total:6});
});

test('a partial negative blacklist observation produces a provisional score without completing the group',()=>{
  const sources=fixtures().map(row=>row.status==='disabled'?row:source(row.id,null,'error'));
  sources.push(source('dnsbl-extra',{listed:false}));
  const risk=assessReportRisk(sources,now),dns=risk.checks.find(row=>row.id==='dnsbl');
  assert.equal(risk.score,0);assert.equal(risk.scoreKind,'observed');assert.equal(risk.coverage.checked,0);
  assert.equal(dns.hit,null);assert.equal(dns.status,'partial');assert.equal(risk.range.max,100);
});

test('stale positive snapshots are unknown and do not add points to the observed score',()=>{
  const sources=fixtures().map(row=>row.id==='drop'?source('drop',{hit:true,asOf:'2026-10-10T07:00:00.000Z'}):row);
  const risk=assessReportRisk(sources,now);
  assert.equal(risk.score,0);assert.equal(risk.scoreKind,'observed');assert.equal(risk.range.max,70);
  assert.equal(risk.checks.find(row=>row.id==='drop').status,'stale');
});

test('partial scenario scores retain independent coverage and their possible fit range',()=>{
  const sources=fixtures().map(row=>row.id==='abuseipdb'?source(row.id,null,'limited'):row);
  const report=buildIPReport(ip,sources,now),social=report.scenarios.find(row=>row.id==='social');
  assert.equal(social.score,100);assert.equal(social.scoreKind,'observed');assert.equal(social.status,'partial');
  assert.deepEqual(social.range,{min:70,max:100});
  const text=reportToText(report);
  assert.ok(text.includes('Score basis: observed'));assert.ok(text.includes('Risk range: 0-30 /100'));
  assert.ok(text.includes('social: 100 /100; basis=observed; range=70-100; coverage=5/6'));
});
test('AI region policy distinguishes Gemini Hong Kong from other platforms and keeps conditions',()=>{
  const rows=assessPlatformRegions('HK',now);
  assert.equal(rows.find(row=>row.id==='gemini').status,'supported');
  assert.equal(rows.find(row=>row.id==='chatgpt').status,'not-listed');
  assert.equal(rows.find(row=>row.id==='claude').status,'not-listed');
  assert.equal(assessPlatformRegions('CN',now).find(row=>row.id==='gemini').status,'conditional');
  assert.ok(assessPlatformRegions(null,now).every(row=>row.status==='unknown'));
  assert.ok(assessPlatformRegions('US',now+31*86400000).every(row=>row.status==='stale'));
});
test('text export includes evidence, model, timestamps and source failures',()=>{
  const report=buildIPReport(ip,fixtures(),now),text=reportToText(report);
  assert.ok(text.includes(ip));assert.ok(text.includes(report.risk.model));assert.ok(text.includes('abuseipdb'));
  assert.ok(text.includes('disabled'));assert.ok(text.includes(date));
});

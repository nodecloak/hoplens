// Source normalization and first-party IP assessment assembly.
import { parseIp, cidrContains } from './ip-math.js';
import { isValidDomain } from './valid-ip.js';
import { isFreshRiskTime } from './ip-risk-score.js';
import { assessPlatformRegions } from './ip-report-policy.js';

const text=(value,max=160)=>typeof value==='string'?value.trim().slice(0,max):null;
const integer=value=>Number.isInteger(value)&&value>=0&&value<=1e9?value:null;
const code=value=>typeof value==='string'&&/^[a-z]{2}$/i.test(value)?value.toUpperCase():null;
const sameIP=(a,b)=>{const x=parseIp(a),y=parseIp(b);return !!x&&!!y&&x.family===y.family&&x.value===y.value;};
const flag=value=>typeof value==='boolean'?value:null;
const unique=(values,max=40)=>[...new Set(values)].slice(0,max);
const time=value=>Number.isFinite(Date.parse(value??''))?new Date(value).toISOString():null;

export const normalizePassiveHost=(body,ip)=>{
  if(!body||!sameIP(body.ip,ip)||!Array.isArray(body.ports)) return null;
  const labels=Array.isArray(body.vulns)?body.vulns.filter(n=>typeof n==='string'&&/^CVE-\d{4}-\d{4,10}$/.test(n)):null;
  return {ip,ports:unique(body.ports.filter(n=>Number.isInteger(n)&&n>0&&n<=65535),200).sort((a,b)=>a-b),
    vulnerabilities:labels&&(labels.length||body.vulns.length===0)?unique(labels,100):null,
    hostnames:unique((Array.isArray(body.hostnames)?body.hostnames:[]).filter(n=>isValidDomain(n)),30),
    tags:unique((Array.isArray(body.tags)?body.tags:[]).filter(n=>typeof n==='string').map(n=>text(n,50)),30)};
};
export const normalizeProxyObservation=(body,ip)=>{
  const entry=body&&Object.entries(body).find(([key])=>sameIP(key,ip))?.[1];
  if(!['ok','warning'].includes(body?.status)||!entry?.detections) return null;
  const types={business:'business',residential:'residential',mobile:'mobile',hosting:'hosting','data center':'hosting',education:'education'};
  const detections=entry.detections;
  return {ip,proxy:flag(detections.proxy),vpn:flag(detections.vpn),tor:flag(detections.tor),hosting:flag(detections.hosting),
    anonymous:flag(detections.anonymous),compromised:flag(detections.compromised),type:types[String(entry.network?.type).toLowerCase()]??'unknown',
    countryCode:code(entry.location?.country_code),country:text(entry.location?.country_name),region:text(entry.location?.region_name),city:text(entry.location?.city_name),
    subnetDevices:integer(entry.device_estimate?.subnet),subnet:typeof entry.network?.range==='string'&&cidrContains(entry.network.range,ip)?entry.network.range:null,
    providerUpdatedAt:time(entry.last_updated)};
};
export const normalizeRegistration=(body,ip)=>{
  const query=parseIp(ip),start=parseIp(body?.startAddress),end=parseIp(body?.endAddress);
  if(!query||!start||!end||query.family!==start.family||query.family!==end.family||query.value<start.value||query.value>end.value) return null;
  return {start:body.startAddress,end:body.endAddress,countryCode:code(body.country),name:text(body.name),handle:text(body.handle),type:text(body.type)};
};
export const normalizeAbuseObservation=(body,ip)=>{
  const data=body?.data;if(!data||!sameIP(data.ipAddress,ip)) return null;
  const confidence=typeof data.abuseConfidenceScore==='number'&&data.abuseConfidenceScore>=0&&data.abuseConfidenceScore<=100?data.abuseConfidenceScore:null;
  return {ip,totalReports:integer(data.totalReports),distinctReporters:integer(data.numDistinctUsers),providerConfidence:confidence,lastReportedAt:time(data.lastReportedAt)};
};

const freshSource=(source,now,maxAge=15*60*1000)=>source?.status==='ok'&&isFreshRiskTime(source.observedAt,now,maxAge);
const rule=(id,source,maxPoints,status,hit,details={})=>({id,source,maxPoints,status:status==='ok'&&typeof hit!=='boolean'?'missing':status,hit:typeof hit==='boolean'?hit:null,points:hit===true?maxPoints:0,...details});
const assessment=(checks,weights)=>{
  const rows=checks.map(row=>({...row,maxPoints:weights?.[row.id]??row.maxPoints})).filter(row=>row.maxPoints>0||row.status==='disabled');
  for(const row of rows) row.points=row.hit===true?Math.round(row.maxPoints*(row.severity??1)):0;
  const tor=rows.find(row=>row.id==='tor'),proxy=rows.find(row=>row.id==='proxy');
  if(tor?.hit===true&&proxy?.hit===true) {
    const lower=tor.maxPoints>=proxy.maxPoints?proxy:tor;lower.points=0;lower.suppressedBy=lower===proxy?'tor':'proxy';
  }
  const active=rows.filter(row=>row.status!=='disabled'),known=active.filter(row=>row.status==='ok');
  const min=Math.min(100,active.reduce((sum,row)=>sum+row.points,0));
  const potential=row=>!row||row.status==='disabled'?0:row.hit===true?row.points:row.status==='ok'?0:row.maxPoints;
  const maxAnon=Math.max(potential(tor),potential(proxy));
  const max=Math.min(100,active.filter(row=>!['tor','proxy'].includes(row.id)).reduce((sum,row)=>sum+potential(row),0)+maxAnon);
  // Partial evidence yields an observed score; unknown checks keep their potential weight.
  const usable=known.length>0||active.some(row=>row.hit===true||row.coverage?.checked>0);
  const complete=active.length>0&&known.length===active.length;
  return {score:usable?min:null,scoreKind:complete?'complete':usable?'observed':'unavailable',
    status:complete?'ok':'partial',observedPoints:min,range:{min,max},coverage:{checked:known.length,total:active.length},checks:rows};
};

export const assessReportRisk=(sources,now=Date.now())=>{
  const get=id=>sources.find(row=>row.id===id);
  const snapshot=(id,name,weight)=>{
    const source=get(id),data=source?.data;
    const status=source?.status==='ok'&&!isFreshRiskTime(data?.asOf,now)?'stale':source?.status??'missing';
    return rule(id,name,weight,status,status==='ok'?flag(data?.hit):null,{asOf:data?.asOf??null,matchedPrefix:data?.matchedPrefix??null,copyright:data?.copyright??null});
  };
  const ipapi=get('ipapi'),proxycheck=get('proxycheck');
  const flags=(field,otherFields=[])=>{
    const values=[];
    if(freshSource(ipapi,now)) values.push(ipapi.data?.[field]);
    if(freshSource(proxycheck,now)) values.push(proxycheck.data?.[field],...otherFields.map(key=>proxycheck.data?.[key]));
    const explicit=values.filter(value=>typeof value==='boolean');
    return explicit.some(Boolean)?true:explicit.length?false:null;
  };
  const proxy=flags('proxy',['vpn','tor','anonymous']),hosting=flags('hosting');
  const classificationAsOf=[ipapi,proxycheck].filter(row=>freshSource(row,now)).map(row=>row.observedAt).sort().at(-1)??null;
  const checks=[snapshot('drop','Spamhaus DROP',70),snapshot('tor','Tor Project',30),
    rule('proxy','IP-API / proxycheck.io',25,proxy===null?'missing':'ok',proxy,{asOf:classificationAsOf}),
    rule('hosting','IP-API / proxycheck.io',10,hosting===null?'missing':'ok',hosting,{asOf:classificationAsOf})];
  const dns=sources.filter(row=>row.id.startsWith('dnsbl-')&&row.status!=='disabled');
  const dnsKnown=dns.filter(row=>freshSource(row,now)&&typeof row.data?.listed==='boolean');
  const dnsHit=dnsKnown.some(row=>row.data.listed);
  checks.push(rule('dnsbl','DNSBL',25,dns.length&&dnsKnown.length===dns.length?'ok':'partial',dnsHit?true:dnsKnown.length===dns.length&&dns.length?false:null,{asOf:dnsKnown[0]?.observedAt??null,coverage:{checked:dnsKnown.length,total:dns.length}}));
  const host=get('internetdb'),hostKnown=freshSource(host,now,2*3600000)&&Array.isArray(host.data?.vulnerabilities);
  checks.push(rule('services','Shodan InternetDB',10,hostKnown?'ok':host?.status??'missing',hostKnown?host.data.vulnerabilities.length>0:null,{asOf:host?.observedAt??null}));
  const abuse=get('abuseipdb'),abuseKnown=freshSource(abuse,now)&&integer(abuse.data?.totalReports)!==null&&integer(abuse.data?.distinctReporters)!==null;
  const count=abuseKnown?abuse.data.totalReports:0,reporters=abuseKnown?abuse.data.distinctReporters:0;
  const abusePoints=count>=20&&reporters>=5?30:count>=5&&reporters>=3?15:count>0?5:0;
  const abuseRule=rule('abuse','AbuseIPDB',30,abuse?.status==='disabled'?'disabled':abuseKnown?'ok':abuse?.status??'disabled',abuseKnown?count>0:null,{asOf:abuse?.observedAt??null});
  // The optional abuse category uses our count thresholds, never the provider's confidence score.
  abuseRule.severity=abusePoints/30;checks.push(abuseRule);
  const result=assessment(checks);
  return {...result,model:'nodecloak-ip-risk-v2',
    level:result.score===null?null:result.score===0?'none':result.score<=15?'low':result.score<=40?'moderate':result.score<70?'elevated':'high',queriedAt:new Date(now).toISOString()};
};

export const SCENARIO_WEIGHTS={
  ai:{drop:70,tor:35,proxy:30,hosting:20,dnsbl:0,services:0,abuse:25},
  social:{drop:70,tor:35,proxy:35,hosting:20,dnsbl:20,services:0,abuse:30},
  streaming:{drop:50,tor:25,proxy:15,hosting:10,dnsbl:0,services:0,abuse:10},
  gaming:{drop:50,tor:20,proxy:15,hosting:10,dnsbl:0,services:0,abuse:20},
  commerce:{drop:70,tor:35,proxy:30,hosting:20,dnsbl:15,services:0,abuse:30},
  email:{drop:70,tor:0,proxy:0,hosting:0,dnsbl:60,services:0,abuse:30,ptr:15},
};
export const buildIPReport=(ip,sources,now=Date.now())=>{
  const get=id=>sources.find(row=>row.id===id),data=id=>get(id)?.status==='ok'?get(id).data:null;
  const network=data('network'),classification=data('ipapi'),proxy=data('proxycheck'),registration=data('rdap'),rdns=data('rdns');
  const usageType=proxy?.type&&proxy.type!=='unknown'?proxy.type:classification?.mobile===true?'mobile':classification?.hosting===true?'hosting':'unknown';
  const usageTypeSource=proxy?.type&&proxy.type!=='unknown'?'proxycheck.io':usageType!=='unknown'?'IP-API':null;
  const countryCode=classification?.countryCode??proxy?.countryCode??network?.location?.countryCode??null;
  const risk=assessReportRisk(sources,now);
  const ptrRule=rule('ptr','DNS PTR',15,rdns&&typeof rdns.exists==='boolean'?'ok':get('rdns')?.status??'missing',rdns?rdns.exists===false:null,{asOf:get('rdns')?.observedAt??null});
  const scenarios=Object.entries(SCENARIO_WEIGHTS).map(([id,weights])=>{
    const subset=[...risk.checks,ptrRule].map(row=>({...row,maxPoints:weights[row.id]??0})).filter(row=>row.maxPoints>0);
    const evaluated=assessment(subset,weights);
    const range={min:100-evaluated.range.max,max:100-evaluated.range.min};
    return {id,score:evaluated.score===null?null:100-evaluated.score,scoreKind:evaluated.scoreKind,status:evaluated.status,range,coverage:evaluated.coverage,
      level:range.max-range.min>=20?'incomplete':range.min>=85?'favorable':range.min>=65?'mixed':range.min>=40?'caution':'adverse',factors:evaluated.checks};
  });
  return {ip,model:risk.model,generatedAt:new Date(now).toISOString(),
    profile:{countryCode,country:classification?.country??proxy?.country??network?.location?.country??null,region:classification?.region??proxy?.region??null,city:classification?.city??proxy?.city??null,
      asn:network?.asn??null,asnName:network?.asnName??null,domain:network?.domain??null,prefix:network?.prefix??null,range:network?.range??null,
      registration,registrationRelation:registration?.countryCode&&countryCode?registration.countryCode===countryCode?'same':'different':'unknown',nativeType:'unknown',
      type:usageType,
      rdns,sharing:proxy&&proxy.subnetDevices!==null?{count:proxy.subnetDevices,subnet:proxy.subnet,source:'proxycheck.io',providerUpdatedAt:proxy.providerUpdatedAt}:null},
    risk:{...risk,usageType,usageTypeSource},scenarios,platforms:assessPlatformRegions(countryCode,now),
    passive:data('internetdb'),abuse:data('abuseipdb'),radar:data('radar'),
    evidence:risk.checks,sources:sources.map(row=>({...row})),scope:'public-ip-observations',livePlatformAccessTested:false};
};

// Plain text contains the same bounded public observations as the JSON export.
export const reportToText=report=>[
  `IP.NodeCloak IP assessment\n${report.ip}\n${report.generatedAt}\nModel: ${report.model}`,
  `Risk: ${report.risk.score??'unavailable'} /100 (higher means more observed risk signals)\nScore basis: ${report.risk.scoreKind}\nRisk range: ${report.risk.range.min}-${report.risk.range.max} /100\nCoverage: ${report.risk.coverage.checked}/${report.risk.coverage.total}`,
  `Profile\n${JSON.stringify(report.profile,null,2)}`,
  'Scenarios\n'+report.scenarios.map(row=>`${row.id}: ${row.score??'unavailable'} /100; basis=${row.scoreKind}; range=${row.range.min}-${row.range.max}; coverage=${row.coverage.checked}/${row.coverage.total}; ${row.level}`).join('\n'),
  'Regional policy snapshots\n'+report.platforms.map(row=>`${row.id}: ${row.status}; ${row.reviewedAt}; ${row.source}`).join('\n'),
  'Evidence\n'+report.evidence.map(row=>`${row.id}: ${row.status}; observed=${row.hit}; points=${row.points}; source=${row.source}; asOf=${row.asOf??'unknown'}`).join('\n'),
  'Sources\n'+report.sources.map(row=>`${row.id}: ${row.status}; ${row.durationMs}ms; ${row.observedAt}`).join('\n'),
  'Scope: public IP-level evidence and disclosed heuristic rules. Scenario indices are not live account-access or deliverability tests. Subnet estimates do not establish exclusive use.'
].join('\n\n');

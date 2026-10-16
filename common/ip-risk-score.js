// Versioned first-party network-risk rules and strict public snapshot parsers.
import { parseIp, parseCidr, cidrContains } from './ip-math.js';

export const RISK_MODEL = 'nodecloak-ip-risk-v1';
export const SNAPSHOT_MAX_AGE = 48 * 60 * 60 * 1000;
export const isFreshRiskTime = (asOf, now=Date.now(), maxAge=SNAPSHOT_MAX_AGE) => {
  const time=Date.parse(asOf??'');
  return Number.isFinite(time) && time<=now+300000 && now-time<=maxAge;
};
const addressKey = ip => {const parsed=parseIp(ip);return parsed?`${parsed.family}:${parsed.value}`:null;};
const boundedText = value => {
  if(typeof value!=='string'||value.length>5*1024*1024) throw new Error('Invalid snapshot body');
  return value;
};

// DROP is JSONL with a required terminal metadata record, retained for attribution.
export const parseDropSnapshot = (text, family) => {
  const lines=boundedText(text).trim().split(/\r?\n/).map(line=>JSON.parse(line));
  const metadata=lines.pop();
  if(metadata?.type!=='metadata'||!Number.isFinite(metadata.timestamp)||!Number.isInteger(metadata.records)||typeof metadata.copyright!=='string') throw new Error('Missing DROP metadata');
  const prefixes=lines.map(row=>{
    const parsed=parseCidr(row.cidr);
    if(!parsed||parsed.family!==family||!parsed.aligned||parsed.prefix===0) throw new Error('Invalid DROP prefix');
    return row.cidr;
  });
  if(!prefixes.length||metadata.records!==prefixes.length) throw new Error('Incomplete DROP snapshot');
  return {kind:'drop',prefixes:[...new Set(prefixes)],asOf:new Date(metadata.timestamp*1000).toISOString(),copyright:metadata.copyright.slice(0,400)};
};

// Tor's observed-exit export provides IPv4 exit observations, not complete IPv6 coverage.
export const parseTorSnapshot = text => {
  const addresses=new Set(),seenAt=new Map();let latest=0;
  for(const line of boundedText(text).trim().split(/\r?\n/)) {
    if(!line.startsWith('ExitAddress ')) continue;
    const parts=line.split(/\s+/),key=addressKey(parts[1]),time=Date.parse(`${parts[2]}T${parts[3]}Z`);
    if(parts.length!==4||!key||!Number.isFinite(time)) throw new Error('Invalid Tor observation');
    addresses.add(key);seenAt.set(key,Math.max(seenAt.get(key)??0,time));latest=Math.max(latest,time);
  }
  if(!addresses.size) throw new Error('Empty Tor snapshot');
  return {kind:'tor',addresses,seenAt,asOf:new Date(latest).toISOString()};
};

export const matchRiskSnapshot = (snapshot, ip, now=Date.now()) => {
  if(!snapshot) return {status:'missing'};
  const metadata={asOf:snapshot.asOf,...(snapshot.copyright?{copyright:snapshot.copyright}:{})};
  if(!isFreshRiskTime(snapshot.asOf,now)) return {...metadata,status:'stale'};
  if(snapshot.kind==='tor'&&parseIp(ip)?.family!==4) return {...metadata,status:'unsupported'};
  const lastSeen=snapshot.kind==='tor'?snapshot.seenAt?.get(addressKey(ip)):null;
  if(lastSeen) {
    metadata.asOf=new Date(lastSeen).toISOString();
    if(!isFreshRiskTime(metadata.asOf,now)) return {...metadata,status:'stale'};
  }
  const matchedPrefix=snapshot.kind==='drop'?snapshot.prefixes.find(prefix=>cidrContains(prefix,ip)):null;
  return {...metadata,status:'ok',hit:snapshot.kind==='tor'?snapshot.addresses.has(addressKey(ip)):!!matchedPrefix,...(matchedPrefix?{matchedPrefix}:{})};
};

// Weights are an explicit heuristic index, not a calibrated fraud probability.
export const scoreIPRisk = (ip, evidence={}, now=Date.now()) => {
  const snapshotRule=(id,source,maxPoints,body)=>{
    const status=body?.status==='ok'&&!isFreshRiskTime(body.asOf,now)?'stale':body?.status??'missing';
    const known=status==='ok'&&typeof body?.hit==='boolean';
    return {id,source,maxPoints,status:known?'ok':status==='ok'?'missing':status,hit:known?body.hit:null,points:known&&body.hit?maxPoints:0,asOf:body?.asOf??null,...(body?.matchedPrefix?{matchedPrefix:body.matchedPrefix}:{}),...(body?.copyright?{copyright:body.copyright}:{})};
  };
  const drop=snapshotRule('drop','Spamhaus DROP',70,evidence.drop);
  const tor=snapshotRule('tor','Tor Project',30,evidence.tor);
  const classification=evidence.classification;
  const sameAddress=addressKey(ip)!==null&&addressKey(classification?.query)===addressKey(ip);
  const current=sameAddress&&classification?.status==='success'&&isFreshRiskTime(classification.asOf,now,5*60*1000);
  const flagRule=(id,flag,maxPoints)=>({id,source:'IP-API',maxPoints,status:current&&typeof flag==='boolean'?'ok':'missing',hit:current&&typeof flag==='boolean'?flag:null,points:current&&flag===true?maxPoints:0,asOf:current?classification.asOf:null});
  const proxy=flagRule('proxy',classification?.proxy,25),hosting=flagRule('hosting',classification?.hosting,10);
  if(tor.hit===true&&proxy.hit===true) {proxy.points=0;proxy.suppressedBy='tor';}
  const checks=[drop,tor,proxy,hosting],checked=checks.filter(rule=>rule.status==='ok').length;
  const observedPoints=Math.min(100,checks.reduce((total,rule)=>total+rule.points,0));
  const score=checked===checks.length?observedPoints:null;
  return {ip,model:RISK_MODEL,status:score===null?'partial':'ok',score,observedPoints,coverage:{checked,total:checks.length},
    level:score===null?null:score===0?'none':score<=15?'low':score<=40?'moderate':score<70?'elevated':'high',
    usageType:current&&classification.mobile===true?'mobile':hosting.hit===true?'hosting':'unknown',
    checks,queriedAt:new Date(now).toISOString()};
};

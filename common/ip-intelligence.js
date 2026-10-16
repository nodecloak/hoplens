// Strict, source-aware normalization for the inline public-IP detail panel.
import { parseIp, cidrContains, cidrToRange, formatIp } from './ip-math.js';
import { isValidDomain } from './valid-ip.js';

const text = (value, max=180) => typeof value==='string' && value.trim() ? value.trim().slice(0,max) : null;
const asNumber = value => /^\d+$/.test(String(value)) && Number(value)>0 && Number(value)<=4294967295 ? Number(value) : null;
const sameIP = (a,b) => { const x=parseIp(a), y=parseIp(b); return !!x && !!y && x.family===y.family && x.value===y.value; };
const score = value => typeof value==='number' && Number.isFinite(value) && value>=0 && value<=100 ? value : null;

export const normalizeLocation = (body, ip) => {
  if (!body || !sameIP(body.ip,ip) || body.success===false) return null;
  const code=text(body.country_code??body.countryCode);
  const countryCode=code && /^[a-z]{2}$/i.test(code) ? code.toUpperCase() : null;
  const country=text(body.country_name??body.country), region=text(body.region), city=text(body.city);
  return countryCode||country||region||city ? {countryCode,country,region,city} : null;
};

export const normalizeNetwork = (ip, ripe, who, orgName=()=>null) => {
  const proposed=ripe?.data?.prefix;
  const prefix=typeof proposed==='string' && cidrContains(proposed,ip) ? proposed : null;
  const routeAsns=prefix && Array.isArray(ripe?.data?.asns) ? ripe.data.asns.map(asNumber).filter(Boolean).slice(0,8) : [];
  const whoMatches=!!who && who.success!==false && sameIP(who.ip,ip);
  const connection=whoMatches ? who.connection : null;
  const whoAsn=asNumber(connection?.asn);
  const asn=routeAsns[0]??whoAsn;
  const domain=whoAsn && whoAsn===asn ? text(connection?.domain,253) : null;
  const range=prefix ? cidrToRange(prefix) : null;
  return {ip,asn,asnSource:routeAsns.length?'RIPEstat':whoAsn?'IPWhois':null,asns:routeAsns.length?routeAsns:asn?[asn]:[],
    asnName:asn ? text(orgName(asn))??(whoAsn===asn?text(connection?.org):null) : null,
    domain:domain && isValidDomain(domain) ? domain.toLowerCase() : null,
    prefix,range:range ? {start:formatIp({family:range.family,value:range.start}),end:formatIp({family:range.family,value:range.end})} : null,
    location:normalizeLocation(who,ip)};
};

export const normalizeTraffic = body => {
  const percent = value => typeof value==='string' && /^\d+(\.\d+)?%?$/.test(value.trim()) ? score(Number(value.replace('%',''))) : score(value);
  const human=percent(body?.Human_Pct),bot=percent(body?.Bot_Pct);
  return human!==null && bot!==null && Math.abs(human+bot-100)<=0.1 ? {human,bot}:null;
};

export const createCachedLoader = (loader,{maxEntries=256,ttlMs=3600000,ttlForValue}={}) => {
  const cache=new Map();
  return async key => {
    const current=cache.get(key);
    if(current && current.until>Date.now()) return current.promise;
    if(current) cache.delete(key);
    const entry={until:Infinity,promise:null};
    entry.promise=Promise.resolve().then(()=>loader(key)).then(value=>{
      entry.until=Date.now()+(ttlForValue?ttlForValue(value):ttlMs);
      return value;
    },error=>{if(cache.get(key)===entry) cache.delete(key);throw error;});
    cache.set(key,entry);
    while(cache.size>maxEntries) cache.delete(cache.keys().next().value);
    return entry.promise;
  };
};

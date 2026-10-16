// Fixed-provider report adapters with bounded payloads and explicit public-data failure states.
import { Resolver } from 'node:dns/promises';
import { fetchUpstream } from './fetch-with-timeout.js';
import { rdapIp } from './rdap.js';
import { loadNetworkInfo } from '../api/network-info.js';
import { loadAsnSummary } from './cf-radar.js';
import { normalizeTraffic } from './ip-intelligence.js';
import { normalizePassiveHost,normalizeProxyObservation,normalizeRegistration,normalizeAbuseObservation } from './ip-report-model.js';
import { parseIp } from './ip-math.js';
import { isValidDomain } from './valid-ip.js';

const absent=error=>['ENOTFOUND','ENODATA'].includes(error?.code);
const failed=error=>({status:['AbortError','TimeoutError'].includes(error?.name)?'timeout':'error'});
const zones={spamcop:'bl.spamcop.net',psbl:'psbl.surriel.com',dronebl:'dnsbl.dronebl.org'};
export const classifyDNSBLAnswer=(answers,provider)=>{
  if(!Array.isArray(answers)||!answers.length) return {status:'error'};
  const codes=answers.map(value=>/^127\.0\.0\.(\d+)$/.exec(value)?.[1]).map(Number);
  const allowed=provider==='spamhaus'?[2,3,4,9,10,11]:provider==='dronebl'?[2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,255]:[2];
  if(codes.some(value=>!allowed.includes(value))) return {status:'error'};
  return {status:'ok',data:{listed:codes.some(value=>provider!=='spamhaus'||![10,11].includes(value)),policyListed:provider==='spamhaus'&&codes.some(value=>[10,11].includes(value)),codes:answers}};
};
export const createReportSources=(deps={})=>{
  const fetch=deps.fetch??fetchUpstream,env=deps.env??(()=>process.env);
  const resolver=new Resolver({timeout:1500,tries:1});
  if(env().IP_REPORT_DNS_SERVERS) resolver.setServers(env().IP_REPORT_DNS_SERVERS.split(',').map(value=>value.trim()));
  const resolve4=deps.resolve4??resolver.resolve4.bind(resolver),reverse=deps.reverse??resolver.reverse.bind(resolver),health=new Map();
  const json=async(url,init={})=>{
    // Keep the body read under the same deadline; the shared fetch timeout ends at headers.
    const response=await fetch(url,{timeoutMs:6000,...init,signal:AbortSignal.timeout(6000)});
    if(response.status===429) return {status:'limited'};
    if(response.status===404) return {status:'empty'};
    if(!response.ok) return {status:'error'};
    return {status:'ok',data:await response.json()};
  };
  const normalized=async(url,normalize,init)=>{
    try {const result=await json(url,init);if(result.status!=='ok') return result;const data=normalize(result.data);return data?{status:'ok',data}:{status:'error'};} catch(error){return failed(error);}
  };
  return {
    ipapi:ip=>normalized(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,query,country,countryCode,regionName,city,proxy,hosting,mobile`,body=>{
      const expected=parseIp(ip),actual=parseIp(body?.query);
      if(body?.status!=='success'||!actual||actual.family!==expected?.family||actual.value!==expected?.value) return null;
      return {proxy:typeof body.proxy==='boolean'?body.proxy:null,hosting:typeof body.hosting==='boolean'?body.hosting:null,mobile:typeof body.mobile==='boolean'?body.mobile:null,countryCode:/^[A-Z]{2}$/.test(body.countryCode)?body.countryCode:null,country:String(body.country??'').slice(0,100),region:String(body.regionName??'').slice(0,100),city:String(body.city??'').slice(0,100)};
    }),
    proxycheck:ip=>normalized(`https://proxycheck.io/v3/${encodeURIComponent(ip)}?tag=0&p=0${env().PROXYCHECK_API_KEY?'&key='+encodeURIComponent(env().PROXYCHECK_API_KEY):''}`,body=>normalizeProxyObservation(body,ip)),
    internetdb:ip=>normalized(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`,body=>normalizePassiveHost(body,ip)),
    rdap:async ip=>{try{const data=normalizeRegistration(await (deps.rdap??rdapIp)(ip,{timeoutMs:5000}),ip);return data?{status:'ok',data}:{status:'error'};}catch(error){return failed(error);}},
    network:async ip=>{try{const data=await (deps.network??loadNetworkInfo)(ip);return data?.asn||data?.location?{status:'ok',data}:{status:'empty'};}catch(error){return failed(error);}},
    rdns:async ip=>{try{const names=(await reverse(ip)).filter(isValidDomain).slice(0,20);return {status:'ok',data:{exists:names.length>0,names}};}catch(error){return absent(error)?{status:'ok',data:{exists:false,names:[]}}:failed(error);}},
    abuseipdb:ip=>env().ABUSEIPDB_API_KEY?normalized(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=30`,body=>normalizeAbuseObservation(body,ip),{headers:{Key:env().ABUSEIPDB_API_KEY,Accept:'application/json'}}):Promise.resolve({status:'disabled'}),
    radar:async asn=>{
      if(!env().CLOUDFLARE_API_KEY&&!env().CLOUDFLARE_RADAR_API_KEY) return {status:'disabled'};
      if(!Number.isInteger(asn)||asn<1||asn>4294967295) return {status:'empty'};
      try{const result=await (deps.radar??loadAsnSummary)(asn),data=normalizeTraffic(result.summary);return data?{status:'ok',data:{...data,asn,scope:'asn',period:'7d'}}:{status:'error'};}catch(error){return failed(error);}
    },
    dnsbl:async(ip,provider)=>{
      if(provider==='spamhaus'&&!env().SPAMHAUS_DQS_KEY) return {status:'disabled'};
      if(parseIp(ip)?.family!==4) return {status:'unsupported'};
      const zone=provider==='spamhaus'?`${env().SPAMHAUS_DQS_KEY}.zen.dq.spamhaus.net`:zones[provider];
      if(!zone) return {status:'unsupported'};
      const query=async(host,positiveControl=false)=>{
        try{
          const answers=await resolve4(host);
          // DroneBL's 127.0.0.2 test entry returns a testing-class sentinel, not a target listing code.
          if(positiveControl&&provider==='dronebl'&&answers.length===1&&answers[0]==='127.0.0.1') return {status:'ok',data:{listed:true}};
          return classifyDNSBLAnswer(answers,provider);
        }catch(error){return absent(error)?{status:'ok',data:{listed:false,policyListed:false,codes:[]}}:failed(error);}
      };
      let entry=health.get(zone);
      if(!entry||entry.until<Date.now()) {
        const promise=Promise.all([query(`2.0.0.127.${zone}`,true),query(`1.0.0.127.${zone}`)]).then(([positive,negative])=>positive.status==='ok'&&positive.data.listed===true&&negative.status==='ok'&&negative.data.listed===false);
        entry={promise,until:Date.now()+60000};health.set(zone,entry);
        if(await promise) entry.until=Date.now()+3600000;
      }
      if(!await entry.promise) return {status:'error'};
      return query(`${ip.split('.').reverse().join('.')}.${zone}`);
    }
  };
};

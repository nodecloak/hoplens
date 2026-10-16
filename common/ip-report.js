// Coalesced, bounded source caches; current local snapshots are re-matched for every report.
import { createReportSources } from './ip-report-sources.js';
import { createCachedLoader } from './ip-intelligence.js';
import { getRiskEvidence } from './ip-risk-data.js';
import { buildIPReport } from './ip-report-model.js';

export const createReportLoader=({adapters=createReportSources(),evidence=getRiskEvidence,now=Date.now,timeoutMs=10000}={})=>{
  const loaders=new Map();
  const observe=(id,key,run)=>{
    if(!loaders.has(id)) loaders.set(id,createCachedLoader(async value=>{
      const started=now();let result;
      let timer;
      try{result=await Promise.race([Promise.resolve().then(()=>run(value)),new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'timeout'}),timeoutMs);})]);}catch{result={status:'error'};}finally{clearTimeout(timer);}
      return {id,...result,durationMs:Math.max(0,now()-started),observedAt:new Date(now()).toISOString()};
    },{maxEntries:256,ttlForValue:value=>value.status==='ok'?300000:value.status==='disabled'?60000:30000}));
    return loaders.get(id)(key);
  };
  return async ip=>{
    const ids=['network','ipapi','proxycheck','rdap','rdns','internetdb','abuseipdb'];
    const network=observe('network',ip,adapters.network);
    const tasks=ids.filter(id=>id!=='network').map(id=>observe(id,ip,adapters[id]));
    const dns=['spamcop','psbl','dronebl','spamhaus'].map(provider=>observe('dnsbl-'+provider,ip,value=>adapters.dnsbl(value,provider)));
    const radar=network.then(row=>observe('radar',row.data?.asn??0,adapters.radar));
    const sources=await Promise.all([network,...tasks,...dns,radar]);
    for(const [id,value] of Object.entries(evidence(ip))) sources.push({id,status:value.status,data:value.status==='ok'?value:null,observedAt:new Date(now()).toISOString(),durationMs:0});
    return buildIPReport(ip,sources,now());
  };
};
export const loadIPReport=createReportLoader();

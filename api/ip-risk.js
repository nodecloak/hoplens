// First-party risk rules: local public snapshot matches plus explicit IP-API flags.
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { createCachedLoader } from '../common/ip-intelligence.js';
import { getRiskEvidence } from '../common/ip-risk-data.js';
import { scoreIPRisk } from '../common/ip-risk-score.js';
import logger from '../common/logger.js';

const lookupClassification=async ip=>{
  const response=await fetchUpstream(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,query,proxy,hosting,mobile`);
  if(!response.ok) throw new Error(`Classification HTTP ${response.status}`);
  return {...await response.json(),asOf:new Date().toISOString()};
};
export const createIPRiskHandler=({evidence=getRiskEvidence,lookup=lookupClassification,now=Date.now}={})=>{
  const load=createCachedLoader(lookup,{ttlMs:5*60*1000});
  return async(req,res)=>{
    const ip=req.query.ip;let classification=null;
    try {classification=await load(ip);}
    catch(error) {logger.warn({code:error.code},'IP classification unavailable');}
    // Re-match the current snapshots even when classification is cached.
    res.json(scoreIPRisk(ip,{...evidence(ip),classification},now()));
  };
};
export default createIPRiskHandler();

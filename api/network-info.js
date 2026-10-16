// Public RIPEstat routing and IPWhois data, cached per queried IP with partial-source states.
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { normalizeNetwork, createCachedLoader } from '../common/ip-intelligence.js';
import { lookupAsOrgName } from '../common/as-org-db.js';
import logger from '../common/logger.js';

const json = async url => {
  const response=await fetchUpstream(url);
  if(!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
};
export const loadNetworkInfo=createCachedLoader(async ip=>{
  const results=await Promise.allSettled([
    json(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(ip)}`),
    json(`https://ipwho.is/${encodeURIComponent(ip)}`),
  ]);
  const ripe=results[0].status==='fulfilled'?results[0].value:null;
  const who=results[1].status==='fulfilled'?results[1].value:null;
  const data=normalizeNetwork(ip,ripe,who,lookupAsOrgName);
  data.status={routing:data.prefix?'ok':'unavailable',whois:data.location?'ok':'unavailable'};
  return data;
},{ttlForValue:value=>Object.values(value.status).every(state=>state==='ok')?21600000:60000});

export default async (req,res) => {
  try { res.json(await loadNetworkInfo(req.query.ip)); }
  catch(error) { logger.warn({code:error.code},'IP network overview unavailable'); res.status(502).json({error:'Network information unavailable'}); }
};

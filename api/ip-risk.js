// On-demand IPure public reports; their purity score is never labelled as IPPure's risk score.
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { normalizePurity, createCachedLoader } from '../common/ip-intelligence.js';
import logger from '../common/logger.js';

const load=createCachedLoader(async ip=>{
  const reportUrl=`https://ipure.dev/en/ip/${encodeURIComponent(ip)}`;
  const response=await fetchUpstream(reportUrl+'.json',{timeoutMs:12000});
  if(!response.ok) return {ip,status:[403,429].includes(response.status)?'limited':'unavailable',reportUrl};
  const data=normalizePurity(ip,await response.json());
  return data && data.purity!==null ? {...data,status:'ok',provider:'IPure'} : {ip,status:'unavailable',reportUrl};
},{ttlForValue:value=>value.status==='ok'?3600000:60000});

export default async (req,res)=>{
  try { res.json(await load(req.query.ip)); }
  catch(error) { logger.warn({code:error.code},'IPure report unavailable'); res.status(502).json({error:'IP purity source unavailable'}); }
};

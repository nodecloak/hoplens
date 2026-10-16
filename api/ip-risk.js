// First-party risk rules: local public snapshot matches plus explicit IP-API flags.
import { loadIPReport } from '../common/ip-report.js';
export const createIPRiskHandler=({load=loadIPReport}={})=>async(req,res)=>{
  const report=await load(req.query.ip);
  res.json({ip:report.ip,...report.risk});
};
export default createIPRiskHandler();

// Lightweight network classification shares provider caches without running risk checks.
import { loadIPReport } from '../common/ip-report.js';
export const createIPClassificationHandler=({load=loadIPReport.classification}={})=>async(req,res)=>{
  res.json(await load(req.query.ip));
};
export default createIPClassificationHandler();

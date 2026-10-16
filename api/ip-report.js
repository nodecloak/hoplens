// GET /api/ip-report?ip=: full same-IP assessment with bounded observations and disclosed heuristics.
import { loadIPReport } from '../common/ip-report.js';
export const createIPReportHandler=({load=loadIPReport}={})=>async(req,res)=>res.json(await load(req.query.ip));
export default createIPReportHandler();

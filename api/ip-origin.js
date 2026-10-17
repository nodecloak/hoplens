// GET /api/ip-origin?ip=: automatic country-comparison reference using cached fixed-provider observations.
import { loadIPReport } from '../common/ip-report.js';
export const createIPOriginHandler = ({ load = loadIPReport.origin } = {}) => async (req, res) => {
  res.json(await load(req.query.ip));
};
export default createIPOriginHandler();

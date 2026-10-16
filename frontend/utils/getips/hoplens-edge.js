// Resolve the visitor address through this site's Cloudflare edge when available.
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseTrace } from '../parse-trace.js';
import { isUsablePublicIP } from '../valid-ip.js';

export const hoplensEdge = {
  id: 'hoplens-edge',
  name: 'Hoplens edge',
  run: async () => {
    const response = await fetchWithTimeout('/cdn-cgi/trace', { cache: 'no-store' });
    if (!response.ok) throw new Error('Edge trace unavailable');
    const ip = parseTrace(await response.text()).ip;
    if (!isUsablePublicIP(ip)) throw new Error('No public address in edge trace');
    return ip;
  },
};

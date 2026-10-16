// Validate a manually selected IP without changing visitor-network diagnostics.
import { isValidIP, isUsablePublicIP } from '../../common/valid-ip.js';

export const parseIPLookupQuery = (value) => {
    const ip = value.trim();
    if (!isValidIP(ip)) return { ip: '', error: 'ipcheck.Error' };
    if (!isUsablePublicIP(ip)) return { ip: '', error: 'ipcheck.reservedIP' };
    return { ip, error: '' };
};

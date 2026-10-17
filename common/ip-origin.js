// Disclosed registry/geolocation comparison; these labels do not verify physical routing or exclusivity.
import { isFreshRiskTime } from './ip-risk-score.js';
import { ALPHA2_TO_NUMERIC } from './country-numeric.js';

const country = value => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (code === 'UK') return 'GB';
  return Object.hasOwn(ALPHA2_TO_NUMERIC, code) ? code : null;
};

export const deriveIPOrigin = (sources, now = Date.now()) => {
  const read = id => {
    const rows = sources.filter(row => row.id === id);
    const row = rows.length === 1 ? rows[0] : null;
    const fresh = row?.status === 'ok' && isFreshRiskTime(row.observedAt, now, 15 * 60 * 1000);
    return { id, status: row?.status === 'ok' && !fresh ? 'stale' : row?.status ?? 'missing', countryCode: fresh ? country(row.data?.countryCode) : null };
  };
  const evidence = ['rdap', 'ipapi', 'proxycheck'].map(read);
  const registrationCountry = evidence[0].countryCode;
  const locations = evidence.slice(1).map(row => row.countryCode);
  const agreed = locations.every(Boolean) && locations[0] === locations[1];
  const locationCountry = agreed ? locations[0] : null;
  return {
    type: registrationCountry && locationCountry ? registrationCountry === locationCountry ? 'native' : 'broadcast' : 'unknown',
    reference: true, basis: 'registry-geolocation', registrationCountry, locationCountry, evidence,
  };
};

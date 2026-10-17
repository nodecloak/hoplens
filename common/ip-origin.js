// Disclosed registry/geolocation comparison; these labels do not verify physical routing or exclusivity.
import { isFreshRiskTime } from './ip-risk-score.js';
import { ALPHA2_TO_NUMERIC } from './country-numeric.js';

const country = value => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (code === 'UK') return 'GB';
  return Object.hasOwn(ALPHA2_TO_NUMERIC, code) ? code : null;
};

// A multiple-origin route cannot be attributed to one ASN registration country.
export const originASN = row => {
  if(row?.status!=='ok')return null;
  const asn=row.data?.asn,asns=row.data?.asns??[asn];
  return Number.isInteger(asn)&&asn>0&&asn<=4294967295&&Array.isArray(asns)&&asns.length===1&&asns[0]===asn?asn:null;
};

// Team Cymru's ASN TXT country is an ASN allocation attribute, never an IP location.
export const normalizeASNRegistration = (records, asn) => {
  if(!Number.isInteger(asn)||asn<1||asn>4294967295||!Array.isArray(records)||!records.length)return null;
  const rows=records.map(parts=>Array.isArray(parts)?parts.join('').split('|').map(value=>value.trim()):[]);
  if(rows.some(row=>row.length!==5||row[0]!==String(asn)||!country(row[1])))return null;
  const codes=[...new Set(rows.map(row=>country(row[1])))];
  return codes.length===1?{asn,countryCode:codes[0]}:null;
};

export const deriveIPOrigin = (sources, now = Date.now()) => {
  const read = id => {
    const rows = sources.filter(row => row.id === id);
    const row = rows.length === 1 ? rows[0] : null;
    const fresh = row?.status === 'ok' && isFreshRiskTime(row.observedAt, now, 15 * 60 * 1000);
    return { id, status: row?.status === 'ok' && !fresh ? 'stale' : row?.status ?? 'missing', countryCode: fresh ? country(row.data?.countryCode) : null };
  };
  const evidence = ['network', 'asn-registration', 'ipapi', 'proxycheck'].map(read);
  const asn=evidence[0].status==='ok'?originASN(sources.find(row=>row.id==='network')):null;
  const registration=sources.find(row=>row.id==='asn-registration');
  const registrationCountry = asn&&registration?.data?.asn===asn?evidence[1].countryCode:null;
  const locationCountry = evidence[2].countryCode??evidence[3].countryCode;
  return {
    type: registrationCountry && locationCountry ? registrationCountry === locationCountry ? 'native' : 'broadcast' : 'unknown',
    reference: true, basis: 'asn-registration-geolocation', asn, registrationCountry, locationCountry, evidence,
  };
};

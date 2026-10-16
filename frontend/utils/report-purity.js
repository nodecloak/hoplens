// Bounded, same-IP homepage purity snapshots for all diagnostic report exports.
import { isUsablePublicIP, isValidIP } from './valid-ip.js';
import { parseIp, parseCidr } from '../../common/ip-math.js';

const text = (value, max = 180) => typeof value === 'string' && value ? value.slice(0, max) : undefined;
const number = (value, max = 100) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
const integer = (value, max = 100) => Number.isInteger(value) ? number(value, max) : undefined;
const date = value => typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value)) ? value : undefined;
const flag = value => typeof value === 'boolean' ? value : null;
const compact = value => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const state = value => ['pending', 'loading', 'ok', 'partial', 'disabled', 'different', 'unavailable', 'unknown', 'missing', 'stale', 'unsupported', 'error', 'limited'].includes(value) ? value : 'unavailable';
const sameIP = (left, right) => {
  const a = parseIp(left), b = parseIp(right);
  return !!a && !!b && a.family === b.family && a.value === b.value;
};
const prefix = value => typeof value === 'string' && parseCidr(value) ? { address: value.split('/')[0], length: Number(value.split('/')[1]) } : undefined;
const usageType = value => ['business', 'residential', 'mobile', 'hosting', 'education', 'unknown'].includes(value) ? value : 'unknown';

// Unknown results stay unknown; no absent check is normalized into a clean score.
const riskSnapshot = (risk, ip, riskState) => {
  if (!['ok', 'partial'].includes(riskState) || !sameIP(risk?.ip, ip)) return undefined;
  if (!date(risk.queriedAt) || !['complete', 'observed', 'unavailable'].includes(risk.scoreKind)
      || (risk.score !== null && integer(risk.score) === undefined)
      || number(risk.range?.min) === undefined || number(risk.range?.max) === undefined
      || integer(risk.coverage?.checked, 32) === undefined || integer(risk.coverage?.total, 32) === undefined) return undefined;
  return compact({
    model: text(risk.model, 64), score: risk.score, scoreKind: risk.scoreKind,
    level: ['none', 'low', 'moderate', 'elevated', 'high'].includes(risk.level) ? risk.level : null,
    queriedAt: risk.queriedAt, range: { min: risk.range.min, max: risk.range.max },
    coverage: { checked: risk.coverage.checked, total: risk.coverage.total },
    checks: (Array.isArray(risk.checks) ? risk.checks : [])
      .filter(row => ['drop', 'tor', 'proxy', 'hosting', 'dnsbl', 'services', 'abuse'].includes(row?.id))
      .slice(0, 7).map(row => compact({
        id: row.id, source: text(row.source, 96) ?? '', status: state(row.status), hit: flag(row.hit),
        points: integer(row.points) ?? 0, maxPoints: integer(row.maxPoints) ?? 0,
        asOf: date(row.asOf), matchedPrefix: prefix(row.matchedPrefix), copyright: text(row.copyright, 256),
        suppressedBy: ['tor', 'proxy'].includes(row.suppressedBy) ? row.suppressedBy : undefined,
      })),
  });
};

export const buildPurity = payload => {
  if (!isUsablePublicIP(payload?.ip)) return null;
  const ip = payload.ip, data = sameIP(payload.network?.ip, ip) ? payload.network : null;
  const classification = payload.classification && (!payload.classification.ip || sameIP(payload.classification.ip, ip)) ? payload.classification : {};
  const riskState = ['pending', 'loading', 'ok', 'partial'].includes(payload.riskState) ? payload.riskState : 'unavailable';
  const risk = riskSnapshot(payload.risk, ip, riskState);
  const matchingRisk = risk ? payload.risk : {};
  return compact({
    ip, networkState: state(payload.networkState), trafficState: state(payload.trafficState), riskState,
    network: data ? compact({
      asn: integer(data.asn, 4294967295), asnName: text(data.asnName), asnSource: text(data.asnSource, 64),
      domain: text(data.domain, 253), prefix: prefix(data.prefix),
      range: isValidIP(data.range?.start) && isValidIP(data.range?.end) ? { start: data.range.start, end: data.range.end } : undefined,
    }) : undefined,
    usageType: usageType(matchingRisk.usageType && matchingRisk.usageType !== 'unknown' ? matchingRisk.usageType : classification.usageType && classification.usageType !== 'unknown' ? classification.usageType : classification.mobile === true ? 'mobile' : classification.hosting === true ? 'hosting' : 'unknown'),
    usageTypeSource: text(matchingRisk.usageTypeSource ?? classification.usageTypeSource, 96),
    proxy: risk?.checks.find(row => row.id === 'proxy')?.hit ?? flag(classification.proxy),
    locations: (Array.isArray(payload.locations) ? payload.locations : []).slice(0, 8).filter(row => row?.id).map(row => compact({
      id: text(row.id, 32), name: text(row.name, 64) ?? '', status: state(row.status),
      countryCode: typeof row.location?.countryCode === 'string' && /^[A-Z]{2}$/i.test(row.location.countryCode) ? row.location.countryCode.toUpperCase() : '',
      country: text(row.location?.country), region: text(row.location?.region), city: text(row.location?.city), countryOnly: row.countryOnly === true,
    })),
    traffic: data?.asn && payload.trafficState === 'ok' && number(payload.traffic?.human) !== undefined && number(payload.traffic?.bot) !== undefined
      ? { human: payload.traffic.human, bot: payload.traffic.bot } : undefined,
    risk,
  });
};

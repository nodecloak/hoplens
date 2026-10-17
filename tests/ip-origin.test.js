// Native/broadcast labels are disclosed country-comparison references, never physical-origin proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveIPOrigin } from '../common/ip-origin.js';
import { createReportLoader } from '../common/ip-report.js';
import { buildIPReport } from '../common/ip-report-model.js';
import { normalizeASNRegistration } from '../common/ip-origin.js';
const now = Date.parse('2026-10-17T00:00:00Z');
const sources = (registered = 'US', first = 'US', second = 'US') => [
  { id: 'network', status: 'ok', observedAt: new Date(now).toISOString(), data: { asn: 402139, asns: [402139] } },
  { id: 'asn-registration', status: 'ok', observedAt: new Date(now).toISOString(), data: { asn: 402139, countryCode: registered } },
  { id: 'ipapi', status: 'ok', observedAt: new Date(now).toISOString(), data: { countryCode: first } },
  { id: 'proxycheck', status: 'ok', observedAt: new Date(now).toISOString(), data: { countryCode: second } },
];
test('agreement returns an explicitly qualified native or broadcast reference', () => {
  const same = deriveIPOrigin(sources(), now), different = deriveIPOrigin(sources('US', 'HK', 'HK'), now);
  assert.equal(same.type, 'native'); assert.equal(different.type, 'broadcast');
  assert.equal(same.reference, true); assert.equal(different.reference, true);
  assert.equal(different.registrationCountry, 'US'); assert.equal(different.locationCountry, 'HK');
});
test('ASN registration is compared to primary IP country, with fallback only when primary is absent', () => {
  assert.equal(deriveIPOrigin(sources('US', 'HK', 'SG'), now).type, 'broadcast');
  assert.equal(deriveIPOrigin(sources('US', null, 'US'), now).type, 'native');
  assert.equal(deriveIPOrigin(sources('US', null, null), now).type, 'unknown');
  const wrongASN=sources();wrongASN[1].data.asn=13335;
  assert.equal(deriveIPOrigin(wrongASN, now).type,'unknown');
  const ambiguous=sources();ambiguous[0].data.asns=[402139,13335];
  assert.equal(deriveIPOrigin(ambiguous,now).type,'unknown');
  const duplicate = sources(); duplicate.push({...duplicate[1]});
  assert.equal(deriveIPOrigin(duplicate,now).type,'unknown');
  const stale = sources(); stale[1].observedAt = new Date(now - 3600000).toISOString();
  assert.equal(deriveIPOrigin(stale, now).type, 'unknown');
  const failed = sources(); failed[1].status = 'error';
  assert.equal(deriveIPOrigin(failed, now).type, 'unknown');
  assert.equal(deriveIPOrigin(sources('EU'), now).type, 'unknown');
  assert.equal(deriveIPOrigin(sources('QQ', 'QQ', 'QQ'), now).type, 'unknown');
});
test('country spelling is normalized and origin comparison never changes risk weights', () => {
  assert.equal(deriveIPOrigin(sources('uk', 'GB', 'gb'), now).type, 'native');
  assert.equal(deriveIPOrigin([], now).type, 'unknown');
});
test('ASN country never falls back to the IP prefix registration country',()=>{
  const rows=sources('US','US','AU');
  rows.push({id:'rdap',status:'ok',observedAt:new Date(now).toISOString(),data:{countryCode:'AU'}});
  const report=buildIPReport('1.1.1.1',rows,now);
  assert.equal(report.profile.origin.type,'native');assert.equal(report.profile.origin.asn,402139);
  rows[1].status='error';assert.equal(buildIPReport('1.1.1.1',rows,now).profile.origin.type,'unknown');
});
test('ASN TXT parser accepts split chunks but rejects mismatches, ambiguous or invalid countries',()=>{
  assert.deepEqual(normalizeASNRegistration([['402139 | US | arin | 2025-01-01 | Exam','ple']],402139),{asn:402139,countryCode:'US'});
  for(const rows of [[['13335 | US | arin | 2020-01-01 | Other']],[['402139 | ZZ | arin | 2020-01-01 | Invalid']],[['402139 | US | arin | 2020-01-01 | A'],['402139 | HK | arin | 2020-01-01 | B']],[]])assert.equal(normalizeASNRegistration(rows,402139),null);
});
test('automatic origin lookup reuses classification sources and never runs the risk pipeline', async () => {
  const calls = [];
  const adapters = Object.fromEntries(sources('US', 'HK', 'HK').map(source => [source.id, async key => { calls.push(source.id); if(source.id==='asn-registration')assert.equal(key,402139);return { status: 'ok', data: source.data }; }]));
  const load = createReportLoader({ adapters, now: () => now, evidence: () => { throw new Error('Risk checks must remain opt-in'); } });
  await load.classification('1.1.1.1');
  const origin = await load.origin('1.1.1.1');
  assert.equal(origin.type, 'broadcast'); assert.equal(origin.ip, '1.1.1.1');
  assert.equal(origin.asn,402139);assert.equal(origin.basis,'asn-registration-geolocation');
  assert.deepEqual(calls.sort(), ['asn-registration', 'ipapi', 'network', 'proxycheck']);
});

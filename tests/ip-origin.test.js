// Native/broadcast labels are disclosed country-comparison references, never physical-origin proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveIPOrigin } from '../common/ip-origin.js';
import { createReportLoader } from '../common/ip-report.js';
const now = Date.parse('2026-10-17T00:00:00Z');
const sources = (registered = 'US', first = 'US', second = 'US') => [
  { id: 'rdap', status: 'ok', observedAt: new Date(now).toISOString(), data: { countryCode: registered } },
  { id: 'ipapi', status: 'ok', observedAt: new Date(now).toISOString(), data: { countryCode: first } },
  { id: 'proxycheck', status: 'ok', observedAt: new Date(now).toISOString(), data: { countryCode: second } },
];
test('agreement returns an explicitly qualified native or broadcast reference', () => {
  const same = deriveIPOrigin(sources(), now), different = deriveIPOrigin(sources('US', 'HK', 'HK'), now);
  assert.equal(same.type, 'native'); assert.equal(different.type, 'broadcast');
  assert.equal(same.reference, true); assert.equal(different.reference, true);
  assert.equal(different.registrationCountry, 'US'); assert.equal(different.locationCountry, 'HK');
});
test('conflicting, missing, duplicate or stale data never becomes a conclusive label', () => {
  assert.equal(deriveIPOrigin(sources('US', 'HK', 'SG'), now).type, 'unknown');
  assert.equal(deriveIPOrigin(sources().slice(0, 2), now).type, 'unknown');
  const duplicate = sources(); duplicate[2].id = 'ipapi';
  assert.equal(deriveIPOrigin(duplicate, now).type, 'unknown');
  const stale = sources(); stale[0].observedAt = new Date(now - 3600000).toISOString();
  assert.equal(deriveIPOrigin(stale, now).type, 'unknown');
  const failed = sources(); failed[2].status = 'error';
  assert.equal(deriveIPOrigin(failed, now).type, 'unknown');
  assert.equal(deriveIPOrigin(sources('EU'), now).type, 'unknown');
  assert.equal(deriveIPOrigin(sources('QQ', 'QQ', 'QQ'), now).type, 'unknown');
});
test('country spelling is normalized and origin comparison never changes risk weights', () => {
  assert.equal(deriveIPOrigin(sources('uk', 'GB', 'gb'), now).type, 'native');
  assert.equal(deriveIPOrigin([], now).type, 'unknown');
});
test('automatic origin lookup reuses classification sources and never runs the risk pipeline', async () => {
  const calls = [];
  const adapters = Object.fromEntries(sources('US', 'HK', 'HK').map(source => [source.id, async () => { calls.push(source.id); return { status: 'ok', data: source.data }; }]));
  const load = createReportLoader({ adapters, now: () => now, evidence: () => { throw new Error('Risk checks must remain opt-in'); } });
  await load.classification('1.1.1.1');
  const origin = await load.origin('1.1.1.1');
  assert.equal(origin.type, 'broadcast'); assert.equal(origin.ip, '1.1.1.1');
  assert.deepEqual(calls.sort(), ['ipapi', 'proxycheck', 'rdap']);
});

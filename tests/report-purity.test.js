// Verify purity report whitelisting, incomplete results, current-IP isolation and masked exports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectScope } from 'vue';
import { REPORT_EVENT_BUILDERS } from '../frontend/utils/report-builders.js';
import { REPORT_VERSION, validateReport, REPORT_SECTION_IDS } from '../common/report-schema.js';
import { buildShareReport, reportToMarkdown } from '../frontend/utils/report-export.js';
import { useReportCollector, useCollectedReport, resetCollectedReport } from '../frontend/composables/use-report-collector.js';
import { emitAppEvent } from '../frontend/utils/app-events.js';
import { purityPayload } from './fixtures/report-purity.js';

const build = payload => REPORT_EVENT_BUILDERS['ippurity:updated'].build(payload);
const envelope = payload => buildShareReport({ sections: { ippurity: { testedAt: '2026-10-17T00:01:00.000Z', ...build(payload) } }, selectedIds: ['ippurity'], maskTail: false, locale: 'zh', origin: 'ip.nodecloak.com' });

test('purity is an optional additive version-2 section after IP info', () => {
  assert.equal(REPORT_VERSION, 2);
  assert.deepEqual(REPORT_SECTION_IDS.slice(0, 2), ['ipinfo', 'ippurity']);
  const report = envelope(purityPayload());
  assert.deepEqual(validateReport(report), { ok: true, errors: [] });
  assert.equal(report.sections.ippurity.risk.score, 10);
  assert.equal(report.sections.ippurity.risk.scoreKind, 'observed');
  assert.equal(report.sections.ippurity.risk.coverage.checked, 6);
  assert.equal(report.sections.ippurity.risk.queriedAt, '2026-10-17T00:00:00.000Z');
});

test('origin reference survives shared exports while stale, wrong-IP and unqualified results are excluded',()=>{
  const payload=purityPayload();
  payload.originState='ok';
  payload.origin={ip:payload.ip,type:'broadcast',reference:true,basis:'registry-geolocation',registrationCountry:'US',locationCountry:'HK',queriedAt:'2026-10-17T00:00:00.000Z',evidence:[{id:'rdap',status:'ok',countryCode:'US'}],apiKey:'PRIVATE-CREDENTIAL'};
  const report=envelope(payload);
  assert.equal(report.sections.ippurity.origin.type,'broadcast');
  assert(!JSON.stringify(report).includes('PRIVATE-CREDENTIAL'));
  assert.deepEqual(validateReport(report),{ok:true,errors:[]});
  assert(reportToMarkdown(report,key=>key).includes('not verify physical routing'));
  for(const patch of [{originState:'loading'},{origin:{...payload.origin,ip:'1.1.1.1'}},{origin:{...payload.origin,reference:false}}])assert.equal(build({...payload,...patch}).origin,undefined);
});

test('purity strips unrelated fields and masks IPs, /32 prefixes, ranges and matched evidence', () => {
  const payload = purityPayload();
  payload.risk.apiKey = 'PRIVATE-CREDENTIAL'; payload.network.credentials = 'PRIVATE-CREDENTIAL';
  const original = envelope(payload);
  const masked = buildShareReport({ sections: original.sections, selectedIds: ['ippurity'], maskTail: true, locale: 'en', origin: 'ip.nodecloak.com' });
  assert(!JSON.stringify(masked).includes('PRIVATE-CREDENTIAL'));
  assert(!JSON.stringify(masked).includes('109.107.137.142'));
  assert.equal(original.sections.ippurity.ip, '109.107.137.142');
  assert.deepEqual(validateReport(masked), { ok: true, errors: [] });
  const markdown = reportToMarkdown(masked, key => key);
  assert(markdown.includes('10') && markdown.includes('Shodan InternetDB') && markdown.includes('observed'));
  assert(!markdown.includes('109.107.137.142'));
  assert.equal(Object.keys(buildShareReport({ sections: original.sections, selectedIds: [], maskTail: false, locale: 'en', origin: 'ip.nodecloak.com' }).sections).length, 0);
});

test('unassessed, loading and failed purity snapshots never inherit an earlier score', () => {
  for (const state of ['pending', 'loading', 'unavailable']) {
    const payload = { ...purityPayload(), riskState: state };
    const section = build(payload);
    assert.equal(section.riskState, state);
    assert.equal(section.risk, undefined);
    assert.deepEqual(validateReport(envelope(payload)), { ok: true, errors: [] });
  }
});

test('mismatched provider IPs are excluded; IPv6 aliases for the same address are accepted', () => {
  const payload = purityPayload();
  payload.ip = '1.1.1.1';
  assert.equal(build(payload).risk, undefined);
  assert.equal(build(payload).network, undefined);
  const v6 = { ...purityPayload(), ip: '2606:4700:4700::1111' };
  v6.risk = { ...v6.risk, ip: '2606:4700:4700:0:0:0:0:1111' };
  assert.equal(build(v6).risk.score, 10);
});

test('collector updates current purity and clears it when the IP is no longer valid', () => {
  resetCollectedReport();
  const scope = effectScope(); scope.run(() => useReportCollector());
  try {
    emitAppEvent('ippurity:updated', purityPayload());
    const { sections } = useCollectedReport();
    assert.equal(sections.ippurity.risk.score, 10);
    emitAppEvent('ippurity:updated', { ...purityPayload(), riskState: 'unavailable', risk: null });
    assert.equal(sections.ippurity.risk, undefined);
    emitAppEvent('ippurity:updated', { ip: '' });
    assert.equal(sections.ippurity, undefined);
  } finally { scope.stop(); resetCollectedReport(); }
});

test('unknown classification falls back to explicit mobile/hosting flags, matching the homepage', () => {
  for (const type of ['mobile', 'hosting']) {
    const section = build({ ip: '1.1.1.1', riskState: 'pending', classification: { usageType: 'unknown', [type]: true } });
    assert.equal(section.usageType, type);
  }
});

test('an observed zero remains distinct from an unavailable score and IPv6 is masked throughout', () => {
  const payload = purityPayload();
  payload.risk.score = 0; payload.risk.level = 'none'; payload.risk.scoreKind = 'complete'; payload.risk.range = { min: 0, max: 0 };
  assert.equal(build(payload).risk.score, 0);
  payload.risk.score = null; payload.risk.level = null; payload.risk.scoreKind = 'unavailable';
  assert.equal(build(payload).risk.score, null);
  const address = '2606:4700:4700::1111';
  payload.ip = address; payload.network = { ip: address, prefix: address+'/128', range: { start: address, end: address } };
  payload.risk.ip = address; payload.risk.checks[0].matchedPrefix = address+'/128';
  const report = envelope(payload);
  const masked = buildShareReport({ sections: report.sections, selectedIds: ['ippurity'], maskTail: true, locale: 'en', origin: 'ip.nodecloak.com' });
  assert(!JSON.stringify(masked).includes(address));
  assert.deepEqual(validateReport(masked), { ok: true, errors: [] });
});

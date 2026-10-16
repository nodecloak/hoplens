// Live overview regression tests: unknown results must stay unknown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDiagnostics } from '../frontend/utils/hoplens-summary.js';

test('empty diagnostics show no address, no privacy verdict and zero completed checks', () => {
  const result = summarizeDiagnostics({}, {});
  assert.equal(result.primary, null);
  assert.equal(result.ipv6, null);
  assert.equal(result.completed, 0);
  assert.equal(result.percent, 0);
  assert.equal(result.rtc, 'pending');
  assert.equal(result.dnsCount, 0);
});

test('an early source can show the address while the complete IP check is still pending', () => {
  const result = summarizeDiagnostics({ ipinfo: { cards: [{ ip: '1.1.1.1', source: 'Hoplens edge' }] } }, { IPInfo: false });
  assert.equal(result.primary.ip, '1.1.1.1');
  assert.equal(result.completed, 0);
  assert.equal(result.percent, 0);
});

test('IPv6 is not considered an IPv4 mismatch and duplicate source IPs remain observations', () => {
  const result = summarizeDiagnostics({ ipinfo: { cards: [
    { ip: '8.8.8.8', source: 'one' }, { ip: '2606:4700:4700::1111', source: 'two' },
    { ip: '8.8.8.8', source: 'three' }, { ip: '1.1.1.1', source: 'four' },
    { ip: 'Lookup failed', source: 'five' },
  ] } }, { IPInfo: true });
  assert.equal(result.primary.ip, '8.8.8.8');
  assert.equal(result.ipv6.ip, '2606:4700:4700::1111');
  assert.equal(result.addressCount, 4);
  assert.equal(result.routeDifferences, 1);
  assert.equal(result.completed, 1);
});

test('a local WebRTC address is visible but failed probes do not imply privacy', () => {
  assert.equal(summarizeDiagnostics({ webrtc: { servers: [{ ip: '192.168.1.20', natType: 'host' }] } }, {}).rtc, 'local');
  assert.equal(summarizeDiagnostics({ webrtc: { servers: [{ natType: 'unavailable' }] } }, { WebRTC: true }).rtc, 'unavailable');
  assert.equal(summarizeDiagnostics({}, { WebRTC: true }).rtc, 'unavailable');
});

test('different public WebRTC paths are identified within the same address family', () => {
  const base = { ipinfo: { cards: [{ ip: '8.8.8.8' }] }, webrtc: { servers: [{ ip: '1.1.1.1', natType: 'srflx' }] } };
  assert.equal(summarizeDiagnostics(base, {}).rtc, 'different');
  base.webrtc.servers[0].ip = '2606:4700:4700::1111';
  assert.equal(summarizeDiagnostics(base, {}).rtc, 'visible');
});

test('DNS discoveries are unique resolver addresses, not an invented clean verdict', () => {
  const result = summarizeDiagnostics({ dnsleak: { providers: [{ ip: '8.8.8.8' }, { ip: '8.8.8.8' }, { ip: '1.1.1.1' }, { ip: 'failed' }] }, connectivity: { targets: [{ status: 'ok' }] } }, { DNSLeakTest: true, Connectivity: true });
  assert.equal(result.dnsCount, 2);
  assert.equal(result.completed, 2);
  assert.equal(result.percent, 50);
  assert.equal(Object.hasOwn(result, 'privacyScore'), false);
});

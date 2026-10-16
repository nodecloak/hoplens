// Same-origin Cloudflare trace source validation and failure handling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ipnodecloakEdge } from '../frontend/utils/getips/ipnodecloak-edge.js';

test('reads the visitor address from the same-origin edge trace without caching it', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/cdn-cgi/trace');
    assert.equal(options.cache, 'no-store');
    return new Response('fl=abc\nip=2606:4700:4700::1111\nloc=SG\n');
  };
  assert.equal(await ipnodecloakEdge.run(), '2606:4700:4700::1111');
});

test('a missing or failing trace cannot be displayed as a visitor address', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response('<html>app shell</html>');
  await assert.rejects(ipnodecloakEdge.run());
  globalThis.fetch = async () => new Response('ip=8.8.8.8', { status: 503 });
  await assert.rejects(ipnodecloakEdge.run());
});

// Manual lookup accepts only a selected public IP, separate from visitor diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIPLookupQuery } from '../frontend/utils/ip-lookup-query.js';

test('accepts a public IPv4 and trims pasted whitespace', () => {
    assert.deepEqual(parseIPLookupQuery('  1.1.1.1\n'), { ip: '1.1.1.1', error: '' });
});

test('accepts public IPv6 without splitting its colons', () => {
    assert.deepEqual(parseIPLookupQuery(' 2606:4700:4700::1111 '), { ip: '2606:4700:4700::1111', error: '' });
});

test('rejects malformed input, URLs, hostnames and query-string injection', () => {
    for (const value of ['', ' ', '999.1.1.1', 'https://1.1.1.1', 'example.com', '1.1.1.1&q=8.8.8.8', '1.1.1.1:80', '1.1.1.1/24']) {
        assert.deepEqual(parseIPLookupQuery(value), { ip: '', error: 'ipcheck.Error' }, value);
    }
});

test('explains private, loopback and reserved IPs without querying providers', () => {
    for (const value of ['192.168.10.1', '127.0.0.1', '0.0.0.0', '::1', 'fd00::1', '2001:db8::1']) {
        assert.deepEqual(parseIPLookupQuery(value), { ip: '', error: 'ipcheck.reservedIP' }, value);
    }
});

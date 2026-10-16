// Representative same-IP homepage intelligence snapshot for report privacy and lifecycle tests.
export const purityPayload = () => ({
  ip: '109.107.137.142', networkState: 'ok', trafficState: 'ok', riskState: 'partial',
  network: { ip: '109.107.137.142', asn: 3258, asnName: 'Example network', asnSource: 'RIPEstat', domain: 'example.net', prefix: '109.107.137.142/32', range: { start: '109.107.137.142', end: '109.107.137.142' } },
  classification: { usageType: 'hosting', usageTypeSource: 'proxycheck.io', proxy: false },
  traffic: { human: 20, bot: 80 },
  locations: [{ id: 'whois', name: 'IPWhois', status: 'ok', location: { countryCode: 'JP', country: 'Japan', region: 'Tokyo', city: 'Tokyo' } }, { id: 'maxmind', name: 'MaxMind', status: 'unavailable', location: null }],
  risk: { ip: '109.107.137.142', model: 'nodecloak-ip-risk-v2', score: 10, scoreKind: 'observed', level: 'low', queriedAt: '2026-10-17T00:00:00.000Z', range: { min: 10, max: 20 }, coverage: { checked: 6, total: 7 }, usageType: 'hosting', usageTypeSource: 'proxycheck.io',
    checks: [{ id: 'hosting', source: 'IP-API / proxycheck.io', maxPoints: 10, points: 10, hit: true, status: 'ok', asOf: '2026-10-17T00:00:00.000Z' }, { id: 'services', source: 'Shodan InternetDB', maxPoints: 10, points: 0, hit: null, status: 'missing', asOf: null }, { id: 'drop', source: 'Spamhaus DROP', maxPoints: 70, points: 0, hit: false, status: 'ok', matchedPrefix: '109.107.137.142/32', copyright: '(c) The Spamhaus Project' }] },
});

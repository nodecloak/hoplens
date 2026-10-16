// Public-IP intelligence must preserve unknowns, source identity and address boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNetwork, normalizeLocation, normalizeTraffic, createCachedLoader } from '../common/ip-intelligence.js';

test('routing metadata reports the actual containing prefix and both range endpoints', () => {
  const data = normalizeNetwork('157.254.32.95', { data: { prefix:'157.254.32.0/23', asns:[402139] } }, { ip:'157.254.32.95',success:true,connection:{asn:402139,org:'Peekabo Networks',domain:'peekabo.io'},country_code:'HK',city:'Central' });
  assert.equal(data.asn,402139);
  assert.equal(data.domain,'peekabo.io');
  assert.deepEqual(data.range,{start:'157.254.32.0',end:'157.254.33.255'});
});
test('wrong-IP locations and unrelated routing prefixes are discarded', () => {
  assert.equal(normalizeLocation({ip:'1.1.1.1',country_code:'AU'},'8.8.8.8'),null);
  const data = normalizeNetwork('8.8.8.8',{data:{prefix:'1.1.1.0/24',asns:[13335]}},null);
  assert.equal(data.prefix,null);
  assert.equal(data.asn,null);
});
test('an ASN domain is not borrowed from a disagreeing geolocation ASN', () => {
  const data = normalizeNetwork('8.8.8.8',{data:{prefix:'8.8.8.0/24',asns:[15169]}},{ip:'8.8.8.8',success:true,connection:{asn:13335,domain:'cloudflare.com'}},()=> 'Google LLC');
  assert.equal(data.domain,null);
  assert.equal(data.asnName,'Google LLC');
});
test('IPv6 spellings compare semantically and ranges retain all address bits', () => {
  assert.ok(normalizeLocation({ip:'2606:4700:4700:0:0:0:0:1111',country_code:'US'},'2606:4700:4700::1111'));
  const data = normalizeNetwork('2606:4700:4700::1111',{data:{prefix:'2606:4700:4700::/48',asns:[13335]}},null);
  assert.equal(data.range.end,'2606:4700:4700:ffff:ffff:ffff:ffff:ffff');
});
test('ASN traffic accepts 0%, rejects incomplete/inconsistent percentages', () => {
  assert.deepEqual(normalizeTraffic({Human_Pct:'0.00%',Bot_Pct:'100.00%'}),{human:0,bot:100});
  assert.equal(normalizeTraffic({Human_Pct:'',Bot_Pct:'100%'}),null);
  assert.equal(normalizeTraffic({Human_Pct:'20%',Bot_Pct:'20%'}),null);
});
test('bounded cache coalesces identical requests but keeps distinct IPs independent', async () => {
  let calls=0;
  const load=createCachedLoader(async ip=>{calls++;await new Promise(r=>setTimeout(r,5));return {ip};},{maxEntries:2,ttlMs:100});
  const both=await Promise.all([load('8.8.8.8'),load('8.8.8.8')]);
  assert.equal(calls,1); assert.equal(both[0],both[1]);
  await load('1.1.1.1'); await load('9.9.9.9'); await load('8.8.8.8');
  assert.equal(calls,4);
});

// First-party scoring keeps evidence coverage distinct from the heuristic rule total.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreIPRisk, parseDropSnapshot, parseTorSnapshot, matchRiskSnapshot } from '../common/ip-risk-score.js';
const now=Date.parse('2026-10-16T06:00:00Z'),asOf=new Date(now).toISOString();
const evidence=()=>({drop:{status:'ok',hit:false,asOf},tor:{status:'ok',hit:false,asOf},classification:{status:'success',query:'8.8.8.8',proxy:false,hosting:false,mobile:false,asOf}});

test('all known negative observations produce an exact zero and complete coverage',()=>{
  const result=scoreIPRisk('8.8.8.8',evidence(),now);
  assert.equal(result.score,0);assert.equal(result.model,'nodecloak-ip-risk-v1');
  assert.deepEqual(result.coverage,{checked:4,total:4});assert.equal(result.status,'ok');
});
test('Tor and proxy are one category and are not double counted',()=>{
  const data=evidence();data.drop.hit=true;data.tor.hit=true;data.classification.proxy=true;data.classification.hosting=true;
  const result=scoreIPRisk('8.8.8.8',data,now);
  assert.equal(result.score,100);
  assert.equal(result.checks.find(row=>row.id==='proxy').points,0);
  assert.equal(result.checks.find(row=>row.id==='proxy').suppressedBy,'tor');
});
test('hosting is a small explicit network characteristic rather than a high-risk verdict',()=>{
  const data=evidence();data.classification.hosting=true;
  const result=scoreIPRisk('8.8.8.8',data,now);
  assert.equal(result.score,10);assert.equal(result.level,'low');assert.equal(result.usageType,'hosting');
});
test('missing and stale sources never create an exact low-risk score',()=>{
  for(const missing of [null,{status:'ok',hit:false,asOf:'2026-10-10T00:00:00Z'}]) {
    const data=evidence();data.drop=missing;
    const result=scoreIPRisk('8.8.8.8',data,now);
    assert.equal(result.score,null);assert.equal(result.status,'partial');assert.equal(result.coverage.checked,3);
  }
});
test('wrong-IP or absent classification flags remain unknown',()=>{
  const data=evidence();data.classification.query='1.1.1.1';
  assert.equal(scoreIPRisk('8.8.8.8',data,now).coverage.checked,2);
  data.classification={status:'success',query:'8.8.8.8',asOf};
  assert.equal(scoreIPRisk('8.8.8.8',data,now).score,null);
});
test('IPv6 does not turn an IPv4-only Tor snapshot into a negative observation',()=>{
  const data=evidence();data.classification.query='2606:4700:4700::1111';data.tor={status:'unsupported',asOf};
  const result=scoreIPRisk('2606:4700:4700::1111',data,now);
  assert.equal(result.score,null);assert.equal(result.checks.find(row=>row.id==='tor').status,'unsupported');
});
test('DROP JSONL requires valid same-family CIDRs and retains metadata attribution',()=>{
  const meta={type:'metadata',timestamp:now/1000,records:1,copyright:'(c) 2026 The Spamhaus Project SLU'};
  const data=parseDropSnapshot(JSON.stringify({cidr:'8.8.8.0/24',sblid:'SBL123'})+'\n'+JSON.stringify(meta),4);
  assert.equal(data.copyright,meta.copyright);assert.equal(data.asOf,asOf);assert.equal(data.prefixes[0],'8.8.8.0/24');
  assert.throws(()=>parseDropSnapshot('{"cidr":"8.8.8.0/999"}\n'+JSON.stringify(meta),4));
  assert.throws(()=>parseDropSnapshot('{"cidr":"::/0"}\n'+JSON.stringify(meta),4));
  assert.throws(()=>parseDropSnapshot('{"cidr":"8.8.8.0/24"}',4));
  assert.throws(()=>parseDropSnapshot('<html>error</html>',4));
});
test('Tor snapshot parses canonical exit addresses and refuses empty/error pages',()=>{
  const text='ExitNode ABC\nPublished 2026-10-16 05:00:00\nLastStatus 2026-10-16 05:00:00\nExitAddress 8.8.8.8 2026-10-16 05:30:00\n';
  const data=parseTorSnapshot(text);
  assert.ok(data.addresses.has('4:134744072'));assert.equal(data.asOf,'2026-10-16T05:30:00.000Z');
  assert.throws(()=>parseTorSnapshot('ExitNode ABC\n'));
  assert.throws(()=>parseTorSnapshot(text+'ExitAddress invalid 2026-10-16 05:00:00\n'));
});

test('snapshot matching uses CIDR containment and stale/future data never becomes a negative match',()=>{
  const snapshot={kind:'drop',prefixes:['8.8.8.0/24'],asOf,copyright:'Source copyright'};
  assert.equal(matchRiskSnapshot(snapshot,'8.8.8.8',now).matchedPrefix,'8.8.8.0/24');
  assert.equal(matchRiskSnapshot(snapshot,'8.8.9.8',now).hit,false);
  assert.equal(matchRiskSnapshot(snapshot,'8.8.9.8',now+49*3600000).status,'stale');
  assert.equal(matchRiskSnapshot(snapshot,'8.8.9.8',now-3600000).status,'stale');
});

test('DROP accepts separate source records sharing a CIDR and deduplicates only lookup storage',()=>{
  const rows=[{cidr:'8.8.8.0/24',sblid:'SBL1'},{cidr:'8.8.8.0/24',sblid:'SBL2'},{type:'metadata',timestamp:now/1000,records:2,copyright:'(c) Source'}];
  assert.deepEqual(parseDropSnapshot(rows.map(row=>JSON.stringify(row)).join('\n'),4).prefixes,['8.8.8.0/24']);
});

test('an individual old Tor observation is stale even when other exits have recent observations',()=>{
  const snapshot=parseTorSnapshot('ExitAddress 8.8.8.8 2026-10-10 00:00:00\nExitAddress 1.1.1.1 2026-10-16 05:30:00\n');
  assert.equal(matchRiskSnapshot(snapshot,'8.8.8.8',now).status,'stale');
  assert.equal(matchRiskSnapshot(snapshot,'1.1.1.1',now).hit,true);
});

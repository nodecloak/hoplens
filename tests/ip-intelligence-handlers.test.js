// Public intelligence handlers use fixed providers and retain explicit partial/limited states.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import networkHandler from '../api/network-info.js';
import riskHandler from '../api/ip-risk.js';
import geoHandler from '../api/ipapi-com.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});

test('network overview retains valid routing when geolocation fails', async()=>{
  const calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));return String(url).includes('stat.ripe.net')?Response.json({data:{prefix:'9.9.9.0/24',asns:[19281]}}):new Response('',{status:503});};
  const res=response();await networkHandler({query:{ip:'9.9.9.9'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.asn,19281);
  assert.equal(res.body.status.routing,'ok');assert.equal(res.body.status.whois,'unavailable');
  assert.equal(calls.length,2);
});

test('public purity never retries a provider verification challenge', async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
  const res=response();await riskHandler({query:{ip:'9.9.9.9'}},res);
  assert.equal(res.body.status,'limited');assert.equal(res.body.purity,undefined);assert.equal(calls,1);
});

test('public purity rejects a report for the wrong IP', async()=>{
  globalThis.fetch=async()=>Response.json({ip:'8.8.8.8',risk:{purity:100}});
  const res=response();await riskHandler({query:{ip:'1.0.0.1'}},res);
  assert.equal(res.body.status,'unavailable');assert.equal(res.body.purity,undefined);
});

test('IP-API preserves only explicit classification flags and keeps unknowns absent', async()=>{
  globalThis.fetch=async()=>Response.json({query:'8.8.8.8',hosting:false,proxy:true});
  const res=response();await geoHandler({query:{ip:'8.8.8.8'}},res);
  assert.equal(res.body.isHosting,false);assert.equal(res.body.isProxy,true);assert.equal(res.body.isMobile,undefined);
});

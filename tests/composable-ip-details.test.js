// Independent IP detail requests must not leak stale addresses or mistake missing data for a clean result.
import test from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, ref, nextTick } from 'vue';
import { useIPDetails } from '../frontend/composables/use-ip-details.js';

const flush = async () => { await nextTick(); await new Promise(resolve => setImmediate(resolve)); };
const setup = (deps, settings={}) => {
  const scope=effectScope(),ip=ref('8.8.8.8');
  const data=scope.run(()=>useIPDetails(ip,ref(settings),deps));
  return {scope,ip,...data};
};

test('IP detail source failures stay independent and unconfigured sources never run', async () => {
  const urls=[];
  const state=setup({getTrace:async()=>({ip:'1.1.1.1',loc:'US'}),getJSON:async url=>{
    urls.push(url);
    if(url.includes('network-info')) throw new Error('routing unavailable');
    return {ip:'8.8.8.8',country_code:'US',isHosting:false};
  }});
  try {
    await flush();
    assert.equal(state.networkState.value,'unavailable');
    assert.equal(state.locations.value.find(row=>row.id==='cloudflare').status,'different');
    assert.equal(state.locations.value.find(row=>row.id==='ipsb').status,'ok');
    assert.equal(state.locations.value.find(row=>row.id==='ipinfo').status,'disabled');
    assert.equal(state.classification.value.hosting,false);
    assert.equal(urls.length,3);
    assert.equal(state.riskState.value,'pending');
    assert.equal(urls.some(url=>url.includes('ip-risk')),false);
  } finally {state.scope.stop();}
});

test('late network and purity responses from a previous IP are ignored', async () => {
  let finishNetwork,finishRisk;
  const state=setup({getTrace:async()=>({ip:'8.8.8.8',loc:'US'}),getJSON:async url=>{
    if(url.includes('ip-risk')) return new Promise(resolve=>{finishRisk=resolve;});
    if(url.includes('network-info')&&url.includes('8.8.8.8')) return new Promise(resolve=>{finishNetwork=resolve;});
    return {ip:'1.1.1.1',country_code:'AU',asn:13335};
  }});
  try {
    const riskRequest=state.requestRisk();
    state.ip.value='1.1.1.1';await flush();
    finishNetwork({ip:'8.8.8.8',asn:15169});
    finishRisk({ip:'8.8.8.8',status:'ok',score:10});
    await riskRequest;await flush();
    assert.equal(state.network.value.ip,'1.1.1.1');
    assert.equal(state.network.value.asn,13335);
    assert.equal(state.risk.value,null);
    assert.equal(state.riskState.value,'pending');
    assert.equal(state.locations.value.find(row=>row.id==='cloudflare').status,'different');
  } finally {state.scope.stop();}
});

test('manual risk assessment preserves incomplete evidence and valid zero scores', async () => {
  let status='partial',riskCalls=0;
  const state=setup({getTrace:async()=>({ip:'8.8.8.8',loc:'US'}),getJSON:async url=>{
    if(url.includes('ip-risk')) {riskCalls++;return {ip:'8.8.8.8',status,score:status==='ok'?0:null};}
    return {ip:'8.8.8.8'};
  }});
  try {
    await flush();assert.equal(riskCalls,0);
    await state.requestRisk();assert.equal(state.riskState.value,'partial');assert.equal(state.risk.value.score,null);
    status='ok';await state.requestRisk();assert.equal(state.risk.value.score,0);
    state.scope.stop();await state.requestRisk();assert.equal(riskCalls,2);
  } finally {state.scope.stop();}
});

// Inline IP metadata: independent source states, explicit risk requests and cancellation on IP changes.
import { ref, shallowRef, watch, toValue, onScopeDispose } from 'vue';
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js';
import { normalizeLocation, normalizeTraffic } from '../utils/ip-intelligence.js';
import { parseTrace } from '../utils/parse-trace.js';
import { isUsablePublicIP } from '../utils/valid-ip.js';
import { parseIp } from '../../common/ip-math.js';

const readJSON=async(url,signal,timeoutMs=10000)=>{
  const response=await fetchWithTimeout(url,{signal,timeoutMs});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
const readTrace=async signal=>{
  const response=await fetchWithTimeout('/cdn-cgi/trace',{signal,cache:'no-store'});
  if(!response.ok) throw new Error('Trace unavailable');
  return parseTrace(await response.text());
};
const sources=[
  {id:'cloudflare',name:'Cloudflare'}, {id:'whois',name:'IPWhois'},
  {id:'ipapicom',name:'IP-API'}, {id:'ipsb',name:'IP.SB'},
  {id:'ipinfo',name:'IPInfo.io',config:'ipInfo'},
  {id:'ip2location',name:'IP2Location',config:'ip2location'},
  {id:'maxmind',name:'MaxMind',config:'maxMind'},
];
const sameIP=(a,b)=>{const x=parseIp(a),y=parseIp(b);return !!x&&!!y&&x.family===y.family&&x.value===y.value;};

export const useIPDetails=(ip,configs,{getJSON=readJSON,getTrace=readTrace}={})=>{
  const network=shallowRef(null),locations=ref([]),classification=ref({}),traffic=ref(null),risk=ref(null);
  const networkState=ref('pending'),trafficState=ref('disabled'),riskState=ref('pending'),revision=ref(0);
  let controller=null;
  const updateRow=(id,patch)=>{locations.value=locations.value.map(row=>row.id===id?{...row,...patch}:row);};
  watch([()=>toValue(ip),()=>toValue(configs),revision],([selected,settings],_,onCleanup)=>{
    controller?.abort();
    const current=new AbortController();controller=current;
    const {signal}=current;
    onCleanup(()=>current.abort());
    network.value=null;classification.value={};traffic.value=null;risk.value=null;riskState.value='pending';
    networkState.value=isUsablePublicIP(selected)?'loading':'pending';
    trafficState.value=settings?.cloudFlare?'pending':'disabled';
    locations.value=sources.map(source=>({...source,status:source.config&&!settings?.[source.config]?'disabled':networkState.value,location:null}));
    if(!isUsablePublicIP(selected)) return;
    const query=encodeURIComponent(selected);
    const task=async(id,load)=>{
      try { const patch=await load();if(!signal.aborted) updateRow(id,patch); }
      catch { if(!signal.aborted) { updateRow(id,{status:'unavailable'}); if(id==='whois') {networkState.value='unavailable';if(settings?.cloudFlare) trafficState.value='unavailable';} } }
    };
    task('cloudflare',async()=>{
      const trace=await getTrace(signal);
      if(!sameIP(trace.ip,selected)) return {status:'different'};
      return /^[A-Z]{2}$/i.test(trace.loc||'')?{status:'ok',location:{countryCode:trace.loc.toUpperCase()},countryOnly:true}:{status:'unavailable'};
    });
    task('whois',async()=>{
      const data=await getJSON(`/api/network-info?ip=${query}`,signal);
      if(signal.aborted) return {};
      if(!sameIP(data.ip,selected)) throw new Error('Address mismatch');
      network.value=data;networkState.value=data.asn||data.prefix?'ok':'unavailable';
      if(settings?.cloudFlare&&data.asn) {
        trafficState.value='loading';
        getJSON(`/api/cfradar?view=asn&asn=${data.asn}`,signal).then(body=>{
          if(signal.aborted) return;
          traffic.value=normalizeTraffic(body);trafficState.value=traffic.value?'ok':'unavailable';
        }).catch(()=>{if(!signal.aborted) trafficState.value='unavailable';});
      } else if(settings?.cloudFlare) trafficState.value='unavailable';
      return {status:data.location?'ok':'unavailable',location:data.location};
    });
    for(const source of sources.filter(source=>!['cloudflare','whois'].includes(source.id))) {
      if(source.config&&!settings?.[source.config]) continue;
      task(source.id,async()=>{
        const body=await getJSON(`/api/${source.id}?ip=${query}`,signal);
        const location=normalizeLocation(body,selected);
        if(source.id==='ipapicom'&&!signal.aborted&&sameIP(body.ip,selected)) {
          classification.value={hosting:typeof body.isHosting==='boolean'?body.isHosting:null,mobile:typeof body.isMobile==='boolean'?body.isMobile:null,proxy:typeof body.isProxy==='boolean'?body.isProxy:null};
        }
        return {status:location?'ok':'unavailable',location};
      });
    }
  },{immediate:true});
  const requestRisk=async()=>{
    const selected=toValue(ip),current=controller;
    if(!current||current.signal.aborted||!isUsablePublicIP(selected)||riskState.value==='loading') return;
    risk.value=null;riskState.value='loading';
    try {
      const body=await getJSON(`/api/ip-risk?ip=${encodeURIComponent(selected)}`,current.signal,15000);
      if(current.signal.aborted) return;
      if(!sameIP(body.ip,selected)) throw new Error('Address mismatch');
      risk.value=['ok','partial'].includes(body.status)?body:null;
      riskState.value=['ok','partial'].includes(body.status)?body.status:'unavailable';
    } catch {if(!current.signal.aborted) riskState.value='unavailable';}
  };
  onScopeDispose(()=>controller?.abort());
  return {network,locations,classification,traffic,risk,networkState,trafficState,riskState,refresh:()=>revision.value++,requestRisk};
};

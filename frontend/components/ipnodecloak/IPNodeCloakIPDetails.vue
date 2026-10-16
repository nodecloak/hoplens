<!-- Always-visible IP intelligence: routing, source-labelled locations, classification and optional public scores. -->
<template>
  <section id="IPPurity" class="hl-ip-details" aria-labelledby="hl-ip-details-title">
    <header class="hl-detail-header"><div><h2 id="hl-ip-details-title">{{ t('ipDetails.title') }}</h2><p>{{ t('ipDetails.note') }}</p></div><Button variant="outline" size="icon" :disabled="!valid" :aria-label="t('ipDetails.refresh')" @click="refresh"><RefreshCw :class="{'animate-spin':networkState==='loading'}" /></Button></header>
    <div class="hl-intelligence-grid">
      <div>
        <dl class="hl-network-facts">
          <div><dt>IP</dt><dd class="hl-mono" :data-mask="valid?'ip':undefined">{{ ip || '—' }}</dd></div>
          <div><dt>ASN</dt><dd><a v-if="network?.asn" :href="`/tools/asn?q=AS${network.asn}`" class="hl-detail-link"><span class="hl-mono">AS{{ network.asn }}</span><ArrowUpRight /></a><span v-else>{{ statusLabel(networkState) }}</span><span class="hl-detail-org" v-if="network?.asnName">{{ network.asnName }}</span></dd></div>
          <div><dt>{{ t('ipDetails.domain') }}</dt><dd><a v-if="network?.domain" :href="'https://'+network.domain" target="_blank" rel="noopener" class="hl-detail-link hl-mono">{{ network.domain }}<ArrowUpRight /></a><span v-else>{{ statusLabel(networkState==='ok'?'unknown':networkState) }}</span></dd></div>
          <div><dt>{{ t('ipDetails.prefix') }}</dt><dd class="hl-mono" :data-mask="network?.prefix?'ip':undefined">{{ network?.prefix || statusLabel(networkState==='ok'?'unknown':networkState) }}</dd></div>
          <div><dt>{{ t('ipDetails.range') }}</dt><dd class="hl-mono" :data-mask="network?.range?'ip':undefined">{{ network?.range ? network.range.start+' – '+network.range.end : statusLabel(networkState==='ok'?'unknown':networkState) }}</dd></div>
        </dl>
        <p class="hl-source-caption" v-if="network?.asn">ASN: {{ network.asnSource }}<template v-if="network.prefix"> · {{ t('ipDetails.routingSource') }}</template></p>
        <div class="hl-traffic-block">
          <div class="hl-fact-heading"><h3>{{ t('ipDetails.traffic') }}</h3></div>
          <template v-if="traffic"><div class="hl-traffic-bar" role="img" :aria-label="t('ipDetails.trafficValues',{human:traffic.human,bot:traffic.bot})"><span :style="{width:traffic.human+'%'}"/><span :style="{width:traffic.bot+'%'}"/></div><div class="hl-traffic-values hl-mono"><span>{{ t('ipDetails.human') }} {{ traffic.human.toFixed(2) }}%</span><span>{{ t('ipDetails.bot') }} {{ traffic.bot.toFixed(2) }}%</span></div></template>
          <p v-else class="hl-detail-empty">{{ statusLabel(trafficState) }}</p>
        </div>
        <div class="hl-geography-block"><h3>{{ t('ipDetails.locations') }}</h3><p class="hl-source-caption">{{ t('ipDetails.locationNote') }}</p><dl class="hl-location-list"><div v-for="source in locations" :key="source.id"><dt>{{ source.name }}</dt><dd v-if="source.status==='ok'&&source.location"><Icon v-if="source.location.countryCode" :icon="'circle-flags:'+source.location.countryCode.toLowerCase()" class="size-4 shrink-0"/><span>{{ locationText(source.location) }}<small v-if="source.countryOnly"> · {{ t('ipDetails.countryOnly') }}</small></span></dd><dd v-else class="hl-detail-empty">{{ statusLabel(source.status) }}</dd></div></dl></div>
      </div>
      <aside class="hl-reputation-column">
        <div class="hl-classification-grid"><div><span><Network />{{ t('ipDetails.type') }}</span><strong>{{ t('ipDetails.'+usage) }}</strong><small v-if="usage!=='unknown'">{{ risk?.usageTypeSource || classification.usageTypeSource || 'IP-API' }}</small></div><div><span><Route />{{ t('ipRisk.proxyMarker') }}</span><strong>{{ t(proxyFlag===true?'ipDetails.proxy':proxyFlag===false?'ipRisk.noProxyMarker':'ipDetails.unknown') }}</strong></div></div>
        <IPNodeCloakRiskScore :ip="ip" :result="risk" :state="riskState" :valid="valid" @check="requestRisk" />
      </aside>
    </div>
  </section>
</template>
<script setup>
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { useIPDetails } from '@/composables/use-ip-details.js';
import { isUsablePublicIP } from '@/utils/valid-ip.js';
import { emitAppEvent } from '@/utils/app-events.js';
import IPNodeCloakRiskScore from './IPNodeCloakRiskScore.vue';
import { Button } from '@/components/ui/button';
import { Icon } from '@iconify/vue';
import { ArrowUpRight, RefreshCw, Route, Network } from '@lucide/vue';
const props=defineProps({ip:{type:String,default:''}});
const emit=defineEmits(['network']);
const {t,locale}=useI18n();
const store=useMainStore();
const valid=computed(()=>isUsablePublicIP(props.ip));
const {network,locations,classification,traffic,risk,networkState,trafficState,riskState,refresh,requestRisk}=useIPDetails(()=>props.ip,()=>store.configs);
watch([()=>props.ip,network,locations,classification,traffic,risk,networkState,trafficState,riskState],()=>{
  emitAppEvent('ippurity:updated',{ip:props.ip,network:network.value,locations:locations.value,classification:classification.value,traffic:traffic.value,risk:risk.value,networkState:networkState.value,trafficState:trafficState.value,riskState:riskState.value});
},{immediate:true,deep:true});
watch(network,value=>emit('network',value));
const proxyFlag=computed(()=>risk.value?.checks?.find(check=>check.id==='proxy')?.hit??classification.value.proxy??null);
const usage=computed(()=>risk.value?.usageType&&risk.value.usageType!=='unknown'?risk.value.usageType:classification.value.usageType&&classification.value.usageType!=='unknown'?classification.value.usageType:classification.value.mobile===true?'mobile':classification.value.hosting===true?'hosting':'unknown');
const statusLabel=state=>t('ipDetails.'+(['loading','disabled','different','unavailable','unknown'].includes(state)?state:'pending'));
const locationText=location=>{
  let country=location.country;
  if(!country&&location.countryCode) {try {country=new Intl.DisplayNames([locale.value],{type:'region'}).of(location.countryCode);}catch {country=location.countryCode;}}
  return [...new Set([country,location.region,location.city].filter(Boolean))].join(', ')||'—';
};
</script>

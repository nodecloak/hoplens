<!-- Public-address hero and honest test coverage derived from actual diagnostic events. -->
<template>
  <section class="hl-hero" aria-labelledby="hl-public-address">
    <div class="hl-hero-main">
      <p class="hl-eyebrow"><span class="hl-live-dot" />{{ t('ipnodecloak.live') }}</p>
      <h1 id="hl-public-address" class="hl-public-ip" :class="{ 'hl-ipv6': summary.primary?.ip.includes(':'), 'hl-empty-ip': !summary.primary }" :data-mask="summary.primary ? 'ip' : undefined">{{ summary.primary?.ip || '—' }}</h1>
      <div class="hl-chips" v-if="summary.primary">
        <span v-if="summary.primary.city || summary.primary.countryCode">{{ [summary.primary.city, summary.primary.countryCode].filter(Boolean).join(', ') }}</span>
        <span v-if="primaryNetwork">{{ primaryNetwork }}</span>
        <span class="hl-mono" v-if="summary.ipv6" data-mask="ip">{{ summary.ipv6.ip }}</span>
      </div>
      <p v-else class="hl-hero-pending" role="status">{{ t(store.loadingStatus.IPInfo ? 'ipnodecloak.unavailable' : 'ipnodecloak.sourceLoading') }}</p>
      <div class="hl-hero-actions">
        <Button class="hl-copy-button" :disabled="!summary.primary" @click="copyIP"><Check v-if="copied" /><Copy v-else />{{ t(copied ? 'ipnodecloak.copied' : 'ipnodecloak.copyIP') }}</Button>
        <Button variant="outline" :disabled="!summary.primary" @click="emit('share-report')"><Share2 />{{ t('ipnodecloak.report') }}</Button>
        <Button variant="outline" size="icon" :aria-label="t('ipnodecloak.query')" @click="emit('query-ip')"><Search /></Button>
        <slot name="history" />
        <Button variant="outline" size="icon" :aria-label="t('ipnodecloak.settings')" @click="store.toggleSheet('preferences')"><Settings2 /></Button>
      </div>
    </div>
    <aside class="hl-overview-card" :aria-label="t('ipnodecloak.progress')">
      <div class="hl-overview-heading"><span>{{ t('ipnodecloak.progress') }}</span><span class="hl-mono">{{ summary.completed }} / {{ summary.total }}</span></div>
      <div class="hl-overview-ring-row">
        <svg class="hl-progress-ring" viewBox="0 0 120 120" role="img" :aria-label="t('ipnodecloak.completed', { count: summary.completed, total: summary.total })"><circle class="hl-ring-track" cx="60" cy="60" r="48" /><circle class="hl-ring-value" cx="60" cy="60" r="48" :stroke-dasharray="`${summary.percent * 3.016} 301.6`" /><text x="60" y="67" text-anchor="middle">{{ summary.completed }}<tspan class="hl-ring-total">/{{ summary.total }}</tspan></text></svg>
        <div><h2>{{ t(summary.completed === 4 ? 'ipnodecloak.resultsReady' : 'ipnodecloak.connectionSnapshot') }}</h2><p>{{ t('ipnodecloak.summaryNote') }}</p></div>
      </div>
      <dl class="hl-overview-grid">
        <div><dt>DNS</dt><dd>{{ summary.dnsCount ? t('ipnodecloak.resolvers', { count: summary.dnsCount }) : t(attempted.DNSLeakTest ? 'ipnodecloak.unavailable' : 'ipnodecloak.pending') }}</dd></div>
        <div><dt>WebRTC</dt><dd :class="{ 'hl-warning': ['local', 'different'].includes(summary.rtc) }">{{ t('ipnodecloak.rtc_' + summary.rtc) }}</dd></div>
        <div><dt>{{ t('ipnodecloak.routes') }}</dt><dd>{{ summary.addressCount ? (summary.routeDifferences ? t('ipnodecloak.differentCount', { count: summary.routeDifferences }) : t('ipnodecloak.consistent')) : t('ipnodecloak.pending') }}</dd></div>
        <div><dt>IPv6</dt><dd :class="{ 'hl-signal': summary.ipv6 }">{{ t(summary.ipv6 ? 'ipnodecloak.available' : attempted.IPInfo ? 'ipnodecloak.unavailable' : 'ipnodecloak.pending') }}</dd></div>
      </dl>
    </aside>
    <IPNodeCloakIPDetails :ip="summary.primary?.ip || ''" @network="networkDetails=$event" />
  </section>
</template>

<script setup>
import { computed, reactive, ref, onScopeDispose } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { useCollectedReport } from '@/composables/use-report-collector.js';
import { onAppEvent } from '@/utils/app-events.js';
import { REPORT_EVENT_BUILDERS } from '@/utils/report-builders.js';
import { summarizeDiagnostics } from '@/utils/ipnodecloak-summary.js';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Search, Settings2, Check } from '@lucide/vue';
import IPNodeCloakIPDetails from './IPNodeCloakIPDetails.vue';
const emit = defineEmits(['share-report', 'query-ip']);
const { t } = useI18n();
const store = useMainStore();
const { sections } = useCollectedReport();
const liveSections = reactive({ ...sections });
const attempted = reactive({ IPInfo: !!sections.ipinfo, WebRTC: !!sections.webrtc, DNSLeakTest: !!sections.dnsleak, Connectivity: !!sections.connectivity });
const events = { 'ipinfo:finished': 'IPInfo', 'connectivity:finished': 'Connectivity', 'webrtc:finished': 'WebRTC', 'dnsleak:finished': 'DNSLeakTest' };
const unsubscribes = Object.entries(events).map(([event, key]) => onAppEvent(event, (payload) => {
  attempted[key] = true;
  const { section, build } = REPORT_EVENT_BUILDERS[event];
  // Reports retain the last useful result; the live overview must also show
  // an empty/failed rerun rather than silently displaying an old address.
  liveSections[section] = build(payload);
}));
const summary = computed(() => summarizeDiagnostics(liveSections, attempted));
const networkDetails=ref(null);
const primaryNetwork=computed(()=>{
  const data=networkDetails.value;
  if(data?.ip===summary.value.primary?.ip&&data.asn) return ['AS'+data.asn,data.asnName].filter(Boolean).join(' · ');
  return [summary.value.primary?.asn,summary.value.primary?.isp].filter(Boolean).join(' · ');
});
unsubscribes.push(onAppEvent('ipinfo:updated', (payload) => {
  liveSections.ipinfo = REPORT_EVENT_BUILDERS['ipinfo:finished'].build(payload);
}));
const copied = ref(false);
let copyTimer;
const copyIP = async () => {
  if (!summary.value.primary) return;
  try {
    await navigator.clipboard.writeText(summary.value.primary.ip);
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    store.setAlert(true, 'text-warning', t('ipnodecloak.copyFailed'), t('ipnodecloak.copyIP'), 5000);
  }
};
onScopeDispose(() => { unsubscribes.forEach((unsubscribe) => unsubscribe()); clearTimeout(copyTimer); });
</script>

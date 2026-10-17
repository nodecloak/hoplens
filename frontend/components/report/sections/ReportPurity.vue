<!-- Read-only homepage purity snapshot for shared links and local report images. -->
<template>
  <section class="report-purity">
    <div class="rp-overview">
      <div>
        <p class="rp-ip hl-mono">{{ section.ip }}</p>
        <dl class="rp-facts">
          <div><dt>ASN</dt><dd>{{ section.network?.asn ? 'AS'+section.network.asn : statusText(section.networkState) }}<span>{{ section.network?.asnName }}</span></dd></div>
          <div><dt>{{ t('ipDetails.domain') }}</dt><dd>{{ section.network?.domain || unknown }}</dd></div>
          <div><dt>{{ t('ipDetails.prefix') }}</dt><dd class="hl-mono">{{ prefix(section.network?.prefix) }}</dd></div>
          <div><dt>{{ t('ipDetails.range') }}</dt><dd class="hl-mono">{{ section.network?.range ? section.network.range.start+' – '+section.network.range.end : unknown }}</dd></div>
          <div><dt>{{ t('ipDetails.type') }}</dt><dd>{{ t('ipReport.types.'+section.usageType) }}<span>{{ section.usageTypeSource }}</span></dd></div>
          <div><dt>{{ t('ipDetails.origin') }}</dt><dd>{{ t('ipOrigin.'+(section.origin?.type || 'unknown')) }}<span>{{ t(section.origin?.basis==='registry-geolocation'?'ipOrigin.legacyMethod':'ipOrigin.method') }}</span><span v-if="section.origin?.registrationCountry && section.origin?.locationCountry">{{ t(section.origin.basis==='registry-geolocation'?'ipOrigin.legacyCountries':'ipOrigin.countries',{registered:section.origin.registrationCountry,located:section.origin.locationCountry}) }}</span></dd></div>
          <div><dt>{{ t('ipRisk.proxyMarker') }}</dt><dd>{{ t(section.proxy === true ? 'ipDetails.proxy' : section.proxy === false ? 'ipRisk.noProxyMarker' : 'ipDetails.unknown') }}</dd></div>
        </dl>
      </div>
      <div class="rp-risk">
        <h3>{{ t('ipRisk.title') }}</h3>
        <template v-if="section.risk">
          <p class="rp-score hl-mono">{{ section.risk.score ?? '—' }}<small>/100</small></p>
          <strong>{{ t(section.risk.score === null ? 'ipRisk.incomplete' : section.risk.scoreKind === 'observed' ? 'ipRisk.observedScore' : 'ipRisk.level_'+section.risk.level) }}</strong>
          <p>{{ t('ipRisk.coverage',section.risk.coverage) }}</p>
          <p v-if="section.risk.scoreKind==='observed'">{{ t('ipRisk.observedNote',section.risk.range) }}</p>
          <p>{{ isoToDateTime(section.risk.queriedAt,locale) }} · {{ section.risk.model }}</p>
        </template>
        <p v-else>{{ t(section.riskState==='pending' ? 'ipRisk.onDemand' : section.riskState==='loading' ? 'ipDetails.loading' : 'ipDetails.unavailable') }}</p>
        <p>{{ t('ipRisk.note') }}</p>
      </div>
    </div>
    <div class="rp-traffic"><h3>{{ t('ipDetails.traffic') }} · Cloudflare Radar</h3><p v-if="section.traffic">{{ t('ipDetails.human') }} {{ section.traffic.human }}% · {{ t('ipDetails.bot') }} {{ section.traffic.bot }}%</p><p v-else>{{ statusText(section.trafficState) }}</p><p>{{ t('ipReport.radarScope') }}</p></div>
    <h3>{{ t('ipDetails.locations') }}</h3>
    <p class="rp-note">{{ t('ipDetails.locationNote') }}</p>
    <dl class="rp-locations"><div v-for="row in section.locations" :key="row.id"><dt>{{ row.name }}</dt><dd>{{ row.status==='ok' ? [row.country || row.countryCode,row.region,row.city].filter(Boolean).join(', ') || unknown : statusText(row.status) }}<small v-if="row.countryOnly"> · {{ t('ipDetails.countryOnly') }}</small></dd></div></dl>
    <template v-if="section.risk">
      <h3>{{ t('ipReport.evidence') }}</h3>
      <ul class="rp-checks"><li v-for="row in section.risk.checks" :key="row.id">
        <div><strong>{{ t('ipRisk.rule_'+row.id) }}</strong><span>{{ row.hit===true ? t('ipRisk.hit') : row.status==='ok' ? t('ipRisk.notHit') : statusText(row.status) }}</span><b class="hl-mono">{{ row.hit ? '+'+row.points : row.status==='ok' ? '0' : '—' }}</b></div>
        <p>{{ row.source }} · {{ t('ipRisk.weight',{points:row.maxPoints}) }}<template v-if="row.suppressedBy"> · {{ t('ipRisk.deduplicated') }}</template></p>
        <p v-if="row.asOf">{{ t('ipRisk.asOf') }}: {{ isoToDateTime(row.asOf,locale) }}</p>
        <p v-if="row.matchedPrefix" class="hl-mono">{{ prefix(row.matchedPrefix) }}</p><p v-if="row.copyright">{{ row.copyright }}</p>
      </li></ul>
      <p class="rp-note">{{ t('ipRisk.formula') }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isoToDateTime } from '@/utils/time-utils.js';
defineProps({ section: { type: Object, required: true } });
const { t, locale } = useI18n();
const unknown = computed(() => t('ipDetails.unknown'));
const prefix = value => value ? `${value.address}/${value.length}` : unknown.value;
const statusText = value => ['pending','loading','disabled','different','unknown','unavailable'].includes(value) ? t('ipDetails.'+value) : ['ok','stale','missing','partial','unsupported','error','limited'].includes(value) ? t('ipReport.states.'+value) : t('ipDetails.unavailable');
</script>

<style scoped>
.report-purity{padding:24px;font-size:12px;line-height:1.65;overflow-wrap:anywhere}
.rp-overview{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:24px}
.rp-ip{font-size:24px;margin-bottom:16px;font-weight:500}
.rp-facts>div,.rp-locations>div{display:grid;grid-template-columns:125px minmax(0,1fr);gap:14px;border-bottom:1px solid var(--border);padding:8px 0}
dt,.rp-note,.rp-risk p,.rp-checks p,.rp-traffic>p:last-child{color:var(--muted-foreground)}
.rp-facts dd>span{display:block;color:var(--muted-foreground)}
.rp-risk{padding:20px;border:1px solid var(--border);border-radius:14px;background:var(--muted)}
.report-purity h3{font-size:14px;font-weight:600;margin:22px 0 10px}.rp-risk h3{margin-top:0}
.rp-risk .rp-score{font-size:44px;font-weight:500;color:var(--foreground);margin:12px 0}.rp-score small{font-size:12px;margin-left:8px}
.rp-risk p{margin-top:8px;font-size:11px}
.rp-traffic{margin:22px 0;padding:16px 0;border-block:1px solid var(--border)}.rp-traffic h3{margin-top:0}
.rp-checks li{padding:12px 0;border-bottom:1px solid var(--border)}.rp-checks li>div{display:flex;align-items:center;gap:14px}.rp-checks li>div>span{margin-left:auto}.rp-checks p,.rp-note{font-size:11px}
@media(max-width:650px){.rp-overview{grid-template-columns:1fr}.report-purity{padding:16px}.rp-facts>div,.rp-locations>div{grid-template-columns:100px minmax(0,1fr)}}
</style>

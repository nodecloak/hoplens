<!-- First-party index with per-rule evidence, missing-data coverage and a readable scoring method. -->
<template>
  <section class="hl-purity-card" aria-labelledby="hl-risk-title">
    <div class="hl-fact-heading"><h3 id="hl-risk-title"><ShieldCheck />{{ t('ipRisk.title') }}</h3><span class="hl-ip-family">NodeCloak v1</span></div>
    <template v-if="result">
      <template v-if="result.score!==null">
        <div class="hl-purity-value hl-mono">{{ result.score }}<span>/100</span></div>
        <div class="hl-purity-bar hl-risk-bar" :class="'hl-risk-'+result.level" role="meter" :aria-label="t('ipRisk.title')" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="result.score"><span :style="{width:result.score+'%'}" /></div>
        <p class="hl-purity-label">{{ t('ipRisk.level_'+result.level) }}</p>
      </template>
      <p v-else class="hl-risk-incomplete" role="status">{{ t('ipRisk.incomplete') }}</p>
      <p class="hl-source-caption">{{ t('ipRisk.coverage',{checked:result.coverage.checked,total:result.coverage.total}) }} · {{ isoToDateTime(result.queriedAt,locale) }}</p>
      <ul class="hl-risk-checks">
        <li v-for="check in result.checks" :key="check.id">
          <div class="hl-risk-rule-heading"><strong>{{ t('ipRisk.rule_'+check.id) }}</strong><span :class="{'hl-risk-hit':check.hit===true}">{{ check.status==='ok' ? t(check.hit?'ipRisk.hit':'ipRisk.notHit') : t(check.status==='stale'?'ipRisk.stale':check.status==='unsupported'?'ipRisk.unsupported':'ipRisk.missing') }}</span></div>
          <p class="hl-source-caption">{{ check.source }} · {{ t('ipRisk.weight',{points:check.maxPoints}) }}<template v-if="check.hit"> · {{ t('ipRisk.added',{points:check.points}) }}</template><template v-if="check.suppressedBy"> · {{ t('ipRisk.deduplicated') }}</template></p>
          <p class="hl-source-caption hl-mono" v-if="check.matchedPrefix" data-mask="ip">{{ check.matchedPrefix }}</p>
          <p class="hl-source-caption" v-if="check.asOf">{{ t('ipRisk.asOf') }}: {{ isoToDateTime(check.asOf,locale) }}</p>
          <p class="hl-source-caption" v-if="check.copyright">{{ check.copyright }}</p>
        </li>
      </ul>
    </template>
    <p v-else class="hl-detail-empty hl-purity-placeholder" role="status">{{ t(state==='loading'?'ipDetails.loading':state==='pending'?'ipRisk.onDemand':'ipDetails.unavailable') }}</p>
    <p class="hl-source-caption">{{ t('ipRisk.note') }}</p>
    <div class="hl-purity-actions"><Button variant="outline" :disabled="!valid||state==='loading'" @click="emit('check')"><LoaderCircle v-if="state==='loading'" class="animate-spin"/><ShieldCheck v-else/>{{ t(result?'ipDetails.recheck':'ipRisk.check') }}</Button></div>
    <details class="hl-risk-method"><summary>{{ t('ipRisk.method') }}</summary><p>{{ t('ipRisk.formula') }}</p><p>{{ t('ipRisk.scope') }}</p><p>{{ t('ipRisk.freshness') }}</p><p class="hl-source-caption">{{ t('ipRisk.sources') }}: <a href="https://www.spamhaus.org/blocklists/do-not-route-or-peer/" target="_blank" rel="noopener">Spamhaus Project</a> · <a href="https://check.torproject.org/exit-addresses" target="_blank" rel="noopener">Tor Project</a> · <a href="https://ip-api.com/docs/api:json" target="_blank" rel="noopener">IP-API</a></p></details>
  </section>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
import { ShieldCheck, LoaderCircle } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { isoToDateTime } from '@/utils/time-utils.js';
defineProps({result:{type:Object,default:null},state:{type:String,default:'pending'},valid:Boolean});
const emit=defineEmits(['check']);
const {t,locale}=useI18n();
</script>

<!-- Local diagnostic image containing only the assembled, privacy-filtered report. -->
<template>
  <article class="report-image">
    <header class="report-image-heading">
      <span class="report-image-brand">IP.NodeCloak</span>
      <h1>{{ t('report.Title') }}</h1>
      <p>{{ report.origin }} · {{ isoToDateTime(report.generatedAt, locale) }}</p>
      <p v-if="masked">{{ t('report.MaskTail') }}</p>
    </header>
    <ReportSectionCard v-for="id in sectionIds" :key="id" :section-id="id" :tested-at="report.sections[id].testedAt">
      <component :is="components[id]" :section="report.sections[id]" />
    </ReportSectionCard>
    <footer>ip.nodecloak.com</footer>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { REPORT_SECTION_IDS } from '@/utils/report-schema.js';
import { isoToDateTime } from '@/utils/time-utils.js';
import ReportSectionCard from './sections/ReportSectionCard.vue';
import ReportIpinfo from './sections/ReportIpinfo.vue';
import ReportPurity from './sections/ReportPurity.vue';
import ReportConnectivity from './sections/ReportConnectivity.vue';
import ReportWebrtc from './sections/ReportWebrtc.vue';
import ReportDnsleak from './sections/ReportDnsleak.vue';
import ReportSpeedtest from './sections/ReportSpeedtest.vue';
import ReportPingtest from './sections/ReportPingtest.vue';
import ReportMtrtest from './sections/ReportMtrtest.vue';
import ReportRuletest from './sections/ReportRuletest.vue';
import ReportBrowserinfo from './sections/ReportBrowserinfo.vue';
import ReportInvisibility from './sections/ReportInvisibility.vue';
import ReportEnhanceddnsleak from './sections/ReportEnhanceddnsleak.vue';
import ReportPersona from './sections/ReportPersona.vue';

const props = defineProps({ report: { type: Object, required: true }, masked: Boolean });
const { t, locale } = useI18n();
const sectionIds = computed(() => REPORT_SECTION_IDS.filter(id => props.report.sections[id]));
const components = {
  ipinfo: ReportIpinfo, ippurity: ReportPurity, connectivity: ReportConnectivity, webrtc: ReportWebrtc,
  dnsleak: ReportDnsleak, speedtest: ReportSpeedtest, pingtest: ReportPingtest,
  mtrtest: ReportMtrtest, ruletest: ReportRuletest, browserinfo: ReportBrowserinfo,
  invisibility: ReportInvisibility, enhanceddnsleak: ReportEnhanceddnsleak, persona: ReportPersona,
};
</script>

<style scoped>
.report-image{box-sizing:border-box;width:1100px;padding:36px;background:var(--background);color:var(--foreground);font-family:Geist,ui-sans-serif,sans-serif;line-height:1.6}
.report-image-heading{margin-bottom:28px;border-bottom:1px solid var(--border);padding-bottom:24px}
.report-image-brand{font-size:18px;font-weight:600;color:var(--hl-signal)}
.report-image-heading h1{font-size:30px;margin:12px 0}
.report-image-heading p{font-size:13px;color:var(--muted-foreground);margin:4px 0}
.report-image>:not(header):not(footer){margin-bottom:18px;box-shadow:none}
.report-image :deep(.overflow-x-auto){overflow:visible}
.report-image :deep(th),.report-image :deep(td){padding-left:8px;padding-right:8px;white-space:normal;overflow-wrap:anywhere}
.report-image :deep(.tabular-nums){white-space:nowrap;overflow-wrap:normal}
.report-image :deep(.truncate){white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
.report-image footer{height:auto;padding:22px 0 0;margin-top:24px;border-top:1px solid var(--border);font-size:12px;color:var(--muted-foreground)}
</style>

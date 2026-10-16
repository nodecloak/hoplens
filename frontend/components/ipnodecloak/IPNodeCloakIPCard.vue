<!-- Source observation and a flat VI detail dialog sharing the existing IP/ASN controls. -->
<template>
  <article class="hl-source-card keyboard-shortcut-card">
    <header><span>{{ card.source }}</span><span class="hl-ip-family">{{ card.id === 'ipchecking_v64' ? 'IPv4/6' : card.id.includes('v6') ? 'IPv6' : 'IPv4' }}</span></header>
    <button class="hl-source-address" :class="{ 'hl-source-unavailable': !valid }" :disabled="!valid" @click="open = true" :data-mask="valid ? 'ip' : undefined">{{ valid ? card.ip : t(pending ? 'ipnodecloak.sourceLoading' : 'ipnodecloak.unavailable') }}</button>
    <div class="hl-source-location"><span>{{ [card.city, card.country_code].filter(Boolean).join(', ') || '—' }}</span><span>{{ card.asn || '—' }}</span></div>
    <footer><span class="hl-source-badge" :class="{ 'hl-route-diff': valid && reference && reference !== card.ip }">{{ t(valid ? (reference && reference !== card.ip ? 'ipnodecloak.different' : 'ipnodecloak.match') : pending ? 'ipnodecloak.pending' : 'ipnodecloak.unavailable') }}</span><span class="hl-source-isp">{{ card.isp || '' }}</span><Button variant="ghost" size="icon" :aria-label="t('ipnodecloak.testAgain')" @click="emit('refresh-card', card, index)"><RefreshCw /></Button><button v-if="valid" class="hl-source-detail" @click="open = true" :aria-label="t('ipnodecloak.details')"><ArrowUpRight /></button></footer>
  </article>
  <Dialog v-model:open="open">
    <DialogContent class="hl-ip-dialog hl-source-dialog" :title="card.source">
      <div class="hl-source-dialog-scroll">
        <div class="hl-source-dialog-capture" data-screenshot-root>
          <DialogHeader :title="card.source" class="hl-source-dialog-header" />
          <div class="hl-source-dialog-hero">
            <div class="hl-source-dialog-address" :data-mask="maskAttr(card.ip)">
              <FitText v-if="valid" :text="card.ip" :tiers="addressTiers" :max-lines="2" :title="card.ip" class="hl-mono min-w-0" />
              <span v-else class="hl-source-dialog-status" role="status">{{ t(card.ip?'ipnodecloak.unavailable':'ipnodecloak.sourceLoading') }}</span>
              <CopyButton v-if="valid" :value="card.ip" :tooltip="t('Tooltips.CopyIP')" :aria-label="'Copy '+card.ip" class="hl-source-dialog-copy" />
            </div>
            <div class="hl-source-dialog-actions" data-screenshot-exclude>
              <ScreenshotButton filename-prefix="ipnodecloak" :filename-label="card.source" :track-label="card.source" :disabled="!valid"
                :tooltip-text="t('Tooltips.SaveAsImage')" :aria-label="'Save '+card.source+' as image'" button-class="hl-source-dialog-action" />
              <Button variant="outline" size="icon" class="hl-source-dialog-action" :aria-label="'Refresh '+card.source" @click="emit('refresh-card',card,index)"><RefreshCw /></Button>
            </div>
          </div>
          <div v-if="valid" class="hl-source-detail-panel">
            <IpDetailPanel :data="card" :index="index" :ip-geo-source="ipGeoSource" :asn-infos="asnInfos"
              :asn-history-infos="asnHistoryInfos" :asn-connectivity-infos="asnConnectivityInfos" :configs="configs"
              :is-dark-mode="isDarkMode" map-mode="inline" country-traffic-mode="inline" @open-tool="open=false" />
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { isValidIP } from '@/utils/valid-ip.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowUpRight } from '@lucide/vue';
import IpDetailPanel from '@/components/ip-infos/IpDetailPanel.vue';
import FitText from '@/components/widgets/FitText.vue';
import CopyButton from '@/components/widgets/CopyButton.vue';
import ScreenshotButton from '@/components/widgets/ScreenshotButton.vue';
import { HERO_TIERS } from '@/composables/use-fit-text.js';
import { createMaskGate } from '@/composables/use-info-mask.js';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  card: { type: Object, required: true }, reference: { type: String, default: '' }, pending: Boolean,
  index: { type: Number, required: true }, isDarkMode: { type: Boolean, required: true }, isMobile: Boolean,
  ipGeoSource: { type: Number, required: true }, configs: { type: Object, required: true },
  asnInfos: { type: Object, required: true }, asnHistoryInfos: { type: Object, default: () => ({}) },
  asnConnectivityInfos: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['refresh-card']);
const { t } = useI18n();
const maskAttr = createMaskGate(t);
const addressTiers = ['text-3xl',...HERO_TIERS];
const open = ref(false);
const valid = computed(() => isValidIP(props.card.ip));
</script>

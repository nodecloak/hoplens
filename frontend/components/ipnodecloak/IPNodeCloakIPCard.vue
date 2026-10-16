<!-- Compact source observation with the complete upstream IP details in a dialog. -->
<template>
  <article class="hl-source-card keyboard-shortcut-card">
    <header><span>{{ card.source }}</span><span class="hl-ip-family">{{ card.id === 'ipchecking_v64' ? 'IPv4/6' : card.id.includes('v6') ? 'IPv6' : 'IPv4' }}</span></header>
    <button class="hl-source-address" :class="{ 'hl-source-unavailable': !valid }" :disabled="!valid" @click="open = true" :data-mask="valid ? 'ip' : undefined">{{ valid ? card.ip : t(pending ? 'ipnodecloak.sourceLoading' : 'ipnodecloak.unavailable') }}</button>
    <div class="hl-source-location"><span>{{ [card.city, card.country_code].filter(Boolean).join(', ') || '—' }}</span><span>{{ card.asn || '—' }}</span></div>
    <footer><span class="hl-source-badge" :class="{ 'hl-route-diff': valid && reference && reference !== card.ip }">{{ t(valid ? (reference && reference !== card.ip ? 'ipnodecloak.different' : 'ipnodecloak.match') : pending ? 'ipnodecloak.pending' : 'ipnodecloak.unavailable') }}</span><span class="hl-source-isp">{{ card.isp || '' }}</span><Button variant="ghost" size="icon" :aria-label="t('ipnodecloak.testAgain')" @click="emit('refresh-card', card, attrs.index)"><RefreshCw /></Button><button v-if="valid" class="hl-source-detail" @click="open = true" :aria-label="t('ipnodecloak.details')"><ArrowUpRight /></button></footer>
  </article>
  <Dialog v-model:open="open"><DialogContent class="hl-ip-dialog" :title="card.source"><DialogHeader :title="card.source" /><IPCard v-bind="attrs" :card="card" @refresh-card="(...args) => emit('refresh-card', ...args)" /></DialogContent></Dialog>
</template>

<script setup>
import { computed, ref, useAttrs } from 'vue';
import { useI18n } from 'vue-i18n';
import { isValidIP } from '@/utils/valid-ip.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowUpRight } from '@lucide/vue';
import IPCard from '@/components/ip-infos/IPCard.vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({ card: { type: Object, required: true }, reference: { type: String, default: '' }, pending: Boolean });
const emit = defineEmits(['refresh-card']);
const attrs = useAttrs();
const { t } = useI18n();
const open = ref(false);
const valid = computed(() => isValidIP(props.card.ip));
</script>

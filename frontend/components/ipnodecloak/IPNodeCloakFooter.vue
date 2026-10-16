<!-- IPNodeCloak attribution and browser-local history explanation. -->
<template>
  <footer class="hl-footer">
    <div><p>{{ t('ipnodecloak.footerNote') }}</p><div><a href="https://nodecloak.com/" target="_blank" rel="noopener">IP.NodeCloak</a><RouterLink to="/privacy">{{ t('about.Privacy') }}</RouterLink><a href="https://github.com/nodecloak/ipnodecloak" target="_blank" rel="noopener">GitHub <ArrowUpRight /></a><a href="https://github.com/jason5ng32/MyIP" target="_blank" rel="noopener">{{ t('ipnodecloak.poweredBy') }}</a></div></div>
    <I18nT v-if="store.configs.maxMind" keypath="ipnodecloak.maxmindAttribution" tag="p" scope="global" class="hl-source-attribution">
      <template #provider><a href="https://www.maxmind.com/" target="_blank" rel="noopener">MaxMind</a></template>
    </I18nT>
  </footer>
</template>
<script setup>
import { useI18n, I18nT } from 'vue-i18n';
import { useMainStore } from '@/store';
import { ArrowUpRight } from '@lucide/vue';
const { t } = useI18n();
const store = useMainStore();
</script>

<!-- Hoplens attribution and browser-local history explanation. -->
<template>
  <footer class="hl-footer"><div><p>{{ t('hoplens.footerNote') }}</p><div><a href="https://nodecloak.com/" target="_blank" rel="noopener">hoplens · NodeCloak</a><RouterLink to="/privacy">{{ t('about.Privacy') }}</RouterLink><a href="https://github.com/nodecloak/hoplens" target="_blank" rel="noopener">GitHub <ArrowUpRight /></a><a href="https://github.com/jason5ng32/MyIP" target="_blank" rel="noopener">{{ t('hoplens.poweredBy') }}</a></div></div></footer>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
import { ArrowUpRight } from '@lucide/vue';
const { t } = useI18n();
</script>

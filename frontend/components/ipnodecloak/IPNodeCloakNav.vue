<!-- Responsive IPNodeCloak navigation, theme choice and persisted locale picker. -->
<template>
  <header class="hl-header">
    <div class="hl-nav-container">
      <a class="hl-brand" href="/" aria-label="IP.NodeCloak"><img :src="store.isDarkMode ? '/brand/ipnodecloak-mark-dark.svg' : '/brand/ipnodecloak-mark-light.svg'" width="30" height="30" alt="" /><span>IP.NodeCloak</span></a>
      <nav class="hl-desktop-nav" :aria-label="t('ipnodecloak.navigation')">
        <a v-for="link in links" :key="link.id" :href="'#' + (link.anchor || link.id)" :class="{ active: store.currentSection === link.id }">{{ t(link.key) }}</a>
      </nav>
      <div class="hl-nav-actions">
        <Select :model-value="locale" @update:model-value="changeLanguage">
          <SelectTrigger class="hl-language" :aria-label="t('ipnodecloak.language')"><span>{{ locale === 'zh' ? '简' : locale === 'zh-TW' ? '繁' : locale.slice(0, 2).toUpperCase() }}</span></SelectTrigger>
          <SelectContent><SelectItem v-for="language in LOCALES" :key="language.code" :value="language.code">{{ language.nativeName }}</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" size="icon" class="hl-theme-button" :aria-label="t('ipnodecloak.theme')" @click="store.updatePreference('theme', store.isDarkMode ? 'light' : 'dark')"><Sun v-if="store.isDarkMode" /><Moon v-else /></Button>
        <Button variant="action" class="hl-full-check" :disabled="busy" @click="emit('full-check')"><LoaderCircle v-if="busy" class="animate-spin" />{{ t(busy ? 'ipnodecloak.running' : 'ipnodecloak.fullCheck') }}</Button>
        <DropdownMenu v-model:open="menuOpen">
          <DropdownMenuTrigger as-child><Button variant="outline" size="icon" class="hl-mobile-menu" :aria-label="t('ipnodecloak.navigation')"><Menu /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-52">
            <DropdownMenuItem v-for="link in links" :key="link.id" as-child><a :href="'#' + (link.anchor || link.id)" @click="menuOpen = false">{{ t(link.key) }}</a></DropdownMenuItem>
            <DropdownMenuSeparator /><DropdownMenuItem :disabled="busy" @select="emit('full-check')"><RefreshCw />{{ t('ipnodecloak.fullCheck') }}</DropdownMenuItem>
            <DropdownMenuItem @select="store.toggleSheet('preferences')"><Settings2 />{{ t('ipnodecloak.settings') }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
  <nav class="hl-mobile-tabs" :aria-label="t('ipnodecloak.navigation')">
    <a v-for="link in mobileLinks" :key="link.id" :href="'#' + (link.anchor || link.id)" :class="{ active: store.currentSection === link.id || (link.id === 'WebRTC' && store.currentSection === 'DNSLeakTest') }"><component :is="link.icon" /><span>{{ t(link.key) }}</span></a>
  </nav>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { LOCALES } from '@/utils/locale-registry.js';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Sun, Moon, Menu, Settings2, RefreshCw, LoaderCircle, Scan, ShieldCheck, Gauge, Network } from '@lucide/vue';
defineProps({ busy: Boolean });
const emit = defineEmits(['full-check']);
const { t, locale } = useI18n();
const store = useMainStore();
const menuOpen = ref(false);
const links = [{ id: 'IPInfo', anchor: 'hl-public-address', key: 'ipnodecloak.overview' }, { id: 'IPPurity', key: 'ipDetails.title' }, { id: 'WebRTC', key: 'ipnodecloak.leaks' }, { id: 'Connectivity', key: 'ipnodecloak.connectivity' }, { id: 'SpeedTest', key: 'ipnodecloak.speed' }, { id: 'AdvancedTools', key: 'ipnodecloak.tools' }];
const mobileLinks = ['IPInfo','WebRTC','SpeedTest','AdvancedTools'].map((id,index) => ({ ...links.find(link=>link.id===id), icon: [Scan, ShieldCheck, Gauge, Network][index] }));
const changeLanguage = (code) => {
  if (!LOCALES.some((item) => item.code === code) || code === locale.value) return;
  store.updatePreference('lang', code);
  window.location.reload();
};
</script>

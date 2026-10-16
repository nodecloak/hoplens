<template>
  <IPNodeCloakNav :busy="!store.allHasLoaded" @full-check="store.setRefreshEveryThing(true)" />
  <User ref="userRef" />
  <Achievements ref="achievementsRef" />
  <Preferences />
  <main id="mainpart" class="hl-main">
    <IPNodeCloakHero @share-report="shareReportRef?.openDialog()">
      <template #history><IPHistory /><InfoMask :show-mask-button="showMaskButton" :info-mask-level="infoMaskLevel" :toggle-info-mask="toggleInfoMask" /></template>
    </IPNodeCloakHero>
      <IPCheck />
      <section class="hl-leak-section"><h2>{{ t('ipnodecloak.leaks') }}</h2><div class="hl-leak-grid"><WebRTC /><DNSLeaks /></div></section>
      <div class="hl-network-grid"><Connectivity /><SpeedTest /></div>
      <AdvancedTools ref="advancedToolsRef" />
  </main>
  <div class="hl-hidden-triggers" aria-hidden="true" inert>
    <ShareReport ref="shareReportRef" />
    <QueryIP ref="queryIPRef" />
  </div>
  <HelpModal ref="helpModalRef" />
  <Footer />
</template>

<script setup>
// The homepage. Holds every top-level section plus the Advanced Tools drawer.
// Split out of App.vue when the app moved to history-mode routing: App is now a
// thin shell, and this component is what /'s <router-view> renders. The truly
// global widgets (tooltip provider, toast, PWA, theme) stay in App.
//
// Components — the test sections and the always-visible chrome load
// synchronously; everything the first paint can't show (dialogs, drawers,
// the below-fold Additional/Footer) is an async component so its code stays
// out of the route chunk and out of the mount's critical path. Their
// template refs are null until the chunk lands — consumers (use-shortcuts)
// must optional-chain.
import IPNodeCloakNav from './ipnodecloak/IPNodeCloakNav.vue';
import IPNodeCloakHero from './ipnodecloak/IPNodeCloakHero.vue';
import IPCheck from './IpInfos.vue';
import Connectivity from './ConnectivityTest.vue';
import WebRTC from './WebRtcTest.vue';
import DNSLeaks from './DnsLeaksTest.vue';
import SpeedTest from './SpeedTest.vue';
import AdvancedTools from './Advanced.vue';
import InfoMask from './widgets/InfoMask.vue';

// Vue + Store
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';

// Async (off-critical-path) components
const Footer = defineAsyncComponent(() => import('./Footer.vue'));
const User = defineAsyncComponent(() => import('./User.vue'));
const Achievements = defineAsyncComponent(() => import('./Achievements.vue'));
const Preferences = defineAsyncComponent(() => import('./widgets/Preferences.vue'));
const QueryIP = defineAsyncComponent(() => import('./widgets/QueryIP.vue'));
const HelpModal = defineAsyncComponent(() => import('./widgets/Help.vue'));
const IPHistory = defineAsyncComponent(() => import('./widgets/IPHistory.vue'));
const ShareReport = defineAsyncComponent(() => import('./report/ShareReportDialog.vue'));
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';

// Composables
import { useInfoMask } from '@/composables/use-info-mask.js';
import { useRefreshOrchestrator } from '@/composables/use-refresh-orchestrator.js';
import { useShortcuts } from '@/composables/use-shortcuts.js';
import { useSectionTracking } from '@/composables/use-section-tracking.js';
import { useDocumentMeta } from '@/composables/use-document-meta.js';

const { t } = useI18n();
const store = useMainStore();
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);

// Template refs — UI chrome only; the test sections are reached through the
// command bus (utils/app-commands.js), not refs.
const userRef = ref(null);
const achievementsRef = ref(null);
const queryIPRef = ref(null);
const helpModalRef = ref(null);
const shareReportRef = ref(null);
const advancedToolsRef = ref(null);

// Info mask
const { infoMaskLevel, isInfosLoaded, showMaskButton, toggleInfoMask } = useInfoMask({
    store,
    t,
});

// Refresh / initial load sequence
const { loadingControl } = useRefreshOrchestrator({
    store,
    t,
    userPreferences,
    infoMaskLevel,
});

// Shortcuts
const { loadShortcuts } = useShortcuts({
    refs: {
        queryIPRef, helpModalRef, shareReportRef, advancedToolsRef,
        isInfosLoaded, toggleInfoMask,
    },
    store, t, configs, userPreferences,
});

// Scroll monitoring + section tracking (logic from widgets/Patch.vue)
useSectionTracking();

// Localized homepage head. Provide title/description explicitly via t() rather
// than leaning on use-document-meta's DEFAULT_META snapshot: that snapshot is
// taken at module load, before the (now async) locale messages land, so it would
// pin the head to index.html's English title. Reactive t() also re-applies the
// right copy when SPA-navigating back from a /tools/:slug page.
useDocumentMeta(() => ({
    title: t('page.title'),
    description: t('page.description'),
    canonical: `${window.location.origin}/`,
}));

onMounted(() => {
    loadingControl();
    loadShortcuts();
});
</script>

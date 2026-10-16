<template>
  <!-- Slim sticky header shared by the standalone pages (/tools/:slug,
       /privacy, /r/:id). Brand → home, an optional breadcrumb title, and a
       back-to-home button. This is NOT the homepage nav (Nav.vue) — that one
       carries the full navigation, user menu, mobile drawer, and hides on
       scroll; this one stays pinned. It carries the iOS safe-area inset itself
       (body.jn-standalone-page in index.html reserves nothing), so when sticky
       pins it at the viewport top the row sits below the Dynamic Island and
       the blurred background paints the status-bar strip. -->
  <header class="sticky top-0 z-40 border-b bg-background/80 supports-[backdrop-filter:blur(0px)]:bg-background/60 backdrop-blur pt-[env(safe-area-inset-top)]">
    <div class="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-4 h-14">
      <RouterLink to="/"
        class="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-lg font-semibold text-foreground no-underline hover:opacity-80 transition-opacity"
        aria-label="IP.NodeCloak">
        <brandIcon />
        <span class="tracking-tight font-semibold">IP.NodeCloak</span>
      </RouterLink>
      <!-- Breadcrumb: " / <title>" — only when the page passes a title. -->
      <template v-if="title">
        <span class="hidden sm:inline text-muted-foreground" aria-hidden="true">/</span>
        <span class="hidden sm:inline min-w-0 truncate font-medium">{{ title }}</span>
      </template>
      <!-- Button `as-child` renders the RouterLink as its root, so this is a
           single <a> styled as a button — not a <button> nested in an <a>.
           Icon-only below `sm`: brand (132px) + this button's label (up to
           178px in pt-BR) + gaps + px-4 exceeded 320px, and since the title is
           the only item that can shrink, it collapsed to 0 and the row still
           overflowed — a dangling "/" plus a clipped button. `sr-only` (not
           `hidden`) keeps the accessible name in every locale, and being out of
           flow it costs no `gap-2`. -->
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <Select :model-value="locale" @update:model-value="changeLanguage"><SelectTrigger class="w-14 h-8 text-xs" :aria-label="t('ipnodecloak.language')"><span>{{ locale==='zh'?'简':locale==='zh-TW'?'繁':locale.slice(0,2).toUpperCase() }}</span></SelectTrigger><SelectContent><SelectItem v-for="language in LOCALES" :key="language.code" :value="language.code">{{ language.nativeName }}</SelectItem></SelectContent></Select>
        <Button variant="ghost" size="icon" :aria-label="t('ipnodecloak.theme')" @click="store.updatePreference('theme',store.isDarkMode?'light':'dark')"><Sun v-if="store.isDarkMode"/><Moon v-else/></Button>
      <Button as-child variant="default" size="icon" class="shrink-0 cursor-pointer sm:w-auto sm:px-4">
        <RouterLink to="/">
          <ArrowLeft class="size-4" />
          <span class="sr-only sm:not-sr-only">{{ t('advancedtools.BackToHome') }}</span>
        </RouterLink>
      </Button>
      </div>
    </div>
  </header>
</template>

<script setup>
// Shared slim header for standalone pages. The breadcrumb label is passed in as
// `title` (already localized by the caller); everything else is fixed chrome.
import { useI18n } from 'vue-i18n';
import brandIcon from '@/components/svgicons/Brand.vue';
import { ArrowLeft,Sun,Moon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Select,SelectTrigger,SelectContent,SelectItem } from '@/components/ui/select';
import { useMainStore } from '@/store';
import { LOCALES } from '@/utils/locale-registry.js';

defineProps({
    // Breadcrumb text shown after the brand (e.g. "🌐 MTR Test" or "Privacy").
    // Empty string renders just the brand + back button.
    title: { type: String, default: '' },
});

const { t,locale } = useI18n(),store=useMainStore();
const changeLanguage=code=>{if(LOCALES.some(row=>row.code===code)&&code!==locale.value){store.updatePreference('lang',code);window.location.reload();}};
</script>

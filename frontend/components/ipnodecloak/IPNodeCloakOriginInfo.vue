<!-- Click-to-open country and ASN details beside the IP origin label. -->
<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="hl-origin-info-trigger" :aria-label="t('ipOrigin.details')"><CircleAlert aria-hidden="true" /></Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="hl-origin-popover" align="end" :side-offset="8" :collision-padding="16" :aria-label="t('ipOrigin.details')">
        {{ t('ipOrigin.countries',{registered:origin.registrationCountry,located:origin.locationCountry}) }}<template v-if="origin.asn"> · AS{{ origin.asn }}</template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui';
import { CircleAlert } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { useOverlayShortcuts } from '@/composables/use-overlay-shortcuts.js';
const props=defineProps({origin:{type:Object,required:true}});
const {t}=useI18n();
const open=ref(false);
useOverlayShortcuts(open);
watch(()=>props.origin,()=>{open.value=false;});
</script>

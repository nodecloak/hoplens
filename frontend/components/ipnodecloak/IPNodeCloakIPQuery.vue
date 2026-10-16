<!-- Visible homepage entry to an independent report for a selected public IP. -->
<template>
  <form class="hl-ip-lookup" @submit.prevent="submit" novalidate>
    <label for="hl-ip-lookup-input">{{ t('ipDetails.title') }}</label>
    <div class="hl-ip-lookup-row">
      <div class="hl-ip-lookup-field">
        <Search aria-hidden="true" />
        <Input id="hl-ip-lookup-input" v-model="query" class="hl-mono" type="text"
          :placeholder="t('ipReport.query')" :aria-invalid="!!error"
          :aria-describedby="error ? 'hl-ip-lookup-error' : undefined"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          data-1p-ignore data-lpignore="true" />
      </div>
      <Button type="submit" variant="action" :disabled="!query.trim() || navigating">
        <Spinner v-if="navigating" />{{ t('ipReport.run') }}
      </Button>
    </div>
    <p v-if="error" id="hl-ip-lookup-error" class="text-destructive" role="alert">{{ t(error) }}</p>
  </form>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Search } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { parseIPLookupQuery } from '@/utils/ip-lookup-query.js';

const { t } = useI18n();
const router = useRouter();
const query = ref('');
const error = ref('');
const navigating = ref(false);

watch(query, () => { error.value = ''; });

const submit = async () => {
  if (navigating.value) return;
  const parsed = parseIPLookupQuery(query.value);
  error.value = parsed.error;
  if (parsed.error) return;
  navigating.value = true;
  try {
    await router.push({ path: '/tools/ipreport', query: { q: parsed.ip } });
  } catch {
    error.value = 'ipReport.error';
  } finally {
    navigating.value = false;
  }
};
</script>

<!-- Same-IP report: transparent first-party rules, distinct regional policy, source provenance and local exports. -->
<template>
  <div class="ip-report">
    <p class="ipr-intro">{{ t('ipReport.note') }}</p>
    <form class="ipr-query" @submit.prevent="submit">
      <label class="sr-only" for="ipReportQuery">{{ t('ipReport.query') }}</label>
      <Input id="ipReportQuery" v-model="query" class="font-mono" :placeholder="t('ipReport.query')" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" :aria-invalid="!!error" />
      <Button variant="action" :disabled="loading||!query.trim()" type="submit"><Spinner v-if="loading"/><Search v-else/>{{ t('ipReport.run') }}</Button>
    </form>
    <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
    <p v-if="loading" role="status" class="ipr-loading"><Spinner/>{{ t('ipReport.loading') }}</p>
    <template v-if="report">
      <div class="ipr-toolbar"><span class="hl-mono">{{ date(report.generatedAt) }} · {{ report.model }}</span><div><Button variant="outline" @click="share"><Check v-if="copied"/><Link v-else/>{{ t('ipReport.share') }}</Button><Button variant="outline" @click="download('json')"><Download/>JSON</Button><Button variant="outline" @click="download('txt')"><Download/>TXT</Button></div></div>
      <div class="ipr-hero-grid">
        <section class="ipr-panel ipr-identity">
          <span class="ipr-eyebrow">{{ t('ipReport.profile') }}</span>
          <h2 class="hl-mono" data-mask="ip">{{ report.ip }}</h2>
          <p class="ipr-location"><Icon v-if="report.profile.countryCode" :icon="'circle-flags:'+report.profile.countryCode.toLowerCase()"/>{{ [report.profile.country,report.profile.region,report.profile.city].filter(Boolean).join(' · ')||unknown }}</p>
          <dl class="ipr-facts">
            <div><dt>{{ t('ipReport.network') }}</dt><dd>{{ report.profile.asn?'AS'+report.profile.asn:unknown }} <span>{{ report.profile.asnName }}</span></dd></div>
            <div><dt>{{ t('ipReport.domain') }}</dt><dd class="hl-mono">{{ report.profile.domain||unknown }}</dd></div>
            <div><dt>{{ t('ipReport.prefix') }}</dt><dd class="hl-mono">{{ report.profile.prefix||unknown }}</dd></div>
            <div><dt>{{ t('ipReport.range') }}</dt><dd class="hl-mono">{{ report.profile.range?report.profile.range.start+' – '+report.profile.range.end:unknown }}</dd></div>
            <div><dt>{{ t('ipReport.type') }}</dt><dd>{{ t('ipReport.types.'+report.profile.type) }}</dd></div>
            <div><dt>{{ t('ipReport.registration') }}</dt><dd>{{ report.profile.registration?.countryCode||unknown }} · {{ report.profile.registration?.name||unknown }}</dd></div>
            <div><dt>{{ t('ipReport.relation') }}</dt><dd>{{ t('ipReport.relations.'+report.profile.registrationRelation) }}</dd></div>
            <div><dt>PTR</dt><dd class="hl-mono">{{ report.profile.rdns?(report.profile.rdns.exists?report.profile.rdns.names.join(', '):t('ipReport.noPtr')):unknown }}</dd></div>
            <div><dt>{{ t('ipReport.sharing') }}</dt><dd>{{ report.profile.sharing?report.profile.sharing.count:unknown }}<small v-if="report.profile.sharing">{{ report.profile.sharing.subnet||unknown }} · proxycheck.io · {{ date(report.profile.sharing.providerUpdatedAt) }}</small></dd></div>
          </dl><p class="ipr-caption">{{ t('ipReport.profileScope') }}</p>
        </section>
        <section class="ipr-panel ipr-score">
          <span class="ipr-eyebrow">{{ t('ipRisk.title') }} <ShieldCheck/></span>
          <div class="ipr-score-number hl-mono">{{ score(report.risk) }}<span>/100</span></div>
          <div class="ipr-meter"><span :style="{width:report.risk.range.max+'%'}" class="ipr-possible"/><span :style="{width:report.risk.range.min+'%'}"/></div>
          <h3>{{ report.risk.score===null?t('ipReport.estimatedRange'):t('ipRisk.level_'+report.risk.level) }}</h3>
          <p>{{ t('ipReport.riskDirection') }}</p>
          <div class="ipr-coverage"><span>{{ t('ipReport.coverage') }}</span><strong class="hl-mono">{{ report.risk.coverage.checked }}/{{ report.risk.coverage.total }}</strong></div>
          <p class="ipr-caption">{{ t('ipReport.rangeNote') }}</p>
          <div v-if="report.radar" class="ipr-radar"><strong>AS{{ report.radar.asn }} · Cloudflare Radar</strong><div class="ipr-traffic"><span :style="{width:report.radar.human+'%'}"/></div><div class="ipr-traffic-label"><span>{{ t('ipDetails.human') }} {{ report.radar.human }}%</span><span>{{ t('ipDetails.bot') }} {{ report.radar.bot }}%</span></div><p class="ipr-caption">{{ t('ipReport.radarScope') }}</p></div>
        </section>
      </div>
      <section class="ipr-section"><div class="ipr-section-heading"><span class="ipr-eyebrow">02 / {{ t('ipReport.scenarios') }}</span><p>{{ t('ipReport.fitDirection') }}</p></div>
        <div class="ipr-scenarios"><article v-for="row in report.scenarios" :key="row.id" class="ipr-panel ipr-scenario"><component :is="icons[row.id]"/><div class="ipr-fit hl-mono">{{ score(row) }}<span>/100</span></div><h3>{{ t('ipReport.scenario.'+row.id) }}</h3><p>{{ t('ipReport.services.'+row.id) }}</p><strong>{{ t('ipReport.fit.'+row.level) }}</strong><p class="ipr-caption">{{ t('ipReport.scenarioNotes.'+row.id) }}</p><details><summary>{{ t('ipReport.factors') }}</summary><ul class="ipr-factor-list"><li v-for="factor in row.factors" :key="factor.id"><span>{{ ruleName(factor.id) }}</span><span>{{ factor.status==='disabled'?state('disabled'):factor.status==='ok'?'−'+factor.points:'0–'+factor.maxPoints }}</span></li></ul></details></article></div>
      </section>
      <section class="ipr-panel ipr-policy"><div class="ipr-section-heading"><h2>{{ t('ipReport.policy') }}</h2><p>{{ t('ipReport.policyNote') }}</p></div><div class="ipr-policy-grid"><article v-for="row in report.platforms" :key="row.id"><strong>{{ {chatgpt:'ChatGPT',claude:'Claude',gemini:'Gemini'}[row.id] }}</strong><span :class="'ipr-state-'+row.status">{{ t('ipReport.policyStates.'+row.status) }}</span><p v-if="row.condition">{{ t('ipReport.conditions.'+row.condition) }}</p><small>{{ t('ipReport.reviewed') }} {{ row.reviewedAt }} <a :href="row.source" target="_blank" rel="noopener">{{ t('ipReport.official') }} ↗</a></small></article></div></section>
      <div class="ipr-two-col">
        <section class="ipr-panel"><span class="ipr-eyebrow">03 / {{ t('ipReport.evidence') }}</span><ul class="ipr-evidence"><li v-for="row in report.evidence" :key="row.id"><div><strong>{{ ruleName(row.id) }}</strong><span>{{ row.status==='ok'?t(row.hit?'ipRisk.hit':'ipRisk.notHit'):state(row.status) }}</span><b class="hl-mono">{{ row.hit?'+'+row.points:row.status==='ok'?'0':'—' }}</b></div><p>{{ row.source }} · {{ t('ipRisk.weight',{points:row.maxPoints}) }}<template v-if="row.suppressedBy"> · {{ t('ipRisk.deduplicated') }}</template></p><small>{{ row.asOf?date(row.asOf):unknown }}<template v-if="row.matchedPrefix"> · {{ row.matchedPrefix }}</template></small><small v-if="row.copyright">{{ row.copyright }}</small></li></ul></section>
        <section class="ipr-panel"><span class="ipr-eyebrow">04 / {{ t('ipReport.reputation') }}</span><dl class="ipr-facts"><div v-for="row in blacklistSources" :key="row.id"><dt>{{ sourceName(row.id) }}</dt><dd>{{ row.status==='ok'?t(row.data.listed?'ipRisk.hit':'ipRisk.notHit'):state(row.status) }}<small v-if="row.data?.policyListed">{{ t('ipReport.policyListed') }}</small></dd></div><div><dt>AbuseIPDB · 30d</dt><dd>{{ report.abuse?t('ipReport.abuseCounts',{reports:report.abuse.totalReports??'—',users:report.abuse.distinctReporters??'—'}):state(report.sources.find(row=>row.id==='abuseipdb')?.status) }}<small v-if="report.abuse?.providerConfidence!==null&&report.abuse">{{ t('ipReport.providerConfidence') }} {{ report.abuse.providerConfidence }}%</small></dd></div></dl>
          <h3 class="ipr-subheading">{{ t('ipReport.passive') }}</h3><p class="ipr-caption">{{ t('ipReport.passiveNote') }}</p><dl class="ipr-facts"><div><dt>{{ t('ipReport.ports') }}</dt><dd class="hl-mono">{{ report.passive?report.passive.ports.join(', ')||t('ipReport.noneObserved'):state(report.sources.find(row=>row.id==='internetdb')?.status) }}</dd></div><div><dt>{{ t('ipReport.cves') }}</dt><dd class="hl-mono">{{ report.passive?.vulnerabilities?report.passive.vulnerabilities.join(', ')||t('ipReport.noneObserved'):unknown }}</dd></div></dl>
        </section>
      </div>
      <section class="ipr-panel"><span class="ipr-eyebrow">05 / {{ t('ipReport.sources') }}</span><div class="ipr-source-table"><table><thead><tr><th>{{ t('ipReport.source') }}</th><th>{{ t('ipReport.state') }}</th><th>{{ t('ipReport.observed') }}</th><th>{{ t('ipReport.latency') }}</th></tr></thead><tbody><tr v-for="row in report.sources" :key="row.id"><td><a :href="sourceURL(row.id)" target="_blank" rel="noopener">{{ sourceName(row.id) }} ↗</a></td><td>{{ state(row.status) }}</td><td>{{ date(row.observedAt) }}</td><td class="hl-mono">{{ row.durationMs }} ms</td></tr></tbody></table></div></section>
      <section class="ipr-panel ipr-method"><span class="ipr-eyebrow">06 / {{ t('ipRisk.method') }}</span><p>{{ t('ipReport.formula') }}</p><p>{{ t('ipReport.abuseRule') }}</p><p>{{ t('ipReport.scenarioMethod') }}</p><p>{{ t('ipReport.freshness') }}</p><h3>{{ t('ipReport.scope') }}</h3><ul><li v-for="key in ['platform','exclusive','accounts','device','mismatch']" :key="key">{{ t('ipReport.limits.'+key) }}</li></ul></section>
    </template>
  </div>
</template>
<script setup>
import {ref,computed,watch,onScopeDispose} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {useI18n} from 'vue-i18n';
import {Icon} from '@iconify/vue';
import {Search,ShieldCheck,Download,Link,Check,Sparkles,Users,Play,Gamepad2,ShoppingBag,Mail} from '@lucide/vue';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Spinner} from '@/components/ui/spinner';
import {fetchWithTimeout} from '@/utils/fetch-with-timeout.js';
import {isUsablePublicIP} from '@/utils/valid-ip.js';
import {isoToDateTime} from '@/utils/time-utils.js';
import {reportToText} from '../../../common/ip-report-model.js';
const {t,locale}=useI18n(),route=useRoute(),router=useRouter();
const query=ref(''),report=ref(null),loading=ref(false),error=ref(''),copied=ref(false);
let controller=null,copiedTimer;
const unknown=computed(()=>t('ipReport.states.missing'));
const icons={ai:Sparkles,social:Users,streaming:Play,gaming:Gamepad2,commerce:ShoppingBag,email:Mail};
const names={network:'RIPEstat / IPWhois',ipapi:'IP-API',proxycheck:'proxycheck.io',rdap:'RIR RDAP',rdns:'DNS PTR',internetdb:'Shodan InternetDB',abuseipdb:'AbuseIPDB',radar:'Cloudflare Radar',drop:'Spamhaus DROP',tor:'Tor Project','dnsbl-spamcop':'SpamCop','dnsbl-psbl':'PSBL','dnsbl-dronebl':'DroneBL','dnsbl-spamhaus':'Spamhaus ZEN'};
const urls={network:'https://stat.ripe.net/',ipapi:'https://ip-api.com/docs/api:json',proxycheck:'https://proxycheck.io/api/',rdap:'https://www.iana.org/assignments/rdap-dns/rdap-dns.xhtml',rdns:'https://www.rfc-editor.org/rfc/rfc1035',internetdb:'https://book.shodan.io/developer-apis/internetdb/',abuseipdb:'https://docs.abuseipdb.com/',radar:'https://radar.cloudflare.com/',drop:'https://www.spamhaus.org/blocklists/do-not-route-or-peer/',tor:'https://check.torproject.org/exit-addresses','dnsbl-spamcop':'https://www.spamcop.net/fom-serve/cache/291.html','dnsbl-psbl':'https://psbl.org/howto/','dnsbl-dronebl':'https://dronebl.org/docs/howtouse','dnsbl-spamhaus':'https://www.spamhaus.org/faqs/dnsbl-usage/'};
const sourceName=id=>names[id]??id,sourceURL=id=>urls[id];
const date=value=>value?isoToDateTime(value,locale.value):unknown.value;
const state=value=>t('ipReport.states.'+(value??'missing'));
const ruleName=id=>t('ipReport.rules.'+id);
const score=row=>row.score??`${row.range.min}–${row.range.max}`;
const blacklistSources=computed(()=>report.value?.sources.filter(row=>row.id.startsWith('dnsbl-'))??[]);
const run=async value=>{
  controller?.abort();report.value=null;error.value='';loading.value=false;
  if(!value) return;
  if(!isUsablePublicIP(value)){error.value=t('ipReport.invalid');return;}
  const current=new AbortController();controller=current;loading.value=true;
  try{const response=await fetchWithTimeout('/api/ip-report?ip='+encodeURIComponent(value),{signal:current.signal,timeoutMs:25000});if(!response.ok)throw new Error('Report unavailable');const body=await response.json();if(!current.signal.aborted)report.value=body;}
  catch{if(!current.signal.aborted)error.value=t('ipReport.error');}
  finally{if(!current.signal.aborted)loading.value=false;}
};
const submit=async()=>{const value=query.value.trim();if(value===route.query.q)await run(value);else await router.replace({query:{...route.query,q:value}});};
watch(()=>route.query.q,value=>{query.value=typeof value==='string'?value:'';run(query.value.trim());},{immediate:true});
const share=async()=>{try{await navigator.clipboard.writeText(new URL('/tools/ipreport?q='+encodeURIComponent(report.value.ip),location.origin).href);copied.value=true;clearTimeout(copiedTimer);copiedTimer=setTimeout(()=>copied.value=false,2000);}catch{error.value=t('ipReport.copyError');}};
const download=format=>{const blob=new Blob([format==='json'?JSON.stringify(report.value,null,2):reportToText(report.value)],{type:format==='json'?'application/json':'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`ip-nodecloak-${report.value.ip.replaceAll(':','_')}.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
onScopeDispose(()=>{controller?.abort();clearTimeout(copiedTimer);});
</script>
<style scoped>
.ip-report{--ipr-accent:var(--hl-signal,#4f7a00);font-size:14px;line-height:1.65;max-width:1240px;margin:0 auto}.ipr-intro{color:var(--muted-foreground);max-width:85ch;margin-bottom:20px}.ipr-query{display:flex;gap:10px;max-width:720px;margin-bottom:20px}.ipr-query input{height:42px}.ipr-query button{height:42px}.ipr-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:24px 0 16px;font-size:11px;color:var(--muted-foreground)}.ipr-toolbar>div{display:flex;gap:8px}.ipr-toolbar button{height:32px;font-size:12px}.ipr-panel{border:1px solid var(--border);border-radius:16px;background:var(--card);padding:25px;min-width:0}.ipr-hero-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(280px,1fr);gap:16px}.ipr-eyebrow{display:flex;align-items:center;justify-content:space-between;gap:8px;text-transform:uppercase;letter-spacing:.1em;font:11px/1.5 'Geist Mono',monospace;color:var(--muted-foreground);margin-bottom:20px}.ipr-eyebrow svg{width:17px}.ipr-identity h2{font-size:clamp(22px,3.2vw,36px);line-height:1.3;letter-spacing:-.04em;overflow-wrap:anywhere}.ipr-location{display:flex;align-items:center;gap:8px;margin:10px 0 23px}.ipr-location svg{width:18px;height:18px;flex-shrink:0}.ipr-facts{margin:0}.ipr-facts>div{display:grid;grid-template-columns:140px 1fr;gap:14px;padding:9px 0;border-bottom:1px solid var(--border)}.ipr-facts dt{color:var(--muted-foreground);font-size:12px}.ipr-facts dd{overflow-wrap:anywhere;min-width:0}.ipr-facts dd span,.ipr-facts small{display:block;color:var(--muted-foreground);font-size:11px;margin-top:3px}.ipr-caption{font-size:11px;color:var(--muted-foreground);line-height:1.7;margin-top:12px}.ipr-score-number{font-size:clamp(42px,5vw,66px);font-weight:500;line-height:1.2;letter-spacing:-.05em;margin:27px 0 22px}.ipr-score-number>span,.ipr-fit>span{font-size:13px;letter-spacing:0;color:var(--muted-foreground);margin-left:8px}.ipr-score h3{font-size:17px;font-weight:600;margin-top:18px}.ipr-score>p{font-size:12px;color:var(--muted-foreground)}.ipr-meter{height:7px;background:var(--muted);position:relative;overflow:hidden;border-radius:6px}.ipr-meter>span{position:absolute;inset:0 auto 0 0;background:var(--ipr-accent);border-radius:6px}.ipr-meter>.ipr-possible{opacity:.3}.ipr-coverage{display:flex;justify-content:space-between;align-items:center;margin-top:23px;padding-top:17px;border-top:1px solid var(--border)}.ipr-radar{border-top:1px solid var(--border);margin-top:25px;padding-top:20px;font-size:12px}.ipr-traffic{height:5px;background:var(--muted);border-radius:4px;overflow:hidden;margin-top:12px}.ipr-traffic>span{display:block;height:100%;background:var(--ipr-accent)}.ipr-traffic-label{display:flex;justify-content:space-between;font:11px/2 monospace}.ipr-section{margin:34px 0 20px}.ipr-section-heading{margin-bottom:16px}.ipr-section-heading h2{font-size:18px;font-weight:600}.ipr-section-heading p{color:var(--muted-foreground);font-size:12px;margin-top:5px}.ipr-section-heading .ipr-eyebrow{margin-bottom:6px}.ipr-scenarios{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.ipr-scenario{position:relative;padding:22px}.ipr-scenario>svg{width:21px;color:var(--muted-foreground)}.ipr-fit{position:absolute;right:20px;top:16px;font-size:24px;font-weight:500}.ipr-scenario h3{font-weight:600;font-size:16px;margin-top:18px}.ipr-scenario>p{font-size:12px;color:var(--muted-foreground)}.ipr-scenario>strong{display:block;margin-top:15px;font-size:12px}.ipr-scenario details{margin-top:16px;border-top:1px solid var(--border);padding-top:10px;font-size:11px}.ipr-factor-list li{display:flex;justify-content:space-between;gap:8px;padding-top:5px}.ipr-policy{margin:20px 0}.ipr-policy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.ipr-policy-grid article{border-left:2px solid var(--border);padding-left:15px}.ipr-policy-grid strong,.ipr-policy-grid span,.ipr-policy-grid small{display:block}.ipr-policy-grid span{margin-top:8px;font-size:12px}.ipr-policy-grid p,.ipr-policy-grid small{font-size:11px;color:var(--muted-foreground);margin-top:6px}.ipr-policy-grid a{margin-left:8px;text-decoration:underline}.ipr-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.ipr-evidence>li{padding:13px 0;border-bottom:1px solid var(--border)}.ipr-evidence>li>div{display:flex;align-items:center;gap:12px;font-size:12px}.ipr-evidence>li>div>span{margin-left:auto;color:var(--muted-foreground)}.ipr-evidence b{min-width:28px;text-align:right}.ipr-evidence p,.ipr-evidence small{font-size:10px;color:var(--muted-foreground);display:block;overflow-wrap:anywhere}.ipr-subheading{font-size:14px;font-weight:600;margin-top:27px}.ipr-source-table{overflow:auto}.ipr-source-table table{width:100%;border-collapse:collapse;text-align:left;font-size:12px;white-space:nowrap}.ipr-source-table th{font-size:10px;color:var(--muted-foreground);font-weight:500}.ipr-source-table td,.ipr-source-table th{padding:10px 12px;border-bottom:1px solid var(--border)}.ipr-source-table td:first-child,.ipr-source-table th:first-child{padding-left:0}.ipr-source-table a:hover{text-decoration:underline}.ipr-method{margin-top:20px}.ipr-method p,.ipr-method li{font-size:12px;color:var(--muted-foreground);max-width:100ch;margin-bottom:10px}.ipr-method h3{font-size:16px;font-weight:600;margin:22px 0 12px}.ipr-method ul{list-style:disc;padding-left:18px}.ipr-loading{display:flex;align-items:center;gap:10px;padding:35px;color:var(--muted-foreground)}summary{cursor:pointer}button svg{width:15px;height:15px}a:focus-visible,summary:focus-visible{outline:2px solid var(--ipr-accent);outline-offset:4px}@media(max-width:900px){.ipr-hero-grid{grid-template-columns:1fr}.ipr-scenarios{grid-template-columns:repeat(2,minmax(0,1fr))}.ipr-two-col{grid-template-columns:1fr}.ipr-score-number{font-size:48px}}@media(max-width:560px){.ipr-panel{padding:18px;border-radius:12px}.ipr-scenarios,.ipr-policy-grid{grid-template-columns:1fr}.ipr-facts>div{grid-template-columns:105px 1fr;gap:8px}.ipr-toolbar{align-items:flex-start}.ipr-toolbar>span{max-width:100%;overflow-wrap:anywhere}.ipr-query button{font-size:12px}.ipr-fit{font-size:22px}.ipr-scenario{min-height:200px}}
.ipr-toolbar>div{flex-wrap:wrap;max-width:100%}
</style>

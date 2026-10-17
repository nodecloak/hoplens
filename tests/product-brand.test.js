// Keep locale display copy and generated diagnostic Markdown on the fork's product brand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createI18n } from 'vue-i18n';
import { FULL_LOCALE_CODES } from '../common/locale-registry.js';
import { buildShareReport, reportToMarkdown } from '../frontend/utils/report-export.js';

const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
for(const locale of FULL_LOCALE_CODES)test(`${locale} diagnostic reports and display copy use IP.NodeCloak`,()=>{
  const pack=JSON.parse(readFileSync(new URL(`../frontend/locales/${locale}.json`,import.meta.url),'utf8'));
  assert(strings(pack).every(value=>! /\bMyIP\b/.test(value)),'Old product brand remains in display copy');
  const {t}=createI18n({legacy:false,locale,messages:{[locale]:pack}}).global;
  const report=buildShareReport({sections:{},selectedIds:[],maskTail:true,locale,origin:'ip.nodecloak.com'});
  const markdown=reportToMarkdown(report,t);
  assert(pack.report.ai.Heading.includes('IP.NodeCloak'));
  assert(pack.report.ai.Intro.includes('IP.NodeCloak'));
  assert(markdown.includes('IP.NodeCloak')&&markdown.includes('ip.nodecloak.com'));
  assert(!markdown.includes('MyIP'));
});

import { derived } from 'svelte/store';
import { contentLang } from '$lib/contentLang';
import { en, type Key } from './en';
import { hi } from './hi';
import { mr } from './mr';

/**
 * The site's words in the chosen language (English by default). In a component: `{$t('nav.learn')}`, or with
 * values `{$t('home.streak', { n: 5 })}`. A missing translation falls back to English. The language is the
 * one choice shared by the whole site, the Chess Guide and the Blog (src/lib/contentLang.ts).
 */
const DICT: Record<'en' | 'hi' | 'mr', Record<string, string>> = { en, hi, mr };

export const t = derived(contentLang, (lang) => (key: Key, vars?: Record<string, string | number>): string => {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  return s;
});

export type { Key };

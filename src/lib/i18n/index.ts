import { derived } from 'svelte/store';
import { contentLang } from '$lib/contentLang';
import { en, type Key } from './en';
import { hi } from './hi';
import { mr } from './mr';
import { racerWords } from './features/racer';
import { kidsClassWords } from './features/kidsclass';
import { awardsWords } from './features/awards';
import { cupsWords } from './features/cups';
import { lookWords } from './features/look';
import { gurusWords } from './features/gurus';
import { banWords } from './features/ban';
import { economyWords } from './features/economy';

/**
 * The site's words in the chosen language (English by default). In a component: `{$t('nav.learn')}`, or with
 * values `{$t('home.streak', { n: 5 })}`. A missing translation falls back to English. The language is the
 * one choice shared by the whole site, the Chess Guide and the Blog (src/lib/contentLang.ts).
 */
const FEATURES = [racerWords, kidsClassWords, awardsWords, cupsWords, lookWords, gurusWords, banWords, economyWords];
const DICT: Record<'en' | 'hi' | 'mr', Record<string, string>> = {
  en: Object.assign({}, en, ...FEATURES.map((f) => f.en)),
  hi: Object.assign({}, hi, ...FEATURES.map((f) => f.hi)),
  mr: Object.assign({}, mr, ...FEATURES.map((f) => f.mr)),
};
/** Every key: the site's (en.ts) and each feature's (features/*.ts). */
type FeatureKey = keyof typeof racerWords.en | keyof typeof kidsClassWords.en | keyof typeof awardsWords.en | keyof typeof cupsWords.en | keyof typeof lookWords.en | keyof typeof gurusWords.en | keyof typeof banWords.en | keyof typeof economyWords.en;
type AnyKey = Key | FeatureKey;

export const t = derived(contentLang, (lang) => (key: AnyKey, vars?: Record<string, string | number>): string => {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  return s;
});

export type { AnyKey as Key };
/** For tests: the features' word lists. */
export const FEATURE_WORDS = FEATURES;

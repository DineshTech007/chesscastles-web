import { writable } from 'svelte/store';
import type { Lang } from '$lib/coach/i18n';

/**
 * The language of the Chess Guide and the Blog (English by default; Hindi and Marathi on request). One
 * choice for both pages, kept in this browser. Chess words stay in English in all three languages.
 */
const KEY = 'cc.lang';

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'hi' || v === 'mr' ? v : 'en';
  } catch {
    return 'en';
  }
}

export const contentLang = writable<Lang>(typeof localStorage === 'undefined' ? 'en' : read());
/** The page's language attribute follows the choice (screen readers, hyphenation, fonts). */
if (typeof document !== 'undefined') contentLang.subscribe((l) => (document.documentElement.lang = l));

export function setContentLang(l: Lang) {
  contentLang.set(l);
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* kept for this visit only */
  }
}

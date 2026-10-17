/** Chess Guru speaks English, Hindi and Marathi (chess words always stay English). */
export type Lang = 'en' | 'hi' | 'mr';
export type L10n = Record<Lang, string>;

export const LANGS: { id: Lang; name: string; speech: string }[] = [
  { id: 'en', name: 'English', speech: 'en-IN' },
  { id: 'hi', name: 'हिन्दी', speech: 'hi-IN' },
  { id: 'mr', name: 'मराठी', speech: 'mr-IN' },
];

export const tr = (t: L10n, lang: Lang) => t[lang] || t.en;

/** Fills {name} placeholders. */
export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

import { writable } from 'svelte/store';
import { LANGS, type Lang } from './i18n';

/**
 * Guru's voice, free: the device's own voices (Microsoft Edge has natural
 * Indian voices; Chrome and Android use Google's).
 */

const speechCode = (lang: Lang) => LANGS.find((l) => l.id === lang)!.speech;
const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined);

/** Voices for a language, the most natural first; Marathi falls back to a Hindi voice (same script). */
export function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
  const all = synth()?.getVoices() ?? [];
  const code = speechCode(lang).toLowerCase();
  const prefix = code.slice(0, 2);
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase().replace('_', '-') === code ? 4 : 0) + (/natural|online|neural/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 1 : 0) + (/female|swara|aarohi|neerja|heera/i.test(v.name) ? 0.5 : 0);
  let list = all.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!list.length && lang === 'mr') list = all.filter((v) => v.lang.toLowerCase().startsWith('hi'));
  return list.sort((a, b) => score(b) - score(a));
}

/** Waits for the browser to load its voice list (Chrome loads it late). */
export function voicesReady(): Promise<void> {
  const s = synth();
  if (!s || s.getVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 1500);
    s.addEventListener('voiceschanged', () => (clearTimeout(t), resolve()), { once: true });
  });
}

/** Text tidied for speaking: no symbols, and squares spelled so voices read them well. */
export function speakable(text: string): string {
  return text
    .replace(/[*_#>`~|]/g, ' ')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** English chess words as Indian students say them, for Hindi and Marathi voices (which stumble on English spelling). */
const SPOKEN: Record<string, string> = {
  king: 'किंग', kings: 'किंग्ज', queen: 'क्वीन', queens: 'क्वीन्स', rook: 'रूक', rooks: 'रूक्स', bishop: 'बिशप', bishops: 'बिशप्स',
  knight: 'नाइट', knights: 'नाइट्स', pawn: 'पॉन', pawns: 'पॉन्स', piece: 'पीस', pieces: 'पीसेस', check: 'चेक', checkmate: 'चेकमेट',
  stalemate: 'स्टेलमेट', castling: 'कॅसलिंग', castle: 'कॅसल', fork: 'फोर्क', forks: 'फोर्क्स', pin: 'पिन', pinned: 'पिन्ड', skewer: 'स्क्यूअर',
  attack: 'अटॅक', defend: 'डिफेंड', capture: 'कॅप्चर', sacrifice: 'सॅक्रिफाइस', gambit: 'गॅम्बिट', promotion: 'प्रमोशन',
  opening: 'ओपनिंग', openings: 'ओपनिंग्ज', middlegame: 'मिडलगेम', endgame: 'एंडगेम', endgames: 'एंडगेम्स', centre: 'सेंटर', center: 'सेंटर',
  square: 'स्क्वेअर', squares: 'स्क्वेअर्स', rank: 'रँक', file: 'फाइल', diagonal: 'डायगोनल', move: 'मूव्ह', moves: 'मूव्ह्ज', draw: 'ड्रॉ',
  blunder: 'ब्लंडर', mistake: 'मिस्टेक', hint: 'हिंट', white: 'व्हाइट', black: 'ब्लॅक', board: 'बोर्ड', game: 'गेम', games: 'गेम्स',
  champion: 'चॅम्पियन', champions: 'चॅम्पियन्स', safe: 'सेफ', danger: 'डेंजर', problem: 'प्रॉब्लेम', try: 'ट्राय', arrow: 'ॲरो',
  box: 'बॉक्स', line: 'लाइन', lines: 'लाइन्स', royal: 'रॉयल', pressure: 'प्रेशर', control: 'कंट्रोल', solid: 'सॉलिड', offer: 'ऑफर',
  risky: 'रिस्की', strong: 'स्ट्राँग', weak: 'वीक', best: 'बेस्ट', special: 'स्पेशल', corner: 'कॉर्नर', bodyguard: 'बॉडीगार्ड',
  player: 'प्लेयर', players: 'प्लेयर्स', world: 'वर्ल्ड', master: 'मास्टर', grandmaster: 'ग्रँडमास्टर', grandmasters: 'ग्रँडमास्टर्स',
  match: 'मॅच', matches: 'मॅचेस', guru: 'गुरु', back: 'बॅक', shape: 'शेप', step: 'स्टेप', by: 'बाय', declined: 'डिक्लाइन्ड',
};
const LETTER: Record<string, string> = { a: 'ए', b: 'बी', c: 'सी', d: 'डी', e: 'ई', f: 'एफ', g: 'जी', h: 'एच' };
const NUMBER = ['', 'वन', 'टू', 'थ्री', 'फोर', 'फाइव्ह', 'सिक्स', 'सेव्हन', 'एट'];

/** Text for a Hindi or Marathi voice: chess words and squares spelled as they are said ("e4" -> "ई फोर"). */
export function forIndianVoice(text: string): string {
  return text
    .replace(/\b([a-h])-pawn\b/gi, (_, f: string) => `${LETTER[f.toLowerCase()]} ${SPOKEN.pawn}`)
    .replace(/\b([a-h])([1-8])\b/g, (_, f: string, r: string) => `${LETTER[f]} ${NUMBER[Number(r)]}`)
    .replace(/\bL\b/g, 'एल')
    .replace(/\b[A-Za-z]+\b/g, (w) => SPOKEN[w.toLowerCase()] ?? w);
}

let speakToken = 0;

/** True while Guru is speaking (the avatar's mouth moves). */
export const speaking = writable(false);

/** Speaks text sentence by sentence (long single utterances get cut off in Chrome). */
export async function speak(text: string, lang: Lang, voiceName?: string): Promise<void> {
  const s = synth();
  if (!s) return;
  stopSpeaking();
  await voicesReady();
  const token = ++speakToken;
  const voices = voicesFor(lang);
  const voice = voices.find((v) => v.name === voiceName) ?? voices[0];
  const indian = /^(hi|mr)/i.test(voice?.lang ?? '');
  const spoken = indian ? forIndianVoice(speakable(text)) : speakable(text);
  const parts = spoken.match(/[^.!?।]+[.!?।]?/g) ?? [];
  speaking.set(true);
  for (const part of parts) {
    if (token !== speakToken) return;
    if (!part.trim()) continue;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? speechCode(lang);
      u.rate = 0.95;
      u.pitch = 1.05;
      u.onend = u.onerror = () => resolve();
      s.speak(u);
    });
  }
  if (token === speakToken) speaking.set(false);
}

export function stopSpeaking() {
  speakToken++;
  synth()?.cancel();
  speaking.set(false);
}

export const canSpeak = (lang: Lang) => voicesFor(lang).length > 0;

/** Whether the device has a voice in exactly this language (not a stand-in). */
export const hasOwnVoice = (lang: Lang) => voicesFor(lang).some((v) => v.lang.toLowerCase().startsWith(speechCode(lang).slice(0, 2)));

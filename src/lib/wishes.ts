/**
 * Kind words: what chess players and well-wishers wrote about Chess Castles (the /wishes page). The owner adds them on
 * the admin page; the API keeps them (server/api-worker/src/wishes.ts).
 */
import { API } from '$lib/api';
import { call } from '$lib/social';

export type WishLang = 'en' | 'hi' | 'mr' | 'other';
/** The language's own name, for the "Read the original in …" link. */
export const WISH_LANG_NAME: Record<WishLang, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी', other: 'original' };

export interface Wish {
  id: string;
  name: string;
  /** Who they are: "International Master", "FIDE Arbiter", "Coach, Pune"… */
  role: string;
  /** As written; shown as paragraphs (toParagraphs). */
  text: string;
  /** The language the words were written in. */
  lang: WishLang;
  /** An English translation, when the words are not in English: shown first, with a link to the original. */
  en: string;
  /** The photo's version (0: no photo). */
  photo: number;
  hidden: boolean;
  created: number;
  updated: number;
}

/** Longer than this, a paragraph is split after a sentence so it reads easily (about four lines on a phone). */
const LONG = 600;
const SPLIT_AT = 320;
/** A line that ends a sentence: a full stop, a question or an emoji (🙏, ❤️…). */
const ENDS = /[.!?…:;"”’)\]\p{Extended_Pictographic}\u{FE0F}\u{1F3FB}-\u{1F3FF}]$/u;

/**
 * Text as pasted (from WhatsApp, an email, a letter) into tidy paragraphs, without changing a word:
 * - paragraphs are the blocks between empty lines; text without empty lines is taken line by line;
 * - a line that stops mid-sentence (an email's wrapped lines) runs on into the next;
 * - spaces are tidied (no doubles, none before a comma or full stop);
 * - a very long paragraph is split after a full sentence.
 */
export function toParagraphs(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((l) => l.trim());
  const blocks: string[][] = [[]];
  for (const l of lines) {
    if (l) blocks[blocks.length - 1].push(l);
    else if (blocks[blocks.length - 1].length) blocks.push([]);
  }
  const written = blocks.filter((b) => b.length);
  // Empty lines between paragraphs: each block is one (its lines run on). None: each line ends a paragraph unless
  // it stops mid-sentence.
  const paras =
    written.length > 1
      ? written.map((b) => b.join(' '))
      : (written[0] ?? []).reduce<string[]>((out, l) => {
          const prev = out[out.length - 1];
          if (prev !== undefined && !ENDS.test(prev) && /^[a-z(]/.test(l)) out[out.length - 1] = `${prev} ${l}`;
          else out.push(l);
          return out;
        }, []);
  return paras
    .map((p) => p.replace(/ +([,.;:!?])/g, '$1').replace(/ {2,}/g, ' ').trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > LONG ? splitLong(p) : [p]));
}

/** A long paragraph in parts of a few sentences each. */
function splitLong(p: string): string[] {
  const sentences = p.match(/[^.!?]+(?:[.!?]+["”’)]*|$)\s*/g) ?? [p];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    cur += s;
    if (cur.length >= SPLIT_AT) {
      out.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) {
    // A short tail joins the part before it.
    if (out.length && cur.trim().length < 120) out[out.length - 1] += ` ${cur.trim()}`;
    else out.push(cur.trim());
  }
  return out;
}

export const wishPhotoUrl = (w: Pick<Wish, 'id' | 'photo'>) => (w.photo ? `${API}/wishes/${w.id}/photo?v=${w.photo}` : undefined);

/** The words on the page, newest first (hidden ones left out). */
export async function fetchWishes(): Promise<Wish[]> {
  const r = await fetch(`${API}/wishes`);
  if (!r.ok) throw new Error('The kind words could not be loaded. Try again in a minute.');
  return ((await r.json()) as { wishes: Wish[] }).wishes;
}

// The owner's side (admin page).
export const adminWishes = () => call<{ wishes: Wish[] }>('GET', 'admin/wishes').then((r) => r.wishes);
/** `photo`: a new photo (base64 JPEG), null to take it away, undefined to keep it. */
export const saveWish = (w: { id?: string; name: string; role: string; text: string; lang: WishLang; en: string; hidden: boolean; photo?: string | null }) => call<{ wish: Wish }>('POST', 'admin/wishes', w).then((r) => r.wish);
export const deleteWish = (id: string) => call<{ ok: true }>('DELETE', `admin/wishes/${id}`);

/**
 * A photo for the page: square, 480 px, a JPEG under about 120 KB. Portraits are cut a little above the middle,
 * where faces are.
 */
export async function wishPhoto(file: Blob): Promise<string | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return undefined;
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) * 0.3;
  for (const [size, quality] of [[480, 0.85], [480, 0.72], [360, 0.7]] as const) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(size, side);
    canvas.getContext('2d')!.drawImage(bitmap, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    if (b64 && b64.length * 0.75 <= 120_000) return b64;
  }
  return undefined;
}

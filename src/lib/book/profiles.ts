import { CloudBook, LayeredBook, type BookSource } from './book';

/**
 * The FIDE-level opponent's books. With NEW_BOOKS_LIVE off (today) every game
 * uses the current book. Switched on, games use the newer, deeper book, and a
 * player can choose who the opponent plays like: girls or boys, and an age
 * group, so a child can prepare for a girls' or an age-group tournament. A
 * profile's own book answers first; when it has too few games for a position,
 * the general book does, and after that the engine.
 */
export const NEW_BOOKS_LIVE = false;

/**
 * The general book from the newer data (14-bit shards, like the current one),
 * on its own server: the current book.chesscastles.com stays as it is (the app
 * reads it too), and a free Cloudflare deployment holds up to 20,000 files.
 */
const GENERAL_V2 = 'https://book2.chesscastles.com/v2';
/** The small profile books (10-bit shards: 1,024 files each), together on a third. */
const PROFILES = 'https://book3.chesscastles.com/p';

export type Who = 'any' | 'girl' | 'boy';
export type AgeGroup = 'any' | 'u12' | 'u16';
export const WHO: { id: Who; label: string }[] = [
  { id: 'any', label: 'Anyone' },
  { id: 'girl', label: 'Girl' },
  { id: 'boy', label: 'Boy' },
];
export const AGES: { id: AgeGroup; label: string }[] = [
  { id: 'any', label: 'Any age' },
  { id: 'u12', label: 'Under 12' },
  { id: 'u16', label: 'Under 16' },
];

export const isWho = (v: unknown): v is Who => v === 'any' || v === 'girl' || v === 'boy';
export const isAge = (v: unknown): v is AgeGroup => v === 'any' || v === 'u12' || v === 'u16';

/** "Girl, under 12", or "" for anyone of any age. */
export function profileLabel(who: Who, age: AgeGroup): string {
  const parts = [who === 'girl' ? 'Girl' : who === 'boy' ? 'Boy' : '', age === 'u12' ? 'under 12' : age === 'u16' ? 'under 16' : ''].filter(Boolean);
  return parts.length ? parts.join(', ').replace(/^under/, 'Under') : '';
}

const profile = (name: string) => new CloudBook(`${PROFILES}/${name}`, 6000, undefined, 10n);

/** The book for an opponent of `rating` with a profile (any/any: the general book). */
export function opponentBook(rating: number, who: Who = 'any', age: AgeGroup = 'any'): BookSource {
  if (!NEW_BOOKS_LIVE) return new CloudBook();
  const layers: BookSource[] = [];
  if (who === 'girl' && age === 'u12') layers.push(profile('girls-u12'));
  if (who === 'girl') layers.push(profile('girls'));
  if (age === 'u12') layers.push(profile('u12'));
  if (age === 'u16') layers.push(profile('u16'));
  const general = new CloudBook(GENERAL_V2);
  return layers.length ? new LayeredBook([...layers, general], rating) : general;
}

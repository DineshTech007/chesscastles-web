/**
 * Chess Castles' chess library: public-domain books (scripts/build-books.py),
 * read on screen or listened to: human-read LibriVox audiobooks where they
 * exist, and the browser's voices reading any book aloud.
 */

export interface BookMeta {
  slug: string;
  title: string;
  author: string;
  year: number;
  level: string;
  notation: 'descriptive' | 'none';
  colour: string;
  about: string;
  chapters: number;
  words: number;
  images: number;
  audio: number;
  /** What it teaches: opening, middlegame, endgame, general. */
  topics?: ('opening' | 'middlegame' | 'endgame' | 'general')[];
  diagrams?: number;
}

export interface Book extends Omit<BookMeta, 'chapters' | 'words' | 'images' | 'audio' | 'diagrams'> {
  source: string;
  sourceName?: string;
  audioSource: string | null;
  audio: { title: string; url: string; seconds: number; reader: string }[];
  chapters: { title: string; html: string }[];
}

export const loadLibrary = (): Promise<BookMeta[]> => fetch('/books/index.json').then((r) => r.json());
export const loadBook = (slug: string): Promise<Book> =>
  fetch(`/books/${slug}/book.json`).then((r) => {
    if (!r.ok) throw new Error('This book could not be loaded.');
    return r.json();
  });

/** Reading minutes at about 200 words a minute. */
export const minutesOf = (words: number) => Math.max(1, Math.round(words / 200));

// ---------- where each book is up to (this browser) ----------

export interface BookProgress {
  chapter: number;
  /** How far down the chapter, 0..1. */
  scroll: number;
  /** Chapters read to the end. */
  read: number[];
  audioPart?: number;
  audioTime?: number;
  at: number;
}

const KEY = 'k24.books';
export function allProgress(): Record<string, BookProgress> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
export function progressOf(slug: string): BookProgress {
  return allProgress()[slug] ?? { chapter: 0, scroll: 0, read: [], at: 0 };
}
export function saveProgress(slug: string, p: Partial<BookProgress>) {
  try {
    const all = allProgress();
    all[slug] = { ...progressOf(slug), ...p, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

// ---------- reading aloud ----------

const PIECE: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', Kt: 'Knight', N: 'Knight', P: 'Pawn' };
/** "QB7" -> "Queen's Bishop 7", "K4" -> "King 4", "KKt3" -> "King's Knight 3". */
function squareWords(sq: string): string {
  const m = /^([KQ])?\s?(Kt|[RBN])?\s?([1-8])$/.exec(sq.trim());
  if (!m) return sq;
  const [, side, file, rank] = m;
  if (side && file) return `${PIECE[side]}'s ${PIECE[file]} ${rank}`;
  return `${PIECE[(side ?? file)!]} ${rank}`;
}

/**
 * Turns chess notation into words a voice can read: old descriptive
 * notation ("R-R7", "P x P", "K-Kt1 ch", "O-O") and modern moves ("Nf3",
 * "exd5", "Qxh7+"), so "1 R-R7, K-Kt1" is read "1, Rook to Rook 7. King to Knight 1".
 */
export function speakable(text: string): string {
  let t = text.replace(/ /g, ' ').replace(/\s+/g, ' ');
  t = t.replace(/\bO\s?-\s?O\s?-\s?O\b/g, 'castles queen side').replace(/\bO\s?-\s?O\b/g, 'castles king side');
  // Descriptive: piece, "-" or "x", then a square or a piece.
  t = t.replace(
    /\b(Kt|[KQRBNP])(?:\s?\((\w+)\))?\s?([-–—]|x|×)\s?((?:[KQ]\s?)?(?:Kt|[RBN])?\s?[1-8]|Kt|[KQRBNP])(?![a-z])/g,
    (_m, piece: string, _from, op: string, target: string) => {
      const what = /[1-8]$/.test(target) ? squareWords(target) : PIECE[target.trim()] ?? target;
      return `${PIECE[piece]} ${op === 'x' || op === '×' ? 'takes' : 'to'} ${what}`;
    },
  );
  t = t.replace(/\bch\b\.?/g, 'check').replace(/\bdis\.\s?ch\b/g, 'discovered check').replace(/\bmate\b/g, 'mate');
  // Modern algebraic moves.
  t = t.replace(/\b([KQRBN])([a-h])?([1-8])?(x)?([a-h][1-8])(=[QRBN])?([+#])?/g, (_m, p: string, _f, _r, x: string, sq: string, promo: string, chk: string) =>
    `${PIECE[p]} ${x ? 'takes ' : ''}${sq}${promo ? ` promotes to ${PIECE[promo[1]]}` : ''}${chk === '+' ? ', check' : chk === '#' ? ', checkmate' : ''}`,
  );
  t = t.replace(/\b([a-h])x([a-h][1-8])([+#])?/g, (_m, f: string, sq: string, chk: string) => `${f} takes ${sq}${chk === '+' ? ', check' : chk === '#' ? ', checkmate' : ''}`);
  // Move numbers: "12 R-..." / "12... K-..." read as "12." with a pause.
  t = t.replace(/\b(\d{1,3})\s?\.\.\.\s?/g, '$1, Black: ').replace(/;\s/g, '. ');
  return t;
}

/** Splits text into pieces a voice can read in one go (some browsers stop long ones). */
export function chunks(text: string, max = 220): string[] {
  const out: string[] = [];
  for (const sentence of text.match(/[^.!?;]+[.!?;]*\s*/g) ?? [text]) {
    if (!out.length || (out[out.length - 1] + sentence).length > max) out.push(sentence.trim());
    else out[out.length - 1] += ' ' + sentence.trim();
  }
  return out.filter((s) => s.length > 0);
}

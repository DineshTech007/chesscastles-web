/**
 * Rated puzzles from the puzzle bank (46,000 puzzles from the Lichess puzzle
 * database, CC0), in files of 100 rating points (scripts/build-puzzle-bands.py).
 * The next puzzle is one the player has not seen, a little above their rating
 * on average, the way a rating grows. Seen puzzles are remembered in this
 * browser (the last 6,000), so they don't come back.
 */
export type BandPuzzle = [id: string, fen: string, moves: string, rating: number, themes: string[]];

const MIN = 400;
const MAX = 2800;
const bands = new Map<number, Promise<BandPuzzle[]>>();

function band(b: number): Promise<BandPuzzle[]> {
  let f = bands.get(b);
  if (!f) {
    f = fetch(`/data/puzzles/bands/${b}.json`).then((r) => (r.ok ? (r.json() as Promise<BandPuzzle[]>) : []));
    f.catch(() => bands.delete(b));
    bands.set(b, f);
  }
  return f;
}

const SEEN = 'k24.seenPuzzles';
export function seenPuzzles(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]'));
  } catch {
    return new Set();
  }
}
export function markSeen(id: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(SEEN) ?? '[]');
    if (!list.includes(id)) localStorage.setItem(SEEN, JSON.stringify([...list, id].slice(-6000)));
  } catch {
    /* storage blocked */
  }
}

/**
 * The next rated puzzle for a player of `rating`: from −50 to +150 around it
 * (a little harder on average), never one seen before; nearer bands when one
 * runs out.
 */
export async function nextRated(rating: number, seen = seenPuzzles(), random = Math.random): Promise<BandPuzzle | undefined> {
  const target = rating - 50 + random() * 200;
  const first = Math.max(MIN, Math.min(MAX, Math.floor(target / 100) * 100));
  for (const d of [0, 100, -100, 200, -200, 300, -300, 400, -400]) {
    const b = first + d;
    if (b < MIN || b > MAX) continue;
    const fresh = (await band(b)).filter((p) => !seen.has(p[0]));
    if (fresh.length) return fresh[Math.floor(random() * fresh.length)];
  }
  return undefined;
}

/** Puzzle levels, named after the pieces: the road from Pawn to King. */
export const PUZZLE_LEVELS: { name: string; glyph: string; from: number }[] = [
  { name: 'Pawn', glyph: '♟', from: 0 },
  { name: 'Knight', glyph: '♞', from: 1000 },
  { name: 'Bishop', glyph: '♝', from: 1400 },
  { name: 'Rook', glyph: '♜', from: 1800 },
  { name: 'Queen', glyph: '♛', from: 2200 },
  { name: 'King', glyph: '♚', from: 2600 },
];
export function levelOf(rating: number) {
  let i = 0;
  while (i + 1 < PUZZLE_LEVELS.length && rating >= PUZZLE_LEVELS[i + 1].from) i++;
  const level = PUZZLE_LEVELS[Math.max(0, i)];
  const next = PUZZLE_LEVELS[i + 1];
  return { level, next, progress: next ? (rating - level.from) / (next.from - level.from) : 1 };
}

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
 * The next rated puzzle at difficulty `level` (the learning ladder below): within about 60 points of it, never
 * one seen before; nearer bands when one runs out.
 */
export async function nextRated(level: number, seen = seenPuzzles(), random = Math.random): Promise<BandPuzzle | undefined> {
  const target = level - 60 + random() * 120;
  const first = Math.max(MIN, Math.min(MAX, Math.floor(target / 100) * 100));
  for (const d of [0, 100, -100, 200, -200, 300, -300, 400, -400]) {
    const b = first + d;
    if (b < MIN || b > MAX) continue;
    const fresh = (await band(b)).filter((p) => !seen.has(p[0]));
    if (fresh.length) return fresh[Math.floor(random() * fresh.length)];
  }
  return undefined;
}

// ---------- the learning ladder ----------

/**
 * How hard the next puzzle is, apart from the rating: a staircase that starts easy for someone new (600, a
 * beginner's puzzle) and climbs a step with each puzzle solved first time, comes down a little after a miss
 * (and a bit after a skip), so a child solves about seven in ten and keeps going from Beginner to Master,
 * instead of meeting puzzles at the starting rating (1500) that are too hard. The rating stays the fair
 * measure (rating.ts); the ladder only picks the puzzles.
 */
const LADDER = 'cc.puzzleLadder';
export type LadderOutcome = 'clean' | 'solved' | 'missed' | 'skipped';

export function ladderLevel(rating: number, attempted: number): number {
  try {
    const v = Number(localStorage.getItem(LADDER));
    if (v >= MIN && v <= MAX) return v;
  } catch {
    /* storage blocked */
  }
  // New to puzzles: start easy. Someone with a real puzzle history starts a little under their rating.
  return attempted >= 30 ? Math.max(MIN, Math.min(MAX, rating - 100)) : 600;
}

/** Moves the ladder after a puzzle (`count`: puzzles done so far, for smaller steps once the level is found). */
export function moveLadder(level: number, outcome: LadderOutcome, count: number): number {
  const step = count < 15 ? 70 : count < 60 ? 45 : 30;
  const next = outcome === 'clean' ? level + step : outcome === 'solved' ? level + step / 3 : outcome === 'missed' ? level - step * 1.2 : level - 25;
  const v = Math.round(Math.max(MIN, Math.min(MAX, next)));
  try {
    localStorage.setItem(LADDER, String(v));
  } catch {
    /* storage blocked: for this visit only */
  }
  return v;
}

/** The stage of a puzzle difficulty, as children understand it. */
export const STAGES = [
  { name: 'Beginner', from: 0, color: '#22c55e' },
  { name: 'Intermediate', from: 1000, color: '#4d86e6' },
  { name: 'Advanced', from: 1500, color: '#c084fc' },
  { name: 'Master', from: 2000, color: '#edb040' },
] as const;
export const stageOf = (r: number) => [...STAGES].reverse().find((s) => r >= s.from) ?? STAGES[0];

/** Puzzle levels, named after the pieces: the road from Pawn to King. */
/** The puzzle levels, each with its trophy piece: bronze, silver, gold, emerald, ruby and crystal. */
export const PUZZLE_LEVELS: { name: string; glyph: string; from: number; image: string }[] = [
  { name: 'Pawn', glyph: '♟', from: 0, image: '/puzzles/level-pawn.webp' },
  { name: 'Knight', glyph: '♞', from: 1000, image: '/puzzles/level-knight.webp' },
  { name: 'Bishop', glyph: '♝', from: 1400, image: '/puzzles/level-bishop.webp' },
  { name: 'Rook', glyph: '♜', from: 1800, image: '/puzzles/level-rook.webp' },
  { name: 'Queen', glyph: '♛', from: 2200, image: '/puzzles/level-queen.webp' },
  { name: 'King', glyph: '♚', from: 2600, image: '/puzzles/level-king.webp' },
];
export function levelOf(rating: number) {
  let i = 0;
  while (i + 1 < PUZZLE_LEVELS.length && rating >= PUZZLE_LEVELS[i + 1].from) i++;
  const level = PUZZLE_LEVELS[Math.max(0, i)];
  const next = PUZZLE_LEVELS[i + 1];
  return { level, next, progress: next ? (rating - level.from) / (next.from - level.from) : 1 };
}

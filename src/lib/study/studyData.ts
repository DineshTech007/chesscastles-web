/** The opening study section's games and puzzles (built by scripts/study from CaissaBase). */

export interface ModelGame {
  id: number;
  line: string;
  white: string;
  black: string;
  we: number;
  be: number;
  year: number;
  event: string;
  result: string;
}

export interface StudyPuzzle {
  line: string;
  game: number;
  white: string;
  black: string;
  we: number;
  be: number;
  year: number;
  event: string;
  /** The position before the opponent's move (the mistake). */
  fen: string;
  /** UCI: the opponent's move, then the solution and replies. */
  moves: string[];
  /** The side that solves. */
  side: 'white' | 'black';
  phase: 'middlegame' | 'endgame';
  level: 1 | 2 | 3;
  /** Mate in n, when the solution mates. */
  mate?: number;
}

export interface StudyData {
  /** Classical games per line in the database (2000+ players). */
  stats: Record<string, number>;
  models: Record<string, ModelGame[]>;
  puzzles: StudyPuzzle[];
}

const cache = new Map<string, Promise<StudyData>>();
export function loadStudy(id: string): Promise<StudyData> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/data/study/${id}.json`).then((r) => {
      if (!r.ok) throw new Error('missing');
      return r.json() as Promise<StudyData>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export const LEVELS: { id: 1 | 2 | 3; name: string }[] = [
  { id: 1, name: 'Beginner' },
  { id: 2, name: 'Intermediate' },
  { id: 3, name: 'Advanced' },
];

export const puzzleId = (p: StudyPuzzle) => `${p.game}:${p.moves[0]}`;

const KEY = 'k24.studyPuzzles';
/** Puzzles solved (id -> true), kept in this browser. */
export function loadSolved(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
export function saveSolved(id: string) {
  const all = loadSolved();
  all[id] = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

/** "Tata Steel 2019": the event with its year, once. */
export const eventYear = (e: { event: string; year: number }) => (!e.year || e.event.includes(String(e.year)) ? e.event : `${e.event}, ${e.year}`);

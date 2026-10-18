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
  /** From the Lichess puzzle database (CC0); otherwise found by the engine in a CaissaBase game. */
  src?: 'lichess';
  /** The Lichess puzzle id. */
  pid?: string;
  /** The Lichess puzzle rating. */
  rating?: number;
  /** The CaissaBase game (engine-found puzzles). */
  game?: number;
  white?: string;
  black?: string;
  we?: number;
  be?: number;
  year?: number;
  event?: string;
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

/** A middlegame lesson: a model game of a chapter, continued right after the opening (scripts/study/middlegame.mjs). */
export interface MiddlegameLesson {
  chapter: string;
  game: number;
  white: string;
  black: string;
  whiteElo: number;
  blackElo: number;
  event: string;
  year: number;
  result: string;
  color: 'white' | 'black';
  fen: string;
  ply: number;
  plies: { u: string; e?: number; c?: 1 }[];
  critical: number;
  end: 'end' | 'decisive' | 'cut' | 'error';
}

const mgCache = new Map<string, Promise<MiddlegameLesson[]>>();
export function loadMiddlegame(id: string): Promise<MiddlegameLesson[]> {
  let p = mgCache.get(id);
  if (!p) {
    p = fetch(`/data/study/middlegame/${id}.json`).then((r) => (r.ok ? (r.json() as Promise<MiddlegameLesson[]>) : []));
    p.catch(() => mgCache.delete(id));
    mgCache.set(id, p);
  }
  return p;
}

export const LEVELS: { id: 1 | 2 | 3; name: string }[] = [
  { id: 1, name: 'Beginner' },
  { id: 2, name: 'Intermediate' },
  { id: 3, name: 'Advanced' },
];

export const puzzleId = (p: StudyPuzzle) => (p.pid ? `l${p.pid}` : `${p.game}:${p.moves[0]}`);

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

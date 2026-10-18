import { CATS, KIND_NAME, playerName, type Cat, type Goal, type MinorKind } from './content';

/** One ply of a lesson: the move (UCI); on the master's moves, its score and whether it was the only good move. */
export interface MasterPly {
  u: string;
  /** Centipawns for the master after this move (capped at ±2000). */
  e?: number;
  /** The only move that kept the result. */
  c?: 1;
}

export interface MasterLesson {
  /** The CaissaBase game id (also the lesson id within a teacher). */
  game: number;
  white: string;
  black: string;
  whiteElo: number;
  blackElo: number;
  event: string;
  year: number;
  result: string;
  /** The master's side. */
  color: 'white' | 'black';
  cat: Cat;
  kind?: MinorKind | null;
  goal: Goal;
  /** Where the lesson starts (the master to move). */
  fen: string;
  plies: MasterPly[];
  critical: number;
  /** Where the lesson stops: the game's end, a clearly won position, or partway (the game went on). */
  end: 'end' | 'decisive' | 'cut' | 'error';
}

export interface MastersIndex {
  teachers: Record<string, { count: number; cats: Partial<Record<Cat, number>> }>;
}

const lessonCache = new Map<string, Promise<MasterLesson[]>>();
let indexCache: Promise<MastersIndex> | undefined;

export const loadIndex = (): Promise<MastersIndex> =>
  (indexCache ??= fetch('/data/masters/index.json').then((r) => {
    if (!r.ok) throw new Error('missing');
    return r.json() as Promise<MastersIndex>;
  })).catch((e) => {
    indexCache = undefined;
    throw e;
  });

export function loadLessons(teacher: string): Promise<MasterLesson[]> {
  let p = lessonCache.get(teacher);
  if (!p) {
    p = fetch(`/data/masters/endgames/${teacher}.json`).then((r) => {
      if (!r.ok) throw new Error('missing');
      return r.json() as Promise<MasterLesson[]>;
    });
    p.catch(() => lessonCache.delete(teacher));
    lessonCache.set(teacher, p);
  }
  return p;
}

/** How hard a lesson is: 1 easy (winning, few only-moves) to 3 hard. */
export function difficulty(l: MasterLesson): 1 | 2 | 3 {
  const teacherMoves = l.plies.filter((p) => p.e !== undefined).length;
  let d = l.goal === 'win' ? 1 : 2;
  if (l.critical >= 3 || teacherMoves >= 14) d++;
  return Math.min(3, d) as 1 | 2 | 3;
}

const KEY = 'k24.masters';
/** Stars earned per lesson ("teacher/game" -> 1..3), kept in this browser. */
export function loadStars(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Saves a result; returns true the first time this lesson is finished. */
export function saveStars(teacher: string, game: number, stars: number): boolean {
  const all = loadStars();
  const k = `${teacher}/${game}`;
  const first = all[k] === undefined;
  all[k] = Math.max(all[k] ?? 0, stars);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
  return first;
}

/** The master's opponent, by name. */
export const opponentOf = (l: MasterLesson) => playerName(l.color === 'white' ? l.black : l.white);

/** "Rook endgame vs Nakamura". */
export function lessonTitle(l: MasterLesson): string {
  const name = l.cat === 'minor' && l.kind ? KIND_NAME[l.kind] : CATS.find((c) => c.id === l.cat)!.short;
  return `${name} vs ${opponentOf(l)}`;
}

/** "Tata Steel 2019": the event with its year, once. */
export const eventLabel = (l: Pick<MasterLesson, 'event' | 'year'>) =>
  !l.year || l.event.includes(String(l.year)) ? l.event : `${l.event}, ${l.year}`;

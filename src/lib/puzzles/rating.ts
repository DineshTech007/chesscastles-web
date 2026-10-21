import { derived, get, writable } from 'svelte/store';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import { db, session, STARTING_RATING } from '$lib/auth';
import { newRating, PLACEMENT, placementRating } from './elo';
export { newRating, PLACEMENT };

/**
 * The player's puzzle rating: the same one the app shows. Signed in, it is the
 * account's (users/{uid}: ratings.puzzle and the puzzles counts, written under
 * the same database rules as the app's); signed out, it is kept in this
 * browser. Like chess.com, a puzzle counts once, at its first result: solved
 * without help is a win; a wrong move, or a hint, is a loss. Trying again
 * after that changes nothing, and a puzzle already rated is never rated again.
 * The numbers are the app's (lib/profile/elo.dart): FIDE's K factors, at most
 * 40 points a puzzle, never under 400. A new player's first PLACEMENT puzzles
 * are different: the rating is provisional and moves toward the performance
 * over them (elo.ts), within the same database rules.
 */
interface Counts {
  rating: number;
  attempted: number;
  placeFrom?: number;
  solved: number;
  streak: number;
  best: number;
}

const LOCAL = 'k24.puzzleRating';
/** The themed puzzles' rating before there was one rating for all puzzles. */
const OLD_THEMES = 'k24.themePuzzles';
const RATED = 'k24.ratedPuzzles';

function readLocal(): Counts {
  try {
    const s = JSON.parse(localStorage.getItem(LOCAL) ?? 'null');
    if (s && typeof s.rating === 'number') return s;
    const old = JSON.parse(localStorage.getItem(OLD_THEMES) ?? '{}');
    return { rating: typeof old.rating === 'number' ? old.rating : STARTING_RATING, attempted: 0, solved: 0, streak: 0, best: 0 };
  } catch {
    return { rating: STARTING_RATING, attempted: 0, solved: 0, streak: 0, best: 0 };
  }
}

const local = writable<Counts>(typeof localStorage === 'undefined' ? { rating: STARTING_RATING, attempted: 0, solved: 0, streak: 0, best: 0 } : readLocal());

/** The rating to show: the account's when signed in, else this browser's. */
export const puzzleRating = derived([session, local], ([s, l]) => (s.status === 'in' && s.profile ? s.profile.ratings.puzzle : l.rating));
/** The counts to show (the account's when signed in). */
export const puzzleStats = derived([session, local], ([s, l]) => (s.status === 'in' && s.profile ? { rating: s.profile.ratings.puzzle, ...s.profile.puzzles } : l));
/** Rated puzzles done in placement: all of them, or those since an admin started placement again (`placeFrom`). */
export const puzzlePlaced = derived(puzzleStats, (s) => s.attempted - (s.placeFrom ?? 0));
/** Whether the rating is still provisional (the first PLACEMENT rated puzzles of placement): shown with a "?". */
export const puzzleProvisional = derived(puzzlePlaced, (n) => n < PLACEMENT);

const PLACING = 'cc.puzzlePlacement';
/** The placement puzzles' results in this browser ([puzzle rating, 1 or 0]), per account ('' for a visitor). */
function placementLog(who: string): [number, number][] {
  try {
    const all = JSON.parse(localStorage.getItem(PLACING) ?? '{}');
    return Array.isArray(all?.[who]) ? all[who] : [];
  } catch {
    return [];
  }
}
function savePlacement(who: string, log: [number, number][]) {
  try {
    const all = JSON.parse(localStorage.getItem(PLACING) ?? '{}');
    localStorage.setItem(PLACING, JSON.stringify({ ...(all && typeof all === 'object' ? all : {}), [who]: log.slice(-PLACEMENT) }));
  } catch {
    /* storage blocked: placement goes on from this visit's results */
  }
}

const HISTORY = 'k24.puzzleHistory';
/** The rating after each rated puzzle in this browser (the last 500), for the chart. */
export const puzzleHistory = writable<{ at: number; r: number; ok: boolean }[]>(
  typeof localStorage === 'undefined'
    ? []
    : (() => {
        try {
          return JSON.parse(localStorage.getItem(HISTORY) ?? '[]');
        } catch {
          return [];
        }
      })(),
);
function remember(r: number, ok: boolean) {
  puzzleHistory.update((h) => {
    const next = [...h, { at: Date.now(), r, ok }].slice(-500);
    try {
      localStorage.setItem(HISTORY, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
    return next;
  });
}

function ratedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RATED) ?? '[]');
  } catch {
    return [];
  }
}
/** Whether this puzzle was rated already (in this browser). */
export const wasRated = (id: string) => ratedIds().includes(id);

/**
 * Rates a puzzle's first result: `clean` when solved with no wrong move and no
 * hint. Returns the change, or undefined when it was rated before (or the
 * account could not be updated: the rating is then left as it was).
 */
export async function ratePuzzle(id: string, puzzleRating: number, clean: boolean, theme: string): Promise<number | undefined> {
  if (wasRated(id)) return undefined;
  try {
    localStorage.setItem(RATED, JSON.stringify([...ratedIds(), id].slice(-1000)));
  } catch {
    /* storage blocked: rated anyway */
  }
  const s = get(session);
  const score = clean ? 1 : 0;
  if (s.status === 'in' && s.profile) {
    const p = s.profile;
    const from = p.puzzles.placeFrom ?? 0;
    const placing = p.puzzles.attempted - from < PLACEMENT;
    // Placement started again: a new log.
    const who = from ? `${s.uid}:${from}` : s.uid;
    const log: [number, number][] = [...placementLog(who), [puzzleRating, score]];
    const after = placing ? placementRating(p.ratings.puzzle, log) : newRating(p.ratings.puzzle, puzzleRating, score, p.puzzles.attempted);
    const streak = clean ? p.puzzles.streak + 1 : 0;
    const key = theme.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40) || 'puzzle';
    const counts = { attempted: p.puzzles.attempted + 1, solved: p.puzzles.solved + (clean ? 1 : 0), streak, best: Math.max(p.puzzles.best, streak) };
    try {
      await updateDoc(doc(db, 'users', s.uid), {
        'ratings.puzzle': after,
        'puzzles.attempted': counts.attempted,
        'puzzles.solved': counts.solved,
        'puzzles.streak': counts.streak,
        'puzzles.best': counts.best,
        ...(clean ? { [`puzzles.themes.${key}`]: (p.puzzles.themes[key] ?? 0) + 1 } : {}),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Not saved (offline, or two puzzles within a few seconds): the rating stays as it was.
      return undefined;
    }
    if (placing) savePlacement(who, log);
    // The rating line starts once the level is found (the provisional steps would only look like a fall).
    if (counts.attempted - from >= PLACEMENT) remember(after, clean);
    session.update((cur) => (cur.status === 'in' && cur.profile ? { ...cur, profile: { ...cur.profile, ratings: { ...cur.profile.ratings, puzzle: after }, puzzles: { ...cur.profile.puzzles, ...counts, themes: clean ? { ...cur.profile.puzzles.themes, [key]: (cur.profile.puzzles.themes[key] ?? 0) + 1 } : cur.profile.puzzles.themes } } } : cur));
    return after - p.ratings.puzzle;
  }
  const l = get(local);
  const placing = l.attempted < PLACEMENT;
  const log: [number, number][] = [...placementLog(''), [puzzleRating, score]];
  const after = placing ? placementRating(l.rating, log) : newRating(l.rating, puzzleRating, score, l.attempted);
  if (placing) savePlacement('', log);
  const streak = clean ? l.streak + 1 : 0;
  const next: Counts = { rating: after, attempted: l.attempted + 1, solved: l.solved + (clean ? 1 : 0), streak, best: Math.max(l.best, streak) };
  local.set(next);
  if (next.attempted >= PLACEMENT) remember(after, clean);
  try {
    localStorage.setItem(LOCAL, JSON.stringify(next));
  } catch {
    /* storage blocked: for this visit only */
  }
  return after - l.rating;
}

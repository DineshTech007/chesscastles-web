import { derived, get, writable } from 'svelte/store';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import { db, session, STARTING_RATING } from '$lib/auth';
import { newRating } from './elo';
export { newRating };

/**
 * The player's puzzle rating: the same one the app shows. Signed in, it is the
 * account's (users/{uid}: ratings.puzzle and the puzzles counts, written under
 * the same database rules as the app's); signed out, it is kept in this
 * browser. Like chess.com, a puzzle counts once, at its first result: solved
 * without help is a win; a wrong move, or a hint, is a loss. Trying again
 * after that changes nothing, and a puzzle already rated is never rated again.
 * The numbers are the app's (lib/profile/elo.dart): FIDE's K factors, at most
 * 40 points a puzzle, never under 400.
 */
interface Counts {
  rating: number;
  attempted: number;
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
  if (s.status === 'in' && s.profile) {
    const p = s.profile;
    const after = newRating(p.ratings.puzzle, puzzleRating, clean ? 1 : 0, p.puzzles.attempted);
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
    session.update((cur) => (cur.status === 'in' && cur.profile ? { ...cur, profile: { ...cur.profile, ratings: { ...cur.profile.ratings, puzzle: after }, puzzles: { ...cur.profile.puzzles, ...counts, themes: clean ? { ...cur.profile.puzzles.themes, [key]: (cur.profile.puzzles.themes[key] ?? 0) + 1 } : cur.profile.puzzles.themes } } } : cur));
    return after - p.ratings.puzzle;
  }
  const l = get(local);
  const after = newRating(l.rating, puzzleRating, clean ? 1 : 0, l.attempted);
  const streak = clean ? l.streak + 1 : 0;
  const next: Counts = { rating: after, attempted: l.attempted + 1, solved: l.solved + (clean ? 1 : 0), streak, best: Math.max(l.best, streak) };
  local.set(next);
  try {
    localStorage.setItem(LOCAL, JSON.stringify(next));
  } catch {
    /* storage blocked: for this visit only */
  }
  return after - l.rating;
}

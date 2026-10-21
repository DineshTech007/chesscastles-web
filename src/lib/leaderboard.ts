import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite';
import { db, profileFrom, STARTING_RATING, type Profile } from './auth';
import { PLACEMENT } from './puzzles/elo';

export type Board = 'puzzle' | 'blitz' | 'rapid';

/** The top Chess Castles players by one rating (needs a signed-in player, as in the app). */
export async function leaderboard(board: Board, n = 50): Promise<Profile[]> {
  const snap = await getDocs(query(collection(db, 'users'), orderBy(`ratings.${board}`, 'desc'), limit(n)));
  return snap.docs.map((d) => profileFrom(d.id, d.data()));
}

/**
 * The top puzzle solvers: players whose level is found (PLACEMENT rated puzzles). Accounts that never rated a puzzle
 * keep the starting 1500 and used to fill the board above every child who had played: the query leaves them out (a
 * placed player at exactly 1500 too, until their next puzzle), the provisional ratings are left out here.
 */
export async function puzzleLeaders(n = 50): Promise<Profile[]> {
  const snap = await getDocs(query(collection(db, 'users'), where('ratings.puzzle', '!=', STARTING_RATING), orderBy('ratings.puzzle', 'desc'), limit(n + 30)));
  return snap.docs
    .map((d) => profileFrom(d.id, d.data()))
    .filter((p) => p.puzzles.attempted - (p.puzzles.placeFrom ?? 0) >= PLACEMENT)
    .slice(0, n);
}

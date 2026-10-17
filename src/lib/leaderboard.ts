import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore/lite';
import { db, profileFrom, type Profile } from './auth';

export type Board = 'puzzle' | 'blitz' | 'rapid';

/** The top Chess Castles players by one rating (needs a signed-in player, as in the app). */
export async function leaderboard(board: Board, n = 50): Promise<Profile[]> {
  const snap = await getDocs(query(collection(db, 'users'), orderBy(`ratings.${board}`, 'desc'), limit(n)));
  return snap.docs.map((d) => profileFrom(d.id, d.data()));
}

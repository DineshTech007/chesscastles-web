import type { KfideLeader } from '$lib/social';

/**
 * My place on the Puzzle Rush board, with my best as it is now (the board is shared for half a minute and my new
 * best reaches it a few seconds after the rush): the players with more ahead, and those with as many who were
 * there first.
 */
export function placeOf(rows: KfideLeader[], best: number, me: { uid: string; name: string }): { list: KfideLeader[]; rank: number } {
  const mine = rows.find((r) => r.me);
  const score = Math.max(mine?.rating ?? 0, best);
  const at = mine ? rows.indexOf(mine) : -1;
  const others = rows.filter((r) => !r.me);
  const ahead = others.filter((r) => r.rating > score || (r.rating === score && (at < 0 || rows.indexOf(r) < at))).length;
  const row: KfideLeader = { ...(mine ?? { uid: me.uid, name: me.name, username: '', country: '', games: 0 }), rating: score, me: true };
  const list = [...others];
  list.splice(ahead, 0, row);
  return { list, rank: ahead + 1 };
}

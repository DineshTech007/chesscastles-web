/**
 * A Lichess player's ratings (from Lichess's public profile, no sign-in
 * needed), for players who signed in with Lichess: the speeds they actually
 * play, kept for half an hour in this tab.
 */
export type LichessSpeed = 'bullet' | 'blitz' | 'rapid' | 'classical';
export const LICHESS_SPEEDS: LichessSpeed[] = ['bullet', 'blitz', 'rapid', 'classical'];
export const LICHESS_LABEL: Record<LichessSpeed, string> = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical' };

export interface LichessRating {
  speed: LichessSpeed;
  rating: number;
  games: number;
  /** Still settling (Lichess shows a ?). */
  provisional: boolean;
}

const KEEP_MS = 30 * 60_000;

export async function lichessRatings(username: string): Promise<LichessRating[]> {
  const key = `cc.lichessRatings.${username.toLowerCase()}`;
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (hit && Date.now() - hit.at < KEEP_MS) return hit.list;
  } catch {
    /* storage blocked */
  }
  const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Lichess answered ${res.status}`);
  const perfs = (await res.json()).perfs ?? {};
  const list: LichessRating[] = LICHESS_SPEEDS.filter((s) => perfs[s]?.games > 0).map((s) => ({ speed: s, rating: perfs[s].rating, games: perfs[s].games, provisional: !!perfs[s].prov }));
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), list }));
  } catch {
    /* storage blocked */
  }
  return list;
}

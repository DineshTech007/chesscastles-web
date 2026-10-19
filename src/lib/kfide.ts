import { outcome, type SavedGame } from '$lib/stores/myGames';

/**
 * CC Rating: the player's Chess Castles ratings, from their finished games
 * against the FIDE-rated bots, worked out the way FIDE rates players:
 * the expected score from the rating difference (at most 400 counts), and
 * a change of K × (score − expected) with K = 40 for the first 30 games,
 * then 20, and 10 from 2400. Like FIDE, there are three ratings, one for
 * each speed (Classical, Rapid, Blitz), and a game counts only for its own.
 * Each starts at 1500. Only games against FIDE-rated players count (FIDE
 * games and FIDE tournaments): never games against the computer or on
 * Lichess.
 */
export const KFIDE_START = 1500;
/** Fewer games than this and the rating is still provisional. */
export const KFIDE_PROVISIONAL = 5;

export interface KfideGame {
  id: string;
  at: number;
  opponent: number;
  score: number;
  before: number;
  after: number;
}

export interface Kfide {
  rating: number;
  games: number;
  provisional: boolean;
  history: KfideGame[];
}

export const expected = (r: number, opp: number) => 1 / (1 + 10 ** (Math.max(-400, Math.min(400, opp - r)) / 400));

const kFactor = (r: number, played: number) => (played < 30 ? 40 : r >= 2400 ? 10 : 20);

export type KfideSpeed = 'standard' | 'rapid' | 'blitz' | 'bullet';
export const KFIDE_SPEEDS: KfideSpeed[] = ['standard', 'rapid', 'blitz', 'bullet'];
export const SPEED_LABEL: Record<KfideSpeed, string> = { standard: 'Classical', rapid: 'Rapid', blitz: 'Blitz', bullet: 'Bullet' };

/**
 * The speed of a time control like "15+10" (minutes + seconds a move), from
 * the time for a 60-move game, as FIDE does: 10 minutes or less is Blitz,
 * under 60 Rapid, 60 or more Standard. FIDE has no Bullet; ours is Lichess's:
 * under 3 minutes for a 40-move game (1+0, 1+1, 2+1). No clock counts as Rapid.
 */
export function speedOf(timeControl: string): KfideSpeed {
  const m = /^(\d+(?:\.\d+)?)\+(\d+)$/.exec(timeControl.trim());
  if (!m) return 'rapid';
  if (Number(m[1]) * 60 + Number(m[2]) * 40 < 180) return 'bullet';
  const total = Number(m[1]) + Number(m[2]);
  return total <= 10 ? 'blitz' : total < 60 ? 'rapid' : 'standard';
}

/** A rating the owner set on the admin page: from `at` on, the speed's rating starts from `rating`. */
export interface RatingSet {
  rating: number;
  at: number;
}

export function computeKfide(games: SavedGame[], start = KFIDE_START, speed?: KfideSpeed, set?: RatingSet): Kfide {
  const rated = games
    .filter((g) => g.kind === 'fide' && g.opponentRating && outcome(g) !== 'unfinished' && (!speed || speedOf(g.timeControl) === speed))
    .sort((a, b) => a.playedAt - b.playedAt);
  let r = start;
  let setApplied = false;
  const history: KfideGame[] = [];
  for (const g of rated) {
    // The games after the owner set the rating count from it (the earlier ones stay in the history).
    if (set && !setApplied && g.playedAt > set.at) {
      r = set.rating;
      setApplied = true;
    }
    const o = outcome(g);
    const score = o === 'won' ? 1 : o === 'draw' ? 0.5 : 0;
    const before = r;
    r = Math.round(r + kFactor(r, history.length) * (score - expected(r, g.opponentRating!)));
    history.push({ id: g.id, at: g.playedAt, opponent: g.opponentRating!, score, before, after: r });
  }
  if (set && !setApplied) r = set.rating;
  return { rating: r, games: history.length, provisional: history.length < KFIDE_PROVISIONAL && !set, history };
}

export interface KfideAll {
  standard: Kfide;
  rapid: Kfide;
  blitz: Kfide;
  bullet: Kfide;
  /** The speed played most (the latest one on a tie): the headline CC Rating. */
  main: KfideSpeed;
}

/** All four CC Ratings. */
export function computeKfideAll(games: SavedGame[], start = KFIDE_START, sets: Partial<Record<KfideSpeed, RatingSet>> = {}): KfideAll {
  const [standard, rapid, blitz, bullet] = KFIDE_SPEEDS.map((s) => computeKfide(games, start, s, sets[s]));
  const all = { standard, rapid, blitz, bullet };
  const last = (k: Kfide) => k.history.at(-1)?.at ?? -1;
  const main = KFIDE_SPEEDS.reduce((a, b) => (all[b].games > all[a].games || (all[b].games === all[a].games && last(all[b]) > last(all[a])) ? b : a), 'rapid' as KfideSpeed);
  return { ...all, main };
}

/** "1612", or "1500 (new)" while it is provisional (fewer than KFIDE_PROVISIONAL games). */
export const kfideText = (k: Kfide) => `${k.rating}${k.provisional ? ' (new)' : ''}`;

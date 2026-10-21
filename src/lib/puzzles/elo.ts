/**
 * The puzzle rating's numbers, the same as the app's (lib/profile/elo.dart):
 * FIDE's K factors (40 for the first 30, 10 from 2400, else 20), at most 40
 * points a puzzle (the database rules check it), never under 400.
 */
const FLOOR = 400;
const MAX_CHANGE = 40;
const expected = (rating: number, opponent: number) => 1 / (1 + 10 ** ((opponent - rating) / 400));
const kFactor = (rating: number, played: number) => (played < 30 ? 40 : rating >= 2400 ? 10 : 20);

/** The rating after scoring `score` (1 solved, 0 missed) against a puzzle rated `opponent`, after `played` puzzles. */
export function newRating(rating: number, opponent: number, score: number, played: number): number {
  const change = Math.round(kFactor(rating, played) * (score - expected(rating, opponent)));
  return Math.max(FLOOR, rating + Math.max(-MAX_CHANGE, Math.min(MAX_CHANGE, change)));
}

/**
 * A new player's first rated puzzles: the rating is provisional (shown with a "?") until then. Every account starts
 * at 1500 (the database's rule), which says nothing about a child who has just begun, so these puzzles find the
 * real level the way FIDE rates an unrated player: by the performance over them.
 */
export const PLACEMENT = 15;
/** One virtual half point at this rating keeps the performance finite when every puzzle was solved (or missed). */
const PRIOR = 1000;
/** The most a placement puzzle moves the rating (the database rules allow 120 during placement, 40 after). */
const PLACEMENT_STEP = 120;

/** The performance over `results` ([puzzle rating, 1 solved or 0 missed]): the rating at which the expected score is the score. */
export function performance(results: [rating: number, score: number][]): number {
  const all: [number, number][] = [...results, [PRIOR, 0.5]];
  const score = all.reduce((s, [, x]) => s + x, 0);
  let lo = FLOOR;
  let hi = 2800;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (all.reduce((s, [r]) => s + expected(mid, r), 0) < score) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** A provisional rating's next value: toward the performance over the placement puzzles, at most 120 points a puzzle. */
export function placementRating(rating: number, results: [rating: number, score: number][]): number {
  const change = performance(results) - rating;
  return Math.max(FLOOR, rating + Math.max(-PLACEMENT_STEP, Math.min(PLACEMENT_STEP, change)));
}

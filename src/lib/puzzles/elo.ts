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

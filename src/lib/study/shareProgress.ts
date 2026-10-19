import { dayOf, streak, weekOf, weekPoints, type Activity } from './progress';
import type { FriendProgress } from '$lib/social';

/**
 * What a player's friends see of their study this week: points, puzzles, streak and the days studied.
 * Worked out from the study log and the puzzle counts, for the account (sent by the layout) and for the
 * "You" row on the Friends page, so both always agree.
 */
export interface WeekProgress extends FriendProgress {
  points: number;
}

export function weekProgress(acts: Activity[], puzzleRating: number, puzzlesSolved: number, now: number): WeekProgress {
  const week = weekOf(now);
  const thisWeek = acts.filter((a) => weekOf(a.at) === week);
  return {
    points: weekPoints(acts, now),
    puzzleRating: Math.round(puzzleRating),
    puzzlesWeek: thisWeek.filter((a) => a.kind === 'puzzle').length,
    puzzlesSolved,
    streak: streak(acts, now),
    studyDays: new Set(thisWeek.map((a) => dayOf(a.at))).size,
  };
}

/** The part sent to the account. */
export const sharedPart = ({ puzzleRating, puzzlesWeek, puzzlesSolved, streak: s, studyDays }: WeekProgress): FriendProgress => ({
  puzzleRating,
  puzzlesWeek,
  puzzlesSolved,
  streak: s,
  studyDays,
});

import { get } from 'svelte/store';
import { PUZZLE_LEVELS, levelOf } from './bank';
import { puzzleProvisional, puzzleRating, puzzleStats } from './rating';
import { recordPuzzle, type Badge } from './rewards';

/** A celebration after a puzzle: a new level, the level found after placement (`found`: the rating), or a badge. */
export type Moment = { level?: { name: string; image: string }; found?: number; badge?: Badge };

/**
 * After a puzzle, rated or by theme (call it once the rating is saved): its stars, the day's log and the badges
 * (rewards.ts), and what to celebrate. `before`: the rating before it; `placing`: whether it was one of placement's;
 * `rated`: whether its result changed the rating (not when it was rated before, or could not be saved).
 */
export function finishPuzzle(o: { solved: boolean; clean: boolean; inTime: boolean; before: number; placing: boolean; rated: boolean }): { stars: number; moments: Moment[] } {
  const rating = get(puzzleRating);
  const placed = !get(puzzleProvisional);
  const level = levelOf(rating).level;
  const moments: Moment[] = [];
  if (o.rated && o.placing && placed) moments.push({ level, found: rating });
  else if (o.rated && !o.placing && PUZZLE_LEVELS.indexOf(level) > PUZZLE_LEVELS.indexOf(levelOf(o.before).level)) moments.push({ level });
  const s = get(puzzleStats);
  const r = recordPuzzle({ solved: o.solved, clean: o.clean, inTime: o.inTime, streak: s.streak, solvedTotal: s.solved, rating, placed });
  return { stars: r.stars, moments: [...moments, ...r.earned.map((badge) => ({ badge }))] };
}

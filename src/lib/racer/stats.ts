import { writable } from 'svelte/store';

/**
 * The player's Puzzle Racer record, kept in this browser and sent with the study progress (the server keeps the
 * best: the Puzzle Racer leaderboard): best score, races, wins (first of two or more), podiums, battles won.
 */
export interface RacerStats {
  best: number;
  races: number;
  wins: number;
  podiums: number;
  battles: number;
  battleWins: number;
}
const KEY = 'k24.racer';
const EMPTY: RacerStats = { best: 0, races: 0, wins: 0, podiums: 0, battles: 0, battleWins: 0 };

function read(): RacerStats {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...EMPTY };
  }
}
export const racerStats = writable<RacerStats>(typeof localStorage === 'undefined' ? { ...EMPTY } : read());

/** A race finished: my score and place among how many. Returns whether it was a new best. */
export function recordRace(score: number, rank: number, of: number, duel: boolean): boolean {
  const s = read();
  const newBest = score > s.best;
  const next: RacerStats = {
    best: Math.max(s.best, score),
    races: s.races + 1,
    wins: s.wins + (rank === 1 && of > 1 ? 1 : 0),
    podiums: s.podiums + (rank <= 3 && of > 1 ? 1 : 0),
    battles: s.battles + (duel ? 1 : 0),
    battleWins: s.battleWins + (duel && rank === 1 ? 1 : 0),
  };
  racerStats.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return newBest;
}

import { writable, get } from 'svelte/store';

/**
 * Puzzle rewards, for kids above all: up to three stars a puzzle (solved; first try with no hint; within the
 * timer), a daily goal, days in a row, and badges for milestones. Kept in this browser; the rating itself is
 * the account's (rating.ts) and the rewards never change it.
 */

export interface DayLog {
  tried: number;
  solved: number;
  stars: number;
}

export interface Rewards {
  stars: number;
  /** Puzzles solved with all three stars. */
  three: number;
  badges: string[];
  days: Record<string, DayLog>;
  goal: number;
  timer: boolean;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  hint: string;
}

export const BADGES: Badge[] = [
  { id: 'first', icon: '🌱', name: 'First solve', hint: 'Solve your first puzzle' },
  { id: 'streak3', icon: '🔥', name: 'On fire', hint: '3 in a row, first try' },
  { id: 'streak5', icon: '⚡', name: 'Lightning', hint: '5 in a row, first try' },
  { id: 'streak10', icon: '🌟', name: 'Superstar', hint: '10 in a row, first try' },
  { id: 'goal', icon: '🎯', name: 'Goal getter', hint: 'Reach your daily goal' },
  { id: 'three5', icon: '🚀', name: 'Rocket', hint: '5 puzzles with 3 stars' },
  { id: 'three25', icon: '💫', name: 'Star collector', hint: '25 puzzles with 3 stars' },
  { id: 'solved10', icon: '🥉', name: '10 solved', hint: 'Solve 10 puzzles' },
  { id: 'solved50', icon: '🥈', name: '50 solved', hint: 'Solve 50 puzzles' },
  { id: 'solved100', icon: '🥇', name: '100 solved', hint: 'Solve 100 puzzles' },
  { id: 'solved500', icon: '🏆', name: '500 solved', hint: 'Solve 500 puzzles' },
  { id: 'days3', icon: '📅', name: '3 days in a row', hint: 'Solve puzzles 3 days in a row' },
  { id: 'days7', icon: '🗓️', name: 'A whole week', hint: 'Solve puzzles 7 days in a row' },
  { id: 'r1200', icon: '♞', name: 'Rating 1200', hint: 'Reach a puzzle rating of 1200' },
  { id: 'r1500', icon: '♝', name: 'Rating 1500', hint: 'Reach a puzzle rating of 1500' },
  { id: 'r1800', icon: '♜', name: 'Rating 1800', hint: 'Reach a puzzle rating of 1800' },
  { id: 'r2100', icon: '♛', name: 'Rating 2100', hint: 'Reach a puzzle rating of 2100' },
];

const KEY = 'cc.puzzleRewards';
const EMPTY: Rewards = { stars: 0, three: 0, badges: [], days: {}, goal: 10, timer: true };

function read(): Rewards {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return r && typeof r.stars === 'number' ? { ...EMPTY, ...r } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export const rewards = writable<Rewards>(typeof localStorage === 'undefined' ? { ...EMPTY } : read());

function save(r: Rewards) {
  rewards.set(r);
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage blocked: for this visit only */
  }
}

export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Days in a row with a solved puzzle, up to today (today not yet counted if nothing solved so far today). */
export function daysInRow(r: Rewards, now = Date.now()): number {
  let n = 0;
  let t = now;
  if (!r.days[dayKey(t)]?.solved) t -= 86_400_000;
  while (r.days[dayKey(t)]?.solved) {
    n++;
    t -= 86_400_000;
  }
  return n;
}

/** The last 7 days, oldest first, for the chart. */
export function lastWeek(r: Rewards, now = Date.now()): { key: string; label: string; log: DayLog }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const t = now - (6 - i) * 86_400_000;
    const key = dayKey(t);
    return { key, label: new Date(t).toLocaleDateString('en-GB', { weekday: 'narrow' }), log: r.days[key] ?? { tried: 0, solved: 0, stars: 0 } };
  });
}

/** Seconds for the countdown: more for harder puzzles. */
export const timerFor = (puzzleRating: number) => (puzzleRating < 1200 ? 60 : puzzleRating < 1700 ? 90 : 120);

/** Stars for one puzzle: solved, first try with no hint, within the time. */
export const starsFor = (solved: boolean, clean: boolean, inTime: boolean) => (solved ? 1 + (clean ? 1 : 0) + (inTime ? 1 : 0) : 0);

/**
 * Records one finished puzzle; returns its stars and any badges earned with it.
 * `streak`, `solvedTotal` and `rating` are the account's numbers after this puzzle.
 */
export function recordPuzzle(o: { solved: boolean; clean: boolean; inTime: boolean; streak: number; solvedTotal: number; rating: number }): { stars: number; earned: Badge[] } {
  const r = structuredClone(get(rewards));
  const stars = starsFor(o.solved, o.clean, o.inTime);
  const key = dayKey();
  const day = r.days[key] ?? { tried: 0, solved: 0, stars: 0 };
  r.days[key] = { tried: day.tried + 1, solved: day.solved + (o.solved ? 1 : 0), stars: day.stars + stars };
  // Only the last 60 days are kept.
  const keys = Object.keys(r.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete r.days[k];
  r.stars += stars;
  if (stars === 3) r.three += 1;
  const has = new Set(r.badges);
  const want: [string, boolean][] = [
    ['first', o.solved],
    ['streak3', o.streak >= 3],
    ['streak5', o.streak >= 5],
    ['streak10', o.streak >= 10],
    ['goal', r.days[key].solved >= r.goal],
    ['three5', r.three >= 5],
    ['three25', r.three >= 25],
    ['solved10', o.solvedTotal >= 10],
    ['solved50', o.solvedTotal >= 50],
    ['solved100', o.solvedTotal >= 100],
    ['solved500', o.solvedTotal >= 500],
    ['days3', daysInRow(r) >= 3],
    ['days7', daysInRow(r) >= 7],
    ['r1200', o.rating >= 1200],
    ['r1500', o.rating >= 1500],
    ['r1800', o.rating >= 1800],
    ['r2100', o.rating >= 2100],
  ];
  const earned = want.filter(([id, ok]) => ok && !has.has(id)).map(([id]) => BADGES.find((b) => b.id === id)!);
  r.badges = [...r.badges, ...earned.map((b) => b.id)];
  save(r);
  return { stars, earned };
}

export function setGoal(goal: number) {
  save({ ...get(rewards), goal });
}
export function setTimer(on: boolean) {
  save({ ...get(rewards), timer: on });
}

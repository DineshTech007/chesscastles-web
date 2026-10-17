import { writable } from 'svelte/store';

/** Something the player did that counts as study. */
export interface Activity {
  at: number;
  kind: 'puzzle' | 'trainer' | 'game' | 'analysis' | 'lesson';
  points: number;
  label: string;
}

export const POINTS = {
  puzzleSolved: 20,
  puzzleWithHint: 10,
  trainerRight: 5,
  trainerLine: 10,
  gameFinished: 10,
  gameAnalysed: 5,
  lessonFinished: 15,
} as const;

export interface Badge {
  id: string;
  name: string;
  hint: string;
  earned: boolean;
}

const KEY = 'k24.study';
const GOAL_KEY = 'k24.studyGoal';

/** "2026-10-16" in the player's time zone. */
export const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const prevDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return dayOf(new Date(y, m - 1, d - 1, 12).getTime());
};

/** Days studied in a row, ending today (or yesterday, until today is done). */
export function streak(activities: Activity[], now: number): number {
  const days = new Set(activities.map((a) => dayOf(a.at)));
  let day = dayOf(now);
  if (!days.has(day)) day = prevDay(day);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = prevDay(day);
  }
  return n;
}

export function bestStreak(activities: Activity[]): number {
  const days = [...new Set(activities.map((a) => dayOf(a.at)))].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of days) {
    run = prev && prevDay(d) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export const totalPoints = (a: Activity[]) => a.reduce((s, x) => s + x.points, 0);

export function monthPoints(a: Activity[], now: number): number {
  const prefix = dayOf(now).slice(0, 7);
  return a.filter((x) => dayOf(x.at).startsWith(prefix)).reduce((s, x) => s + x.points, 0);
}

/** Per day of the month: the kinds of study done. */
export function monthDays(a: Activity[], year: number, month: number): Map<number, Set<Activity['kind']>> {
  const out = new Map<number, Set<Activity['kind']>>();
  for (const x of a) {
    const d = new Date(x.at);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const set = out.get(d.getDate()) ?? new Set();
    set.add(x.kind);
    out.set(d.getDate(), set);
  }
  return out;
}

export function badges(a: Activity[], now: number, openingsLearned: number): Badge[] {
  const puzzles = a.filter((x) => x.kind === 'puzzle').length;
  const games = a.filter((x) => x.kind === 'game').length;
  const best = Math.max(bestStreak(a), streak(a, now));
  const points = totalPoints(a);
  return [
    { id: 'streak7', name: '7-day streak', hint: 'Study seven days in a row', earned: best >= 7 },
    { id: 'streak30', name: '30-day streak', hint: 'Study thirty days in a row', earned: best >= 30 },
    { id: 'puzzles25', name: 'Puzzle solver', hint: 'Solve 25 puzzles', earned: puzzles >= 25 },
    { id: 'games10', name: 'Fighter', hint: 'Finish 10 games', earned: games >= 10 },
    { id: 'opening', name: 'Opening expert', hint: 'Learn every position of an opening', earned: openingsLearned >= 1 },
    { id: 'points1000', name: '1,000 points', hint: 'Earn 1,000 study points', earned: points >= 1000 },
  ];
}

function read(): Activity[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function createStudy() {
  const { subscribe, set } = writable<Activity[]>([]);
  let list: Activity[] = [];
  return {
    subscribe,
    load() {
      list = read();
      set(list);
    },
    log(kind: Activity['kind'], points: number, label: string) {
      list = [...list, { at: Date.now(), kind, points, label }].slice(-5000);
      try {
        localStorage.setItem(KEY, JSON.stringify(list));
      } catch {
        /* storage full or blocked */
      }
      set(list);
    },
  };
}

export const study = createStudy();

/** Monthly points goal (the player can change it). */
export function loadGoal(): number {
  try {
    return Number(localStorage.getItem(GOAL_KEY)) || 1000;
  } catch {
    return 1000;
  }
}
export function saveGoal(n: number): void {
  try {
    localStorage.setItem(GOAL_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/** "2026-W42": the ISO week of a time, in the player's time zone. */
export function weekOf(ms: number): string {
  const d = new Date(ms);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - dow + 3);
  const firstThursday = new Date(day.getFullYear(), 0, 4);
  const week = 1 + Math.round(((day.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${day.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Study points earned this week (Monday to Sunday). */
export const weekPoints = (a: Activity[], now: number) => a.filter((x) => weekOf(x.at) === weekOf(now)).reduce((s, x) => s + x.points, 0);

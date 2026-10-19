import { CATALOG } from '$lib/coach/catalog';
import { loadCoach } from '$lib/coach/progress';
import type { LessonEntry } from '$lib/coach/types';

/**
 * The player's daily study plan: what to study on each day of the week, at
 * what time, and for how long. Kept in this browser; when reminders are on,
 * a copy goes to the reminder service (lib/study/reminders.ts).
 */
export type Topic = 'openings' | 'middlegame' | 'endgame' | 'tactics' | 'rest';

export interface StudyPlan {
  /** Sunday first, like Date.getDay(). */
  days: Topic[];
  /** "18:00", the player's local time. */
  time: string;
  minutes: number;
  /** Notifications at the planned time, and in the evening when the streak is in danger. */
  remind: boolean;
  /** When to warn about the streak, "20:30". */
  streakTime: string;
}

export const TOPICS: Record<Topic, { label: string; color: string; about: string }> = {
  openings: { label: 'Openings', color: 'var(--brand)', about: 'Opening trainer and opening lessons' },
  middlegame: { label: 'Middlegame', color: '#b46cff', about: 'Plans, pawn structures and attacking ideas' },
  endgame: { label: 'Endgame', color: 'var(--gold)', about: 'Key endgame positions and technique' },
  tactics: { label: 'Tactics', color: 'var(--win)', about: 'Puzzles and tactical patterns' },
  rest: { label: 'Rest', color: 'var(--muted)', about: 'A day off (a quick puzzle still keeps the streak)' },
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_PLAN: StudyPlan = {
  days: ['endgame', 'openings', 'middlegame', 'tactics', 'endgame', 'openings', 'middlegame'],
  time: '18:00',
  minutes: 30,
  remind: false,
  streakTime: '20:30',
};

const KEY = 'k24.studyPlan';

export function loadPlan(): StudyPlan {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (p && Array.isArray(p.days) && p.days.length === 7) return { ...DEFAULT_PLAN, ...p };
  } catch {
    /* first visit */
  }
  return { ...DEFAULT_PLAN, days: [...DEFAULT_PLAN.days] };
}

export function savePlan(p: StudyPlan) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

export const hasPlan = () => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

export const topicOn = (p: StudyPlan, date: Date) => p.days[date.getDay()];

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

/** The Coach lessons of a course (middlegame or endgame), easiest first, catalogue order within a level. */
export function course(category: 'middlegame' | 'endgame' | 'opening'): LessonEntry[] {
  return CATALOG.filter((l) => l.category === category)
    .map((l, i) => ({ l, i }))
    .sort((a, b) => LEVEL_ORDER[a.l.level] - LEVEL_ORDER[b.l.level] || a.i - b.i)
    .map((x) => x.l);
}

/** Where today's topic starts: the next unfinished lesson, or the puzzles / opening trainer. */
export function nextStep(topic: Topic): { href: string; title: string; sub: string } {
  const done = loadCoach().done;
  const lesson = (cat: 'middlegame' | 'endgame' | 'opening') => course(cat).find((l) => !done[l.id]);
  if (topic === 'tactics') {
    const t = CATALOG.find((l) => l.section === 'Tactics' && !done[l.id]);
    return t ? { href: `/coach/${t.id}`, title: t.title, sub: 'Then solve puzzles' } : { href: '/puzzles', title: 'Puzzles', sub: 'Solve puzzles for your session' };
  }
  if (topic === 'rest') return { href: '/puzzles?tab=daily', title: 'Puzzle of the day', sub: 'Optional: one puzzle keeps your streak' };
  const cat = topic === 'openings' ? 'opening' : topic;
  const l = lesson(cat);
  if (l) return { href: `/coach/${l.id}`, title: l.title, sub: `${l.section} · ${l.level}` };
  return topic === 'openings' ? { href: '/learn#openings', title: 'Opening trainer', sub: 'Review your openings' } : { href: '/coach', title: 'Every lesson done!', sub: 'Practise them again with the engine' };
}

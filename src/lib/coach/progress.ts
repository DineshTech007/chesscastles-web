import type { Lang } from './i18n';

/** Coach settings and progress, kept in this browser. */
const KEY = 'k24.coach.v2';

export interface CoachState {
  lang: Lang;
  voice: boolean;
  /** The voice picked for each language (by name). */
  voices: Partial<Record<Lang, string>>;
  /** Lessons finished (id -> time). */
  done: Record<string, number>;
  /** Practice: the engine strength last used. */
  rating: number;
  /** Guru's look (see avatar.ts). */
  avatar?: string;
}

const DEFAULT: CoachState = { lang: 'en', voice: true, voices: {}, done: {}, rating: 1200 };

export function loadCoach(): CoachState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveCoach(s: CoachState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private browsing: settings last for this visit only.
  }
}

export const updateCoach = (patch: Partial<CoachState>) => saveCoach({ ...loadCoach(), ...patch });

/** Marks a lesson finished; true the first time. */
export function markDone(id: string): boolean {
  const s = loadCoach();
  const first = !s.done[id];
  s.done[id] = Date.now();
  saveCoach(s);
  return first;
}

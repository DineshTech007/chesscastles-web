import type { GameSnapshot } from './fideGame';

/**
 * The game in progress against a Chess Castles bot, kept after every move so a
 * lost connection or a closed browser doesn't lose it: opening Chess Castles
 * again takes the player straight back to it.
 */
export interface ResumeState {
  /** The page that plays it (without the resume flag), e.g. "/play/fide?r=1800&tc=2". */
  route: string;
  /** The game's id in My games, so the resumed game updates the same record. */
  id: string;
  opponent: string;
  snapshot: GameSnapshot;
  /** Minutes on the clock (0: no clock). */
  minutes: number;
}

const KEY = 'k24.resume';
/** A game without a clock can be resumed for a day. */
const UNTIMED_MS = 24 * 3600_000;

export function saveResume(s: ResumeState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}
export function clearResume(id?: string) {
  try {
    if (!id || loadResume()?.id === id) localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
export function loadResume(): ResumeState | undefined {
  try {
    const s: ResumeState | null = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!s?.snapshot?.moves?.length) return undefined;
    // Too long ago: without a clock, a day; with one, whatever the clock allows
    // (the game itself then ends on time if the clock ran out, and is saved as such).
    if (!s.minutes && Date.now() - s.snapshot.savedAt > UNTIMED_MS) return undefined;
    return s;
  } catch {
    return undefined;
  }
}
/** The resume link for a page: its route with resume=1. */
export const resumeHref = (s: ResumeState) => `${s.route}${s.route.includes('?') ? '&' : '?'}resume=1`;

/** A page's own address without the resume flag: the route a saved game is matched against. */
export function routeOf(url: URL): string {
  const q = new URLSearchParams(url.search);
  q.delete('resume');
  const s = q.toString();
  return url.pathname + (s ? `?${s}` : '');
}
/** The saved game for this page, if the page was opened to resume it. */
export function resumeFor(url: URL): ResumeState | undefined {
  if (!url.searchParams.has('resume')) return undefined;
  const s = loadResume();
  return s && s.route === routeOf(url) ? s : undefined;
}

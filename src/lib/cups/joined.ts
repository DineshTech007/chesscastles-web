/**
 * The cups this browser joined (their start times), so the "your cup starts soon" popup needs no server calls
 * (src/lib/cups/CupAlerts.svelte). Kept a day; the server's list is the truth.
 */
const KEY = 'cc.cups';
export interface Joined {
  id: string;
  name: string;
  startAt: number;
}
export function joinedCups(now = Date.now()): Joined[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Joined[];
    return Array.isArray(v) ? v.filter((c) => c && typeof c.id === 'string' && c.startAt > now - 3 * 3600_000) : [];
  } catch {
    return [];
  }
}
export function rememberCup(c: Joined) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...joinedCups().filter((x) => x.id !== c.id), c]));
  } catch {
    /* private mode: no popup, the cup still works */
  }
}
export function forgetCup(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(joinedCups().filter((x) => x.id !== id)));
  } catch {
    /* nothing kept */
  }
}

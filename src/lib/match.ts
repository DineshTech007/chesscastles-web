/**
 * The friendly game (src/routes/play/match) this browser is playing, kept so every other page can show a bar back to it:
 * a stray tap away from a bullet game loses it on the clock (owner, 2026-10-21; the same rule as a Lichess game's bar).
 */
const KEY = 'cc.match';
const FRESH_MS = 20 * 60_000;
export interface RememberedMatch {
  id: string;
  opponent: string;
  at: number;
}
export function rememberMatch(m: { id: string; opponent: string }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...m, at: Date.now() } satisfies RememberedMatch));
  } catch {
    /* private mode */
  }
}
export function forgetMatch(id?: string) {
  try {
    if (!id || rememberedMatch()?.id === id) localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
export function rememberedMatch(): RememberedMatch | undefined {
  try {
    const m: RememberedMatch | null = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return m && Date.now() - m.at < FRESH_MS ? m : undefined;
  } catch {
    return undefined;
  }
}

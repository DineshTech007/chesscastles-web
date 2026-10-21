/**
 * Games the player aborted in this browser (the last day of them), as chess.com counts them: Abort asks first, and
 * after a few in a day the game page asks them to play the games they start (owner's request, 2026-10-21).
 */
const KEY = 'cc.aborts';
const DAY = 86_400_000;
/** From this many aborts in a day, the game page shows its note. */
export const ABORTS_NOTE = 3;

function read(now: number): number[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((t): t is number => typeof t === 'number' && now - t < DAY) : [];
  } catch {
    return [];
  }
}

/** A game was aborted now. */
export function noteAbort(now = Date.now()) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...read(now), now].slice(-20)));
  } catch {
    /* storage blocked: not counted */
  }
}

/** Games aborted in the last 24 hours. */
export const abortsToday = (now = Date.now()) => read(now).length;

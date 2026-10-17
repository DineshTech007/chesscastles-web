import { writable } from 'svelte/store';

/**
 * Game-play preferences (like chess.com's Settings): whether a pawn promotes
 * straight to a queen or asks which piece, and whether premoves are allowed
 * at all. Both default to the usual choice and are saved per device.
 */
function stored(key: string, def: boolean) {
  const store = writable(def);
  if (typeof localStorage !== 'undefined') {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) store.set(v === '1');
    } catch {
      /* default */
    }
  }
  return {
    ...store,
    set(v: boolean) {
      store.set(v);
      try {
        localStorage.setItem(key, v ? '1' : '0');
      } catch {
        /* private mode */
      }
    },
  };
}

/** Promote a pawn straight to a queen (off: ask which piece each time). */
export const autoQueen = stored('k24.autoQueen', true);
/** Allow queueing a move while the opponent is thinking. */
export const premovesOn = stored('k24.premoves', true);

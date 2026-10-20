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

/** "Always promote to Queen": a pawn becomes a queen at once. Off (the default): the player picks the piece. */
export const autoQueen = stored('k24.autoQueen', false);
/** Allow queueing a move while the opponent is thinking. */
export const premovesOn = stored('k24.premoves', true);

/** How a computer opponent spends its thinking time: within a few seconds (quick), or like a tournament player (real). */
export type OpponentPace = 'quick' | 'real';
function storedPace() {
  const store = writable<OpponentPace>('quick');
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem('k24.pace') === 'real') store.set('real');
    } catch {
      /* default quick */
    }
  }
  return {
    subscribe: store.subscribe,
    set(v: OpponentPace) {
      store.set(v);
      try {
        localStorage.setItem('k24.pace', v);
      } catch {
        /* private mode */
      }
    },
  };
}
export const opponentPace = storedPace();

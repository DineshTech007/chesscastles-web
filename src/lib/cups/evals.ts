import { writable } from 'svelte/store';
import { engine, evalLabel, whiteChances } from '$lib/engine/stockfish';

/**
 * Quick engine looks at many positions (owner, 2026-10-23: engine bars on the main board, in the pairings and on every small
 * board "to create excitement"): one Stockfish in this browser, a position at a time (the engine queues them), a short look
 * each (depth 9, at most 0.7 s), remembered by position. Only for games the viewer is not playing.
 */
export interface Look {
  share: number;
  text: string;
}
const cache = new Map<string, Look>();
const asked = new Set<string>();
/** Bumped when a new look arrives: bars read their position again. */
export const evalTick = writable(0);
const MAX_WAITING = 10;

export function evalOf(fen: string): Look | undefined {
  return cache.get(fen);
}

/** Asks for a look at a position (nothing happens if there is one already, or too many are waiting). */
export function wantEval(fen: string) {
  if (cache.has(fen) || asked.has(fen) || asked.size >= MAX_WAITING) return;
  asked.add(fen);
  engine
    .evaluate(fen, 9, 1, 700)
    .then((i) => {
      if (!i) return;
      cache.set(fen, { share: whiteChances(i), text: evalLabel(i) });
      // The memory stays small: a cup's positions are many, only the latest are of use.
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
      evalTick.update((n) => n + 1);
    })
    .catch(() => {})
    .finally(() => asked.delete(fen));
}

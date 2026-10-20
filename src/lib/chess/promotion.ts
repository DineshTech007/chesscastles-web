import { get, writable } from 'svelte/store';
import type { Chess } from 'chessops/chess';
import type { Color, NormalMove, Role } from 'chessops/types';
import { autoQueen } from '$lib/preferences';
import { isPromotion, squareOfKey } from './position';

/**
 * Promotion for every board, like chess.com's "Always promote to Queen": on, a pawn on the last rank becomes a
 * queen at once; off, the player picks the piece (PromotionHost, in the layout, shows the picker). Boards that
 * expect an answer (puzzles, trainers) always ask when the answer is another piece, so it can be found.
 */

/** The picker on screen: its colour, and what to do with the choice (undefined: closed without one). */
export const promotionAsk = writable<{ color: Color; answer: (role: Role | undefined) => void } | undefined>();

/** Whether this pawn move needs the picker: the setting is off, or the expected answer promotes to another piece. */
export function asksForPiece(pos: Chess, orig: string, dest: string, expected?: NormalMove, always = get(autoQueen)): boolean {
  if (!isPromotion(pos, orig, dest)) return false;
  if (!always) return true;
  return !!expected?.promotion && expected.promotion !== 'queen' && expected.from === squareOfKey(orig) && expected.to === squareOfKey(dest);
}

/**
 * The piece for a move: undefined when it is not a promotion, the queen when no choice is needed, otherwise the
 * one the player picks, or null when they close the picker (the board should then put the pawn back).
 */
export function promotionFor(pos: Chess, orig: string, dest: string, expected?: NormalMove): Promise<Role | undefined | null> {
  if (!isPromotion(pos, orig, dest)) return Promise.resolve(undefined);
  if (!asksForPiece(pos, orig, dest, expected)) return Promise.resolve('queen');
  return new Promise((resolve) =>
    promotionAsk.set({
      color: pos.turn,
      answer: (role) => {
        promotionAsk.set(undefined);
        resolve(role ?? null);
      },
    }),
  );
}

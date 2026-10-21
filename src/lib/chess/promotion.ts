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

/** Where the picker opens: the promotion square on screen, and which way its column of pieces runs. */
export interface PromotionAnchor {
  left: number;
  top: number;
  /** One square, in pixels. */
  size: number;
  /** The square is in the board's top half: the pieces run down from it (else up). */
  down: boolean;
}

/** The board last touched: the one a promotion comes from. */
let lastBoard: Element | undefined;
if (typeof document !== 'undefined')
  document.addEventListener(
    'pointerdown',
    (e) => {
      const wrap = (e.target as Element | null)?.closest?.('.cg-wrap');
      if (wrap?.querySelector('cg-board')) lastBoard = wrap;
    },
    { capture: true, passive: true },
  );

/**
 * The promotion square `dest` ("e8") on screen, on the board last touched, so the picker opens on the pawn as on
 * Lichess and chess.com (owner, 2026-10-21: it opened in the middle of the screen). Undefined when it isn't known.
 */
export function promotionAnchor(dest: string): PromotionAnchor | undefined {
  const wrap = lastBoard;
  const r = wrap?.isConnected ? wrap.querySelector('cg-board')?.getBoundingClientRect() : undefined;
  const file = dest.charCodeAt(0) - 97;
  const rank = Number(dest[1]) - 1;
  if (!wrap || !r || r.width < 80 || !(file >= 0 && file <= 7 && rank >= 0 && rank <= 7)) return undefined;
  const size = r.width / 8;
  const black = wrap.classList.contains('orientation-black');
  const col = black ? 7 - file : file;
  const row = black ? rank : 7 - rank;
  return { left: r.left + col * size, top: r.top + row * size, size, down: row < 4 };
}

/** The picker on screen: its colour, where it opens, and what to do with the choice (undefined: closed without one). */
export const promotionAsk = writable<{ color: Color; anchor?: PromotionAnchor; answer: (role: Role | undefined) => void } | undefined>();

/** Whether this pawn move needs the picker: the setting is off, or the expected answer promotes to another piece. */
export function asksForPiece(pos: Chess, orig: string, dest: string, expected?: NormalMove, always = get(autoQueen)): boolean {
  if (!isPromotion(pos, orig, dest)) return false;
  if (!always) return true;
  return !!expected?.promotion && expected.promotion !== 'queen' && expected.from === squareOfKey(orig) && expected.to === squareOfKey(dest);
}

/**
 * The piece for a move: undefined when it is not a promotion, the queen when no choice is needed, otherwise the
 * one the player picks, or null when they close the picker (the board should then put the pawn back). `color` is the
 * pawn's, for a premove (made while the other side is to move).
 */
export function promotionFor(pos: Chess, orig: string, dest: string, expected?: NormalMove, color: Color = pos.turn): Promise<Role | undefined | null> {
  if (!isPromotion(pos, orig, dest)) return Promise.resolve(undefined);
  if (!asksForPiece(pos, orig, dest, expected)) return Promise.resolve('queen');
  return new Promise((resolve) =>
    promotionAsk.set({
      color,
      anchor: promotionAnchor(dest),
      answer: (role) => {
        promotionAsk.set(undefined);
        resolve(role ?? null);
      },
    }),
  );
}

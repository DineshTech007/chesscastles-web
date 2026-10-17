import { Chess } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSan, parseSan } from 'chessops/san';
import type { NormalMove, Role, Square } from 'chessops/types';
import { makeSquare, makeUci, parseSquare, parseUci } from 'chessops/util';
import type { Key } from '@lichess-org/chessground/types';

export type { NormalMove };

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function positionFromFen(fen: string): Chess {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
}

export function fenOf(pos: Chess): string {
  return makeFen(pos.toSetup());
}

/** Plays space-separated SAN moves from the start. Throws on an illegal move. */
export function playSans(sans: string, from = Chess.default()): Chess {
  const pos = from.clone();
  for (const raw of sans.trim().split(/\s+/)) {
    const san = raw.replace(/^\d+\.+/, '');
    if (!san) continue;
    const move = parseSan(pos, san);
    if (!move) throw new Error(`Not a legal move here: ${san}`);
    pos.play(move);
  }
  return pos;
}

export function uciToMove(uci: string): NormalMove | undefined {
  const m = parseUci(uci);
  return m && 'from' in m ? m : undefined;
}

export const moveToUci = (m: NormalMove): string => makeUci(m);

/** SAN of [move] in [pos] (which is not changed). */
export const sanOf = (pos: Chess, move: NormalMove): string => makeSan(pos, move);

/** Legal destinations in chessground's format (castling both ways). */
export const destsOf = (pos: Chess) => chessgroundDests(pos);

export const keyOf = (sq: Square): Key => makeSquare(sq) as Key;
export const squareOfKey = (k: string): Square => parseSquare(k)!;

/** The board move a chessground drag means, with promotion when needed. */
export function moveFromKeys(pos: Chess, orig: string, dest: string, promotion?: Role): NormalMove {
  const from = squareOfKey(orig);
  const to = squareOfKey(dest);
  const piece = pos.board.get(from);
  const rank = Math.floor(to / 8);
  const promo = piece?.role === 'pawn' && (rank === 0 || rank === 7);
  return promo ? { from, to, promotion: promotion ?? 'queen' } : { from, to };
}

const VALUES: Partial<Record<Role, number>> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 };
const START: Partial<Record<Role, number>> = { pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1 };
const GLYPH: Partial<Record<Role, string>> = {
  queen: '♕',
  rook: '♖',
  bishop: '♗',
  knight: '♘',
  pawn: '♙',
};

/** The opponent's pieces [color] has taken, as glyphs, and its material lead. */
export function materialOf(pos: Chess, color: 'white' | 'black'): { captured: string; lead: number } {
  const other = color === 'white' ? 'black' : 'white';
  let mine = 0;
  let theirs = 0;
  let captured = '';
  for (const role of ['queen', 'rook', 'bishop', 'knight', 'pawn'] as Role[]) {
    const m = pos.board.pieces(color, role).size();
    const t = pos.board.pieces(other, role).size();
    mine += m * VALUES[role]!;
    theirs += t * VALUES[role]!;
    captured += GLYPH[role]!.repeat(Math.max(0, START[role]! - t));
  }
  return { captured, lead: mine - theirs };
}

import type { Chess } from 'chessops/chess';
import { squareFile, squareRank } from 'chessops/util';
import type { Role } from 'chessops/types';
import { POLYGLOT } from './polyglotTable';

const ROLE_INDEX: Record<Role, number> = {
  pawn: 0,
  knight: 1,
  bishop: 2,
  rook: 3,
  queen: 4,
  king: 5,
};

/** True when the side to move has a legal en passant capture. */
function legalEnPassant(pos: Chess): boolean {
  const ep = pos.epSquare;
  if (ep === undefined) return false;
  for (const from of pos.board.pieces(pos.turn, 'pawn')) {
    if (pos.dests(from).has(ep)) return true;
  }
  return false;
}

/**
 * The Polyglot Zobrist key of a position, as an unsigned 64-bit bigint.
 *
 * The en passant file counts only when the capture is legal, matching
 * dartchess `zobristHash()` in the app and the book builder, so the website
 * and the app look up exactly the same positions.
 */
export function polyglotKey(pos: Chess): bigint {
  let h = 0n;
  for (const [square, piece] of pos.board) {
    const kind = 2 * ROLE_INDEX[piece.role] + (piece.color === 'white' ? 1 : 0);
    h ^= POLYGLOT[64 * kind + 8 * squareRank(square) + squareFile(square)];
  }
  const rights = pos.castles.castlingRights;
  if (rights.has(7)) h ^= POLYGLOT[768]; // white short (h1)
  if (rights.has(0)) h ^= POLYGLOT[769]; // white long (a1)
  if (rights.has(63)) h ^= POLYGLOT[770]; // black short (h8)
  if (rights.has(56)) h ^= POLYGLOT[771]; // black long (a8)
  if (legalEnPassant(pos)) h ^= POLYGLOT[772 + squareFile(pos.epSquare!)];
  if (pos.turn === 'white') h ^= POLYGLOT[780];
  return h;
}

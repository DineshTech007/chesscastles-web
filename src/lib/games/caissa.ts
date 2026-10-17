import { Chess } from 'chessops/chess';
import type { NormalMove, Role } from 'chessops/types';
import { squareFile, squareRank } from 'chessops/util';
import { positionFromFen } from '$lib/chess/position';

/**
 * Decodes CaissaBase games (En Croissant's format): each byte is the index
 * of the move in the legal-move list that the Rust library shakmaty 0.27
 * generates. This reproduces shakmaty's order exactly (the same logic as the
 * app's tool/gamesdb/decode.dart, checked against the stored material):
 * en passant; pawn captures toward the a-file then the h-file (plain before
 * promotions, by destination); pushes; push promotions; double pushes;
 * knights; bishops; rooks; queens; king; castling king side then queen side.
 * In check the king moves come right after en passant.
 */

const PROMOS: Role[] = ['queen', 'rook', 'bishop', 'knight'];
const PIECE_GROUP: Partial<Record<Role, number>> = { knight: 16, bishop: 18, rook: 20, queen: 22 };

export function shakmatyOrder(pos: Chess): NormalMove[] {
  const keyed: [number, NormalMove][] = [];
  const inCheck = pos.isCheck();
  for (const [from, dests] of pos.allDests()) {
    const piece = pos.board.get(from)!;
    for (const to of dests) {
      if (piece.role === 'pawn') {
        const capture = squareFile(from) !== squareFile(to);
        const ep = capture && !pos.board.get(to);
        const promo = squareRank(to) === 0 || squareRank(to) === 7;
        let group: number;
        if (ep) group = 0;
        else if (capture) group = (squareFile(to) < squareFile(from) ? 4 : 8) + (promo ? 2 : 0);
        else if (Math.abs(to - from) === 16) group = 14;
        else group = promo ? 13 : 12;
        const sq = ep ? from : to;
        if (promo) {
          PROMOS.forEach((p, i) => keyed.push([(group << 20) | (sq << 8) | i, { from, to, promotion: p }]));
        } else {
          keyed.push([(group << 20) | (sq << 8), { from, to }]);
        }
      } else {
        let group: number;
        if (piece.role === 'king') {
          const target = pos.board.get(to);
          if (target && target.color === pos.turn) group = squareFile(to) > squareFile(from) ? 26 : 28;
          else group = inCheck ? 2 : 24;
        } else {
          group = PIECE_GROUP[piece.role]!;
        }
        keyed.push([(group << 20) | (from << 14) | (to << 8), { from, to }]);
      }
    }
  }
  keyed.sort((a, b) => a[0] - b[0]);
  return keyed.map((k) => k[1]);
}

/** Main-line move bytes, skipping variations (255/254), comments (253) and NAGs (252). */
export function* mainlineBytes(raw: Uint8Array): Generator<number> {
  let i = 0;
  let depth = 0;
  while (i < raw.length) {
    const b = raw[i++];
    if (b === 255) depth++;
    else if (b === 254) depth = Math.max(0, depth - 1);
    else if (b === 253 || b === 252) {
      if (i + 2 > raw.length) return;
      i += 2 + (raw[i] | (raw[i + 1] << 8));
    } else if (depth === 0) yield b;
  }
}

export function base64Bytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** The game's moves; stops at the first byte that doesn't fit (never throws). */
export function decodeMoves(movesB64: string, fen?: string): { start: Chess; moves: NormalMove[] } {
  const start = fen ? positionFromFen(fen) : Chess.default();
  const pos = start.clone();
  const moves: NormalMove[] = [];
  for (const b of mainlineBytes(base64Bytes(movesB64))) {
    const legal = shakmatyOrder(pos);
    if (b >= legal.length) break;
    const m = legal[b];
    pos.play(m);
    moves.push(m);
  }
  return { start, moves };
}

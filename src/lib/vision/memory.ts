import type { Chess } from 'chessops/chess';
import type { Color, Role } from 'chessops/types';
import { makeSquare, parseSquare } from 'chessops/util';
import { parseSan } from 'chessops/san';
import type { NormalMove } from 'chessops/types';
import { positionFromFen, START_FEN } from '$lib/chess/position';

/**
 * Move Memory: follow a real opening line in notation only, then answer a
 * question about the final position ("what is on f6?", "where is the
 * knight that started on g1?"). Lines come from the opening library.
 */

export const ROLE_NAME: Record<Role, string> = { king: 'King', queen: 'Queen', rook: 'Rook', bishop: 'Bishop', knight: 'Knight', pawn: 'Pawn' };

export type MemoryQuestion =
  | { kind: 'what'; square: string; answer: string; text: string }
  | { kind: 'where'; color: Color; role: Role; from: string; answer: string; text: string };

export interface MemoryRound {
  name: string;
  sans: string[];
  final: Chess;
  question: MemoryQuestion;
}

/** "White knight", "Black pawn" or "Empty". */
export const pieceLabel = (p?: { color: Color; role: Role }) => (p ? `${p.color === 'white' ? 'White' : 'Black'} ${ROLE_NAME[p.role].toLowerCase()}` : 'Empty');

/** Builds a round from a library line cut to `plies` moves; undefined if the line is too short or unreadable. */
export function makeRound(name: string, line: string, plies: number, random = Math.random): MemoryRound | undefined {
  const sans = line.split(' ').slice(0, plies);
  if (sans.length < plies) return undefined;
  const pos = positionFromFen(START_FEN);
  // Where each piece started, followed through the moves.
  const origin = new Map<number, number>();
  for (const [sq] of pos.board) origin.set(sq, sq);
  const moved = new Set<number>();
  const vacated = new Set<number>();
  for (const san of sans) {
    const m = parseSan(pos, san) as NormalMove | undefined;
    if (!m) return undefined;
    const start = origin.get(m.from)!;
    const castle = pos.board.get(m.from)?.role === 'king' && pos.board.get(m.to)?.color === pos.turn;
    pos.play(m);
    origin.delete(m.from);
    vacated.add(m.from);
    if (castle) {
      // Castling (king onto rook): find where king and rook ended up.
      for (const [sq, p] of pos.board) if (!origin.has(sq) && p.color !== pos.turn) origin.set(sq, p.role === 'king' ? start : m.to);
    } else {
      origin.set(m.to, start);
    }
    for (const sq of [...origin.keys()]) if (!pos.board.get(sq)) origin.delete(sq);
    for (const [sq] of pos.board) if (!origin.has(sq)) origin.set(sq, sq);
    moved.add(m.to);
  }
  const final = pos;
  const movedNow = [...moved].filter((s) => final.board.get(s) && origin.get(s) !== s);
  const emptied = [...vacated].filter((s) => !final.board.get(s));
  let question: MemoryQuestion;
  if (random() < 0.5 && movedNow.length) {
    // Where did a piece go? Pawns are too easy to tell apart, so pieces only, when there are some.
    const pieces = movedNow.filter((s) => final.board.get(s)!.role !== 'pawn');
    const pool = pieces.length ? pieces : movedNow;
    const sq = pool[Math.floor(random() * pool.length)];
    const p = final.board.get(sq)!;
    const from = makeSquare(origin.get(sq)!);
    question = {
      kind: 'where',
      color: p.color,
      role: p.role,
      from,
      answer: makeSquare(sq),
      text: `Where is the ${p.color} ${ROLE_NAME[p.role].toLowerCase()} that started on ${from}?`,
    };
  } else {
    const pool = random() < 0.75 || !emptied.length ? movedNow.length ? movedNow : emptied : emptied;
    const sq = pool[Math.floor(random() * pool.length)];
    question = { kind: 'what', square: makeSquare(sq), answer: pieceLabel(final.board.get(sq)), text: `What is on ${makeSquare(sq)} now?` };
  }
  return { name, sans, final, question };
}

/** Whether an answer (a square for "where", a piece label for "what") is right. */
export const isRight = (q: MemoryQuestion, a: string) => a === q.answer;

/** Every possible answer to "what is on…": Empty, then each piece of each colour. */
export const WHAT_OPTIONS = ['Empty', ...(['white', 'black'] as const).flatMap((c) => (['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'] as Role[]).map((r) => pieceLabel({ color: c, role: r })))];

export { parseSquare };

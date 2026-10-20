import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { asksForPiece } from './promotion';

const pos = Chess.fromSetup(parseFen('8/4P3/8/8/8/8/k7/6K1 w - - 0 1').unwrap()).unwrap();
const move = (u: string) => parseUci(u) as NormalMove;

describe('promotion', () => {
  it('asks for the piece only when "Always promote to Queen" is off', () => {
    expect(asksForPiece(pos, 'e7', 'e8', undefined, true)).toBe(false);
    expect(asksForPiece(pos, 'e7', 'e8', undefined, false)).toBe(true);
    // Not a promotion: never.
    expect(asksForPiece(pos, 'g1', 'g2', undefined, false)).toBe(false);
  });

  it('a puzzle whose answer is another piece asks even with the setting on', () => {
    expect(asksForPiece(pos, 'e7', 'e8', move('e7e8n'), true)).toBe(true);
    expect(asksForPiece(pos, 'e7', 'e8', move('e7e8q'), true)).toBe(false);
    // The answer is a different move: no hint.
    expect(asksForPiece(pos, 'e7', 'e8', move('g1h1'), true)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { playSans, positionFromFen, uciToMove } from '$lib/chess/position';
import { boardTokens, maiaUci, mirrorFen } from './maia';

describe('Maia input', () => {
  it('mirrors the board so the side to move is White, as Maia expects', () => {
    expect(mirrorFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe('rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 1');
    expect(mirrorFen('r3k3/8/8/8/8/8/8/4K2R b Kq - 0 1')).toBe('4k2r/8/8/8/8/8/8/R3K3 w Qk - 0 1');
  });

  it('puts each piece on its square and channel (square = rank * 8 + file)', () => {
    const t = boardTokens('8/8/8/8/8/8/8/4K2r w - - 0 1');
    expect(t[4 * 12 + 5]).toBe(1); // white king (channel 5) on e1 (square 4)
    expect(t[7 * 12 + 9]).toBe(1); // black rook (channel 9) on h1 (square 7)
    expect(t.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('names castling as the king\'s two-square move, and promotions with a letter', () => {
    const pos = playSans('e4 e5 Nf3 Nc6 Bc4 Bc5');
    expect(maiaUci(pos, uciToMove('e1h1')!)).toBe('e1g1');
    const promo = positionFromFen('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(maiaUci(promo, { ...uciToMove('e7e8')!, promotion: 'knight' })).toBe('e7e8n');
  });
});

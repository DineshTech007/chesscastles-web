import { describe, expect, it } from 'vitest';
import { bestLines, movesText, problemLines, type CheckupGame } from './checkup';

let n = 0;
const g = (moves: string, score: number, color: 'white' | 'black' = 'black', name?: string): CheckupGame => ({
  source: 'chesscom',
  ref: `g${++n}`,
  at: n,
  color,
  score,
  san: moves.split(' '),
  name,
  opponent: 'x',
});

describe('opening check-up', () => {
  it('finds the line where the results drop, and what came next', () => {
    const games = [
      // As Black in the Sicilian: fine against 2.Nf3, losing against 2.c3.
      g('e4 c5 Nf3 d6 d4', 1),
      g('e4 c5 Nf3 d6 d4', 1),
      g('e4 c5 Nf3 Nc6 d4', 0.5),
      g('e4 c5 c3 d5 exd5', 0, 'black', 'Sicilian Defense Alapin Variation'),
      g('e4 c5 c3 d5 exd5', 0, 'black', 'Sicilian Defense Alapin Variation'),
      g('e4 c5 c3 Nf6 e5', 0),
      g('e4 c5 c3 Nf6 e5', 1),
    ];
    const [line, ...rest] = problemLines(games);
    expect(rest).toHaveLength(0);
    expect(line.sans).toEqual(['e4', 'c5', 'c3']);
    expect(line.yourMove).toBe(false);
    expect(line.name).toBe('Sicilian Defense Alapin Variation');
    expect([line.games, line.losses, line.score]).toEqual([4, 3, 0.25]);
    expect(line.next[0]).toEqual({ san: 'd5', games: 2, score: 0 });
    expect(movesText(line.sans)).toBe('1.e4 c5 2.c3');
  });

  it('reports a line from the third move when the results were low from the start', () => {
    const games = [g('d4 d5 c4 e6', 0, 'white'), g('d4 d5 c4 c6', 0, 'white'), g('d4 d5 c4 dxc4', 0.5, 'white')];
    const [line] = problemLines(games);
    expect(line.sans).toEqual(['d4', 'd5', 'c4']);
    expect(line.yourMove).toBe(true);
    expect(line.color).toBe('white');
  });

  it('needs three games and two losses', () => {
    expect(problemLines([g('e4 e5 Nf3', 0), g('e4 e5 Nf3', 0)])).toHaveLength(0);
    expect(problemLines([g('e4 e5 Nf3', 0), g('e4 e5 Nf3', 1), g('e4 e5 Nf3', 1)])).toHaveLength(0);
  });

  it('names the lines that go best', () => {
    const games = [g('e4 e5 Nf3 Nc6', 1, 'white'), g('e4 e5 Nf3 Nc6', 1, 'white'), g('e4 e5 Nf3 d6', 1, 'white')];
    const [best] = bestLines(games);
    expect(best.sans).toEqual(['e4', 'e5', 'Nf3']);
    expect(best.score).toBe(1);
  });
});

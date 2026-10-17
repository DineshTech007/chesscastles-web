import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clocksAt, readPgn } from './pgn';

describe('readPgn', () => {
  it('reads a Lichess broadcast game with clocks', () => {
    const [g] = readPgn(readFileSync('src/lib/chess/fixtures/broadcast-game.pgn', 'utf-8'));
    expect(g.headers.get('White')).toBe('Engel, Luis');
    expect(g.headers.get('Result')).toBe('1/2-1/2');
    expect(g.plies.length).toBeGreaterThan(40);
    expect(g.plies[0].clock).toBeGreaterThan(0);
    const c = clocksAt(g, g.plies.length);
    expect(c.white).toBeGreaterThan(0);
    expect(c.black).toBeGreaterThan(0);
  });

  it('reads plain move lists and custom positions', () => {
    const [g] = readPgn('1. e4 e5 2. Nf3 Nc6 *');
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    const [h] = readPgn('[FEN "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]\n\n1. O-O *');
    expect(h.plies[0].san).toBe('O-O');
    // Kings side by side: an impossible position is skipped.
    expect(readPgn('[FEN "8/8/8/8/8/8/4k3/4K2R w K - 0 1"]\n\n1. O-O *')).toEqual([]);
  });
});

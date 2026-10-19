import { describe, expect, it } from 'vitest';
import type { SavedGame } from '$lib/stores/myGames';
import { computeKfide, computeKfideAll, expected, speedOf } from './kfide';

const g = (i: number, result: string, opp: number, kind: SavedGame['kind'] = 'fide'): SavedGame => ({
  id: `g${i}`,
  playedAt: i,
  kind,
  white: 'You',
  black: `FIDE ${opp}`,
  userSide: 'white',
  result,
  reason: '',
  timeControl: '15+10',
  opponentRating: opp,
  startFen: '',
  uci: ['e2e4'],
});

describe('CC Rating', () => {
  it('rates like FIDE: K 40 for new players, expected score from the difference', () => {
    expect(expected(1600, 1800)).toBeCloseTo(0.24, 2);
    // A 1600 player wins against 1800, then draws: +30, then +9 (expected 0.27).
    const k = computeKfide([g(2, '1/2-1/2', 1800), g(1, '1-0', 1800)], 1600);
    expect(k.history.map((h) => h.after)).toEqual([1630, 1639]);
    expect(k.rating).toBe(1639);
    expect(k.provisional).toBe(true);
  });

  it('starts every speed at 1500, and one game moves it by 40 at most', () => {
    const all = computeKfideAll([{ ...g(1, '0-1', 1000), timeControl: '5+0' }]);
    // A loss to a much lower rated player (difference capped at 400): 1500 − 40 × 0.91.
    expect(all.blitz.rating).toBe(1464);
    expect(all.rapid.rating).toBe(1500);
    expect(all.standard.rating).toBe(1500);
    // Games against the computer or on Lichess never count.
    const mixed = computeKfideAll([{ ...g(2, '0-1', 2500, 'computer'), timeControl: '5+0' }, { ...g(3, '0-1', 2500, 'lichess'), timeControl: '5+0' }]);
    expect(mixed.blitz).toMatchObject({ rating: 1500, games: 0 });
  });

  it('counts only finished games against the FIDE bots', () => {
    const k = computeKfide([g(1, '*', 1800), g(2, '1-0', 1500, 'computer'), g(3, '0-1', 1500)]);
    expect(k.games).toBe(1);
    expect(k.rating).toBe(1480);
  });
});

describe('CC Rating at each speed', () => {
  it('sorts time controls by speed like FIDE (minutes + increment)', () => {
    expect(['1+0', '1+1', '2+1', '3+0'].map(speedOf)).toEqual(['bullet', 'bullet', 'bullet', 'blitz']);
    expect(['5+0', '3+2', '10+0', '15+10', '30+0', '45+15', '60+0', '90+30', ''].map(speedOf)).toEqual([
      'blitz', 'blitz', 'blitz', 'rapid', 'rapid', 'standard', 'standard', 'standard', 'rapid',
    ]);
  });
  it('rates each speed on its own, and the main one is the speed played most', () => {
    const tc = (x: SavedGame, t: string) => ({ ...x, timeControl: t });
    const a = computeKfideAll([tc(g(1, '1-0', 1800), '5+0'), tc(g(2, '1-0', 1800), '5+0'), tc(g(3, '0-1', 1500), '90+30')], 1600);
    expect(a.blitz.games).toBe(2);
    expect(a.standard.games).toBe(1);
    expect(a.rapid.games).toBe(0);
    expect(a.rapid.rating).toBe(1600);
    expect(a.standard.rating).toBeLessThan(1600);
    expect(a.main).toBe('blitz');
  });
});

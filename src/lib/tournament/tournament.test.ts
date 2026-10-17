import { describe, expect, it } from 'vitest';
import { completeRound, createTournament, finished, ME, myGame, pickOpponents, rng, robinRounds, simulate, standings, type FideRow, type TPlayer } from './tournament';

const opp = (i: number, rating: number): TPlayer => ({ id: `p${i}`, name: `Player ${i}`, rating, fed: 'IND' });
const me: TPlayer = { id: 'x', name: 'You', rating: 1600, fed: 'IND' };

describe('FIDE tournaments', () => {
  it('picks active opponents near the rating, without repeats', () => {
    const rows: FideRow[] = Array.from({ length: 200 }, (_, i) => [i + 1, `Name${i}, P`, i % 20 ? '' : 'FM', 'M', 1000 + i * 10, 0, 0, 2000, i % 7 === 0 ? 1 : 0]);
    const got = pickOpponents(rows, 1600, 8, 'rapid', 'IND', rng(3));
    expect(got).toHaveLength(8);
    expect(new Set(got.map((p) => p.fideId)).size).toBe(8);
    expect(got.every((p) => Math.abs(p.rating - 1600) <= 150)).toBe(true);
    expect(got[0].name).toBe(`P Name${got[0].fideId! - 1}`);
  });

  it('round robin: everyone meets everyone once', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const rounds = robinRounds(ids);
    expect(rounds).toHaveLength(5);
    const met = new Set(rounds.flat().filter(([a, b]) => a && b).map(([a, b]) => [a, b].sort().join('-')));
    expect(met.size).toBe(10);
  });

  it('simulated results follow the odds', () => {
    const r = rng(9);
    let strong = 0;
    for (let i = 0; i < 2000; i++) strong += simulate(2200, 1800, r) === '1-0' ? 1 : 0;
    expect(strong / 2000).toBeGreaterThan(0.7);
  });

  it('a Swiss tournament runs to the end with no repeated pairings, and ranks everyone', () => {
    let t = createTournament({ name: 'Test Open', tc: 2, format: 'swiss', rounds: 5, me, opponents: [1, 2, 3, 4, 5, 6, 7].map((i) => opp(i, 1500 + i * 30)), seed: 1 });
    expect(t.players).toHaveLength(8);
    for (let r = 1; r <= 5; r++) {
      const g = myGame(t)!;
      expect(g).toBeTruthy();
      t = completeRound(t, { result: g.white === ME ? '1-0' : '0-1', gameId: `g${r}` });
    }
    expect(finished(t)).toBe(true);
    const pairs = t.games.filter((g) => g.black).map((g) => [g.white, g.black].sort().join('-'));
    expect(new Set(pairs).size).toBe(pairs.length);
    const s = standings(t);
    expect(s[0].player.me).toBe(true);
    expect(s[0].score).toBe(5);
    expect(s.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('an odd field gives byes', () => {
    const t = createTournament({ name: 'Odd', tc: 2, format: 'swiss', rounds: 4, me, opponents: [1, 2, 3, 4, 5, 6].map((i) => opp(i, 1600)) });
    const byes = t.games.filter((g) => !g.black);
    expect(byes).toHaveLength(1);
    expect(byes[0].result).toBe('1-0');
  });
});

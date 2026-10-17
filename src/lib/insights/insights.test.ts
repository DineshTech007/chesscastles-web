import { describe, expect, it } from 'vitest';
import { parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { positionFromFen } from '$lib/chess/position';
import { describeGame, detectTactic } from './analysis';
import { buildReport } from './report';
import { buildWeeklyPlan, progressOf } from './plan';
import type { ImportedGame } from './games';

const game = (over: Partial<ImportedGame> = {}): ImportedGame => ({
  url: `https://example.com/${Math.random()}`, site: 'chesscom', username: 'me', endTime: 0, timeClass: 'blitz', baseSeconds: 300, increment: 0,
  white: 'me', black: 'them', result: '0-1', userColor: 'white', opening: 'Italian Game',
  uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3', 'g8f6'], san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6'],
  clocks: [null, null, null, null, null, null, null, null], ...over,
});

describe('Guru insights', () => {
  it('recognises a knight fork', () => {
    // White knight jumps to c7, attacking the king on e8 and the rook on a8.
    const pos = positionFromFen('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
    expect(detectTactic(pos, parseUci('b5c7') as NormalMove)).toBe('fork');
  });

  it('turns engine scores into move facts, and a blunder into a weakness and a plan', () => {
    // White's 4th move (d3) throws away 4 pawns; Black's best reply is a fork-like knight move.
    const scores = [30, 30, 30, 30, 30, 30, 30, -400, -400];
    const best = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1', 'f6g4', undefined];
    const g = game();
    const moves = describeGame(g, scores, best);
    expect(moves).toHaveLength(8);
    expect(moves[6]).toMatchObject({ san: 'd3', user: true, cls: 'blunder' });
    const games = Array.from({ length: 4 }, () => ({ game: { ...g, url: String(Math.random()) }, moves }));
    const r = buildReport(games);
    expect(r.games).toBe(4);
    expect(r.blundersPerGame).toBe(1);
    expect(r.openings[0]).toMatchObject({ name: 'Italian Game', games: 4, losses: 4 });
    expect(r.weaknesses.some((w) => w.kind === 'opening')).toBe(true);
    const plan = buildWeeklyPlan(r, 'test');
    expect(plan.days).toHaveLength(7);
    expect(plan.days.flatMap((d) => d.tasks).length).toBeGreaterThan(7);
    // A puzzles task counts the right activities.
    const t = plan.days.flatMap((d) => d.tasks).find((x) => x.kind === 'puzzles');
    if (t) {
      const now = Date.now() + 1000;
      const acts = Array.from({ length: t.target }, () => ({ at: now, kind: 'puzzle' as const, points: 20, label: `${t.counts}` }));
      expect(progressOf(t, plan.days[0].day, plan, acts)).toBe(1);
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import { ladderLevel, moveLadder, stageOf } from './bank';
import { newRating, performance, placementRating, PLACEMENT } from './elo';

describe('the puzzle learning ladder', () => {
  it('placement: a new player starts on easy puzzles and climbs fast with first-try solves', () => {
    expect(ladderLevel(1500, 0)).toBe(700);
    let l = 700;
    for (let i = 0; i < 5; i++) l = moveLadder(l, 'clean', i);
    expect(l).toBe(1300);
    expect(stageOf(l).name).toBe('Intermediate');
  });
  it('placement: comes down after misses and skips, never below the easiest band', () => {
    expect(moveLadder(1000, 'missed', 5)).toBe(868);
    expect(moveLadder(1000, 'skipped', 5)).toBe(975);
    let l = 500;
    for (let i = 0; i < 10; i++) l = moveLadder(l, 'missed', i);
    expect(l).toBe(400);
  });
  it('after placement: puzzles a little under the rating, so a solve earns points (not 0) and a miss costs less than 40', () => {
    // An old ladder far below the rating (the bug: 1500 rating, 600 puzzles) is pulled up near the rating.
    const store = new Map<string, string>([['cc.puzzleLadder', '600']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    const level = ladderLevel(1500, 40);
    expect(level).toBe(1200);
    const win = newRating(1500, level, 1, 40) - 1500;
    const lose = newRating(1500, level, 0, 40) - 1500;
    expect(win).toBeGreaterThanOrEqual(3);
    expect(lose).toBeGreaterThan(-20);
    // At the anchor (rating − 150): about three in four, +6 / −14 with K 20.
    expect(newRating(1500, 1350, 1, 40) - 1500).toBe(6);
    expect(newRating(1500, 1350, 0, 40) - 1500).toBe(-14);
    vi.unstubAllGlobals();
  });
  it('after placement: results nudge the difficulty, never more than 150 from the anchor', () => {
    expect(moveLadder(1350, 'clean', 40, 1500)).toBe(1390);
    expect(moveLadder(1490, 'clean', 40, 1500)).toBe(1500);
    expect(moveLadder(1100, 'missed', 40, 1500)).toBe(1200);
  });
});

describe('placement: a new player’s provisional rating', () => {
  it('is the performance over the placement puzzles', () => {
    // Half solved, at about 800: about 800 (the virtual half point at 1000 pulls a little).
    const half: [number, number][] = [[700, 1], [820, 0], [700, 1], [820, 0], [760, 1], [880, 0]];
    expect(Math.abs(performance(half) - 800)).toBeLessThan(60);
    // Everything solved: well above the puzzles, never endless.
    const all: [number, number][] = Array.from({ length: 10 }, (_, i) => [700 + i * 120, 1]);
    expect(performance(all)).toBeGreaterThan(1800);
    expect(performance(all)).toBeLessThanOrEqual(2800);
  });
  it('moves toward it by at most 120 a puzzle (the database rule during placement), even after a solve', () => {
    expect(placementRating(1500, [[700, 1]])).toBe(1380);
    expect(placementRating(1500, [[1500, 1], [1700, 1], [1900, 1]])).toBe(1620);
    expect(placementRating(420, [[400, 0], [400, 0]])).toBe(400);
  });
  it('a child at about 800 ends placement at about 800 (plain Elo left them above 1150)', () => {
    const solves = (puzzle: number) => puzzle <= 800;
    let placed = 1500;
    let elo = 1500;
    let level = 700;
    const log: [number, number][] = [];
    for (let i = 0; i < PLACEMENT; i++) {
      const ok = solves(level);
      log.push([level, ok ? 1 : 0]);
      placed = placementRating(placed, log);
      elo = newRating(elo, level, ok ? 1 : 0, i);
      level = moveLadder(level, ok ? 'clean' : 'missed', i);
    }
    expect(Math.abs(placed - 800)).toBeLessThan(60);
    expect(elo).toBeGreaterThan(1150);
  });
});

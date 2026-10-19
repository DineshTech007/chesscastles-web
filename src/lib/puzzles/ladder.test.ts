import { describe, expect, it } from 'vitest';
import { ladderLevel, moveLadder, stageOf } from './bank';

describe('the puzzle learning ladder', () => {
  it('starts a new player on easy puzzles and climbs with first-try solves', () => {
    expect(ladderLevel(1500, 0)).toBe(600);
    let l = 600;
    for (let i = 0; i < 10; i++) l = moveLadder(l, 'clean', i);
    expect(l).toBe(1300);
    expect(stageOf(l).name).toBe('Intermediate');
  });
  it('comes down after misses and skips, never below the easiest band', () => {
    expect(moveLadder(1000, 'missed', 5)).toBe(916);
    expect(moveLadder(1000, 'skipped', 5)).toBe(975);
    let l = 500;
    for (let i = 0; i < 10; i++) l = moveLadder(l, 'missed', i);
    expect(l).toBe(400);
  });
});

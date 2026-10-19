import { describe, expect, it } from 'vitest';
import { maxDrop, pickWeighted, slipChance } from './engineMove';

describe('how the FIDE-level opponent picks a move', () => {
  const cands = [
    { item: 'best', base: 0.4, wc: 0.55 },
    { item: 'fine', base: 0.3, wc: 0.5 },
    { item: 'hangs the queen', base: 0.3, wc: 0.05 },
  ];
  // A seeded random, so the counts are the same every run.
  const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  it('never drops a piece over the limit, unless this move may slip', () => {
    const rnd = seeded(7);
    const picks = Array.from({ length: 2000 }, () => pickWeighted(cands, 1, maxDrop(1400), false, rnd));
    expect(picks.filter((p) => p === 'hangs the queen').length).toBe(0);
    expect(picks.filter((p) => p === 'fine').length).toBeGreaterThan(500);
    const slips = Array.from({ length: 2000 }, () => pickWeighted(cands, 1, maxDrop(1400), true, rnd));
    expect(slips.filter((p) => p === 'hangs the queen').length).toBeGreaterThan(300);
  });

  it('a low tau keeps to the best move', () => {
    const rnd = seeded(3);
    const picks = Array.from({ length: 1000 }, () => pickWeighted(cands, 0.01, 1, false, rnd));
    expect(picks.filter((p) => p === 'best').length).toBeGreaterThan(950);
  });

  it('has limits at every rating, and slips only below 1800', () => {
    expect(maxDrop(1200)).toBe(0.45);
    expect(maxDrop(1400)).toBe(0.35);
    expect(maxDrop(1800)).toBe(0.2);
    expect(maxDrop(3000)).toBe(0.04);
    expect(slipChance(1400)).toBeCloseTo(0.01);
    expect(slipChance(1200)).toBeCloseTo(0.02);
    expect(slipChance(1800)).toBe(0);
    expect(slipChance(2400)).toBe(0);
  });
});

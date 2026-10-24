import { describe, expect, it } from 'vitest';
import { instinctChance, instinctShare, maxDrop, pickWeighted, rankBase, slipChance } from './engineMove';

describe('how the FIDE-level opponent picks a move', () => {
  const cands = [
    { item: 'best', base: 0.4, wc: 0.55 },
    { item: 'fine', base: 0.3, wc: 0.5 },
    { item: 'hangs the queen', base: 0.3, wc: 0.05 },
  ];
  // A seeded random, so the counts are the same every run.
  const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  it('without Maia, the engine’s first moves get most of the weight: no wandering among a dozen equal moves', () => {
    const share = (r: number, top: number) => {
      const w = Array.from({ length: 30 }, (_, i) => rankBase(i, r));
      return w.slice(0, top).reduce((a, b) => a + b, 0) / w.reduce((a, b) => a + b, 0);
    };
    expect(share(1500, 1)).toBeGreaterThan(0.3);
    expect(share(1500, 3)).toBeGreaterThan(0.65);
    expect(share(1500, 12)).toBeGreaterThan(0.97);
    expect(share(1200, 1)).toBeLessThan(share(2200, 1));
    const n = { best: 0, fine: 0, wander: 0 };
    const even = [
      { item: 'best', base: rankBase(0, 1500), wc: 0.52 },
      { item: 'fine', base: rankBase(1, 1500), wc: 0.51 },
      ...Array.from({ length: 10 }, (_, i) => ({ item: 'wander', base: rankBase(i + 2, 1500), wc: 0.5 })),
    ];
    const random = seeded(3);
    for (let i = 0; i < 1000; i++) n[pickWeighted(even, 0.06, 0.3, false, random) as keyof typeof n]++;
    expect(n.best + n.fine).toBeGreaterThan(n.wander);
  });

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

  it('in bullet plays most moves on instinct below 1400, fewer as players get stronger, none from 2100', () => {
    // Starter levels (below 1400): beginners, most of all.
    expect(instinctChance(900)).toBe(0.85);
    expect(instinctChance(1150)).toBeCloseTo(0.775);
    expect(instinctChance(1400)).toBeCloseTo(0.6);
    expect(instinctChance(1750)).toBeCloseTo(0.25);
    expect(instinctChance(2200)).toBe(0);
    for (let r = 900; r < 2300; r += 50) expect(instinctChance(r + 50)).toBeLessThanOrEqual(instinctChance(r));
  });

  it('plays on instinct in bullet, a little less in blitz, never in rapid or classical (calibrated on slow games)', () => {
    expect(instinctShare({ minutes: 1, increment: 0, kind: 'Bullet' })).toBe(1);
    expect(instinctShare({ minutes: 5, increment: 0, kind: 'Blitz' })).toBe(0.7);
    expect(instinctShare({ minutes: 10, increment: 0, kind: 'Blitz' })).toBe(0.7);
    expect(instinctShare({ minutes: 15, increment: 10, kind: 'Rapid' })).toBe(0);
    expect(instinctShare({ minutes: 90, increment: 30, kind: 'Classical' })).toBe(0);
    expect(instinctShare(undefined)).toBe(0);
  });

  it('Starter levels (below 1400) give away more and slip more often, like beginners', () => {
    expect(maxDrop(1000)).toBe(0.55);
    expect(maxDrop(1100)).toBeCloseTo(0.5);
    expect(slipChance(1000)).toBe(0.035);
    expect(slipChance(1100)).toBeCloseTo(0.0275);
    expect(slipChance(1200)).toBeCloseTo(0.02);
  });
});

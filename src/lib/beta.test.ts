import { describe, expect, it } from 'vitest';
import { betaOn } from './beta';

describe('beta', () => {
  it('lasts to the end of 30 November 2026, India time', () => {
    expect(betaOn(new Date('2026-10-20T06:00:00Z'))).toBe(true);
    // 23:59 on 30 November in India.
    expect(betaOn(new Date('2026-11-30T18:29:00Z'))).toBe(true);
    // 00:01 on 1 December in India.
    expect(betaOn(new Date('2026-11-30T18:31:00Z'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { newRating } from './elo';

describe('puzzle rating', () => {
  it('moves like the app: K 40 at first, 20 later, never past 40 or under 400', () => {
    expect(newRating(1500, 1500, 1, 0)).toBe(1520);
    expect(newRating(1500, 1500, 0, 0)).toBe(1480);
    expect(newRating(1500, 1500, 1, 50)).toBe(1510);
    expect(newRating(1500, 2300, 1, 0)).toBe(1540);
    expect(newRating(410, 410, 0, 0)).toBe(400);
    expect(newRating(410, 1500, 0, 0)).toBe(410);
  });
});

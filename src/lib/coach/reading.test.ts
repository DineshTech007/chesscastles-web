import { describe, expect, it } from 'vitest';
import { slideSeconds } from './reading';

describe('how long a lesson slide needs', () => {
  it('is at least 3 seconds, however short', () => {
    expect(slideSeconds('Hello.')).toBe(3);
  });
  it('grows with the words (about three a second) and stops at 20 seconds', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
    expect(slideSeconds(words(30))).toBe(10);
    expect(slideSeconds(words(300))).toBe(20);
  });
  it('waits for the moves that play on the board', () => {
    expect(slideSeconds('Watch.', 6)).toBeCloseTo(6.1, 1);
    expect(slideSeconds('Watch.', 40)).toBe(15);
  });
});

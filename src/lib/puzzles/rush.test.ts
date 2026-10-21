import { describe, expect, it } from 'vitest';
import { nextRushTitle, rushTitle } from './rewards';

describe('Puzzle Rush titles', () => {
  it('from the best score: Speedster 10, Rush master 20, Rush legend 30, Rush titan 40, Rush immortal 50', () => {
    expect(rushTitle(9)).toBeUndefined();
    expect(rushTitle(10)).toBe('Speedster');
    expect(rushTitle(29)).toBe('Rush master');
    expect(rushTitle(33)).toBe('Rush legend');
    expect(rushTitle(40)).toBe('Rush titan');
    expect(rushTitle(57)).toBe('Rush immortal');
  });
  it('always something to chase until the top', () => {
    expect(nextRushTitle(33)).toMatchObject({ name: 'Rush titan', more: 7 });
    expect(nextRushTitle(45)).toMatchObject({ name: 'Rush immortal', more: 5 });
    expect(nextRushTitle(50)).toBeUndefined();
  });
});

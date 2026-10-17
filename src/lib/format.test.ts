import { describe, expect, it } from 'vitest';
import { formatClock } from './format';

describe('formatClock', () => {
  it('shows tenths under a minute, minutes and hours above', () => {
    expect(formatClock(48_700)).toBe('0:48.7');
    expect(formatClock(9_050)).toBe('0:09.0');
    expect(formatClock(5 * 60_000)).toBe('5:00');
    expect(formatClock(14 * 60_000 + 32_000)).toBe('14:32');
    expect(formatClock(90 * 60_000)).toBe('1:30:00');
    expect(formatClock(-5)).toBe('0:00.0');
  });
});

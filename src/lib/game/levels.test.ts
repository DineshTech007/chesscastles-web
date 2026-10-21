import { describe, expect, it } from 'vitest';
import { clampLevel, levelName, matchLevel } from './levels';

describe('opponent levels', () => {
  it('names Starter levels below FIDE’s lowest rating and FIDE-level from 1400', () => {
    expect(levelName(1000)).toBe('Starter 1000');
    expect(levelName(1375)).toBe('Starter 1375');
    expect(levelName(1400)).toBe('FIDE 1400');
    expect(levelName(2500)).toBe('FIDE 2500');
  });
  it('keeps levels on the 25 grid between 1000 and 2800', () => {
    expect(clampLevel(990)).toBe(1000);
    expect(clampLevel(1412)).toBe(1400);
    expect(clampLevel(1413)).toBe(1425);
    expect(clampLevel(3000)).toBe(2800);
  });
  it('matches a level about 100 under the player’s CC Rating, so they win more than they lose', () => {
    expect(matchLevel(1500)).toBe(1400);
    expect(matchLevel(1180)).toBe(1075);
    expect(matchLevel(900)).toBe(1000);
    expect(matchLevel(2950)).toBe(2800);
  });
});

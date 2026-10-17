import { describe, expect, it } from 'vitest';
import { evalLabel, parseInfo, whiteChances } from './stockfish';

describe('engine output', () => {
  it('reads scores from White\'s point of view', () => {
    const w = parseInfo('info depth 14 seldepth 18 multipv 1 score cp 34 nodes 1 pv e2e4 e7e5', 'x w - - 0 1');
    expect(w).toMatchObject({ depth: 14, cp: 34, pv: ['e2e4', 'e7e5'] });
    const b = parseInfo('info depth 9 score cp 50 pv e7e5', 'x b - - 0 1');
    expect(b?.cp).toBe(-50);
    const mate = parseInfo('info depth 20 score mate 3 pv d8h4', 'x b - - 0 1');
    expect(mate?.mate).toBe(-3);
    expect(parseInfo('info depth 3 currmove e2e4', 'x w')).toBeUndefined();
    expect(parseInfo('info depth 9 multipv 2 score cp 5 pv d2d4', 'x w')).toBeUndefined();
  });

  it('turns scores into winning chances and labels', () => {
    expect(whiteChances({ cp: 0 })).toBeCloseTo(0.5);
    expect(whiteChances({ cp: 300 })).toBeGreaterThan(0.7);
    expect(whiteChances({ mate: -2 })).toBe(0);
    expect(evalLabel({ cp: 34 })).toBe('+0.3');
    expect(evalLabel({ cp: -4 })).toBe('0.0');
    expect(evalLabel({ cp: -46 })).toBe('-0.5');
    expect(evalLabel({ mate: -3 })).toBe('#-3');
  });
});

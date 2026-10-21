import { describe, expect, it } from 'vitest';
import { endWords, endWordsCap, isDrawWords } from './endWords';
import { FideGame } from './fideGame';

describe('endWords', () => {
  it("a player's own words read right to anyone else", () => {
    expect(endWords('You resigned')).toBe('by resignation');
    expect(endWords('Your opponent ran out of time')).toBe('on time');
    expect(endWords('You ran out of time')).toBe('on time');
    expect(endWords('Black resigned')).toBe('by resignation');
    expect(endWords('Checkmate')).toBe('by checkmate');
  });

  it('draws say so', () => {
    for (const r of ['Same position three times', 'Stalemate', '50 moves without a capture or pawn move', 'Neither side can checkmate']) expect(isDrawWords(endWords(r))).toBe(true);
    expect(endWords('Same position three times')).toBe('Draw by repetition');
  });

  it('anything else is kept, and nothing gives nothing', () => {
    expect(endWords('Game aborted')).toBe('Game aborted');
    expect(endWords(undefined)).toBe('');
    expect(endWordsCap('You resigned')).toBe('By resignation');
  });

  it("covers every ending FideGame can name (none comes out in the player's own words)", () => {
    const own = /\b(you|your)\b/i;
    for (const end of ['checkmate', 'stalemate', 'insufficient', 'threefold', 'fiftyMoves', 'timeout', 'resignation'] as const) {
      for (const winner of ['white', 'black', undefined] as const) {
        const g = Object.create(FideGame.prototype) as FideGame;
        Object.assign(g, { end, winner, human: 'white' });
        expect(endWords(g.endReason), `${end} / ${winner}`).not.toMatch(own);
      }
    }
  });
});

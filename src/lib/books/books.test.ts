import { describe, expect, it } from 'vitest';
import { chunks, speakable } from './books';

describe('reading chess books aloud', () => {
  it('reads old descriptive notation in words', () => {
    expect(speakable('1 R - R 7, K - Kt 1; 2 K - Kt 2.')).toBe('1 Rook to Rook 7, King to Knight 1. 2 King to Knight 2.');
    expect(speakable('P x P')).toBe('Pawn takes Pawn');
    expect(speakable('R - Q B 7')).toBe("Rook to Queen's Bishop 7");
    expect(speakable('Kt - K B 3 ch')).toBe("Knight to King's Bishop 3 check");
    expect(speakable('6...K - B 1')).toBe('6, Black: King to Bishop 1');
    expect(speakable('O-O')).toBe('castles king side');
    expect(speakable('10. K — B 2 P — Kt 6 ch')).toBe('10. King to Bishop 2 Pawn to Knight 6 check');
    expect(speakable('Kt × P')).toBe('Knight takes Pawn');
  });
  it('reads modern moves in words', () => {
    expect(speakable('1. e4 e5 2. Nf3 Nc6 3. Qxh7#')).toBe('1. e4 e5 2. Knight f3 Knight c6 3. Queen takes h7, checkmate');
  });
  it('splits long text for the voice', () => {
    const c = chunks('One sentence here. Another one! '.repeat(20), 100);
    expect(c.every((x) => x.length <= 120)).toBe(true);
    expect(c.join(' ')).toContain('Another one!');
  });
});

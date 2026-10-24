import { describe, expect, it } from 'vitest';
import { isBullet, roomGame } from './playWhere';

describe('where a game between two Chess Castles players is played', () => {
  it('bullet is always in our own room', () => {
    expect(isBullet(1, 0)).toBe(true);
    expect(isBullet(2, 1)).toBe(true);
    expect(isBullet(3, 0)).toBe(false);
    expect(roomGame(true, 'lichess:kid', 1, 0)).toBe(true);
  });
  it('blitz and slower go to Lichess only when both have a Lichess account; otherwise our room, at any clock', () => {
    expect(roomGame(true, 'lichess:kid', 5, 0)).toBe(false);
    expect(roomGame(true, 'lichess:kid', 15, 10)).toBe(false);
    expect(roomGame(false, 'lichess:kid', 5, 0)).toBe(true);
    expect(roomGame(true, 'BQmBOJ7dBcb0mLVQtTn5rjNy1Wl2', 10, 0)).toBe(true);
    expect(roomGame(false, 'BQmBOJ7dBcb0mLVQtTn5rjNy1Wl2', 15, 10)).toBe(true);
  });
});

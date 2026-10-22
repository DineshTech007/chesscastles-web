import { describe, expect, it } from 'vitest';
import { placeOf } from './rushPlace';
import type { KfideLeader } from '$lib/social';

const row = (uid: string, rating: number, me = false): KfideLeader => ({ uid, name: uid, username: uid, country: '', rating, games: 1, me });
const me = { uid: 'me', name: 'Me' };

describe('my place on the Puzzle Rush board', () => {
  it('puts a new best in its place before the board has it', () => {
    const r = placeOf([row('a', 40), row('b', 30), row('me', 20, true), row('c', 10)], 33, me);
    expect(r.rank).toBe(2);
    expect(r.list.map((x) => x.uid)).toEqual(['a', 'me', 'b', 'c']);
    expect(r.list[1].rating).toBe(33);
  });
  it('a player not on the board yet goes after those with as many', () => {
    const r = placeOf([row('a', 25), row('b', 25), row('c', 5)], 25, me);
    expect(r.rank).toBe(3);
  });
  it('keeps the board\'s order when the score is already there', () => {
    const r = placeOf([row('a', 25), row('me', 25, true), row('b', 25)], 12, me);
    expect(r.rank).toBe(2);
    expect(r.list[1].rating).toBe(25);
  });
});

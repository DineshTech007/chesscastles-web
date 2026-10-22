import { describe, expect, it } from 'vitest';
import { AWARDS, GROUPS, earnedFrom, type AwardInput } from './awards';

const none: AwardInput = { badges: [], puzzleRating: 800, study: [], now: Date.now(), openingsLearned: 0, masters: {}, trophies: [], lessonsDone: 0, chapters: 0, played: 0, wins: 0, gap: 0, cc: 1200, ccGames: 0 };

describe('awards', () => {
  it('have ids the server keeps (lower case letters and digits), each once, in a known group', () => {
    const ids = AWARDS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of AWARDS) {
      expect(a.id).toMatch(/^[a-z0-9]{2,16}$/);
      expect(GROUPS.some((g) => g.id === a.group)).toBe(true);
    }
    expect(AWARDS.length).toBeLessThanOrEqual(120);
  });
  it('a new player has only the welcome', () => {
    expect([...earnedFrom(none)]).toEqual(['welcome']);
  });
  it('counts puzzle badges, levels, lessons, books, masters stars and tournaments', () => {
    const won = earnedFrom({
      ...none,
      badges: ['first', 'rush30', 'not-an-award'],
      puzzleRating: 1450,
      masters: { 'a/1': 3, 'b/2': 2 },
      trophies: [{ id: 't', name: 'Cup', place: 2, players: 8, score: 4, rounds: 5, at: 0 }],
      lessonsDone: 12,
      chapters: 1,
      played: 4,
      wins: 1,
      gap: 250,
      cc: 1650,
      ccGames: 6,
    });
    expect([...won].sort()).toEqual(['cc1400', 'cc1600', 'chapter1', 'first', 'firstgame', 'firstwin', 'giant', 'lesson1', 'lessons10', 'lvlbishop', 'lvlknight', 'masters1', 'masters3', 'podium', 'rush30', 'tourney1', 'welcome'].sort());
  });
});

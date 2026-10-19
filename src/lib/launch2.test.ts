import { describe, expect, it } from 'vitest';
import { findGuide, GUIDE } from '$lib/guide/guide';
import { POSTS } from '$lib/blog/posts';
import { computeKfideAll } from '$lib/kfide';
import { gameRating, ratingText } from '$lib/stores/gameRatings';
import type { SavedGame } from '$lib/stores/myGames';
import { weekProgress } from '$lib/study/shareProgress';
import { NAV_ITEMS } from '$lib/nav';

const fideGame = (id: string, at: number, result: string, opp = 1800): SavedGame => ({
  id, playedAt: at, kind: 'fide', white: 'You', black: `FIDE ${opp}`, userSide: 'white', result, reason: '', timeControl: '15+10', opponentRating: opp, startFen: '', uci: ['e2e4'],
});

describe('Chess Guide', () => {
  it('finds the tie-break answer in English, Hindi and Marathi', () => {
    expect(findGuide('how does the tie break work?')[0]?.id).toBe('tiebreak');
    expect(findGuide('Tie-break कैसे काम करता है')[0]?.id).toBe('tiebreak');
    expect(findGuide('टायब्रेक म्हणजे काय')[0]?.id).toBe('tiebreak');
  });
  it('finds how the rating is calculated', () => {
    expect(findGuide('how is fide rating calculated')[0]?.id).toBe('calc');
    expect(findGuide('rating कशी calculate होते')[0]?.id).toBe('calc');
  });
  it('says nothing for a question it does not know', () => {
    expect(findGuide('best pizza near me')).toEqual([]);
  });
  it('every answer exists in all three languages', () => {
    for (const g of GUIDE) for (const l of ['en', 'hi', 'mr'] as const) {
      expect(g.q[l].length, `${g.id} ${l} question`).toBeGreaterThan(3);
      expect(g.a[l].length, `${g.id} ${l} answer`).toBeGreaterThan(0);
    }
  });
});

describe('Blog', () => {
  it('every post exists in all three languages, with unique addresses', () => {
    expect(new Set(POSTS.map((p) => p.slug)).size).toBe(POSTS.length);
    for (const p of POSTS) for (const l of ['en', 'hi', 'mr'] as const) {
      expect(p.title[l], `${p.slug} ${l}`).toBeTruthy();
      expect(p.summary[l]).toBeTruthy();
      expect(p.body[l].length).toBeGreaterThan(2);
    }
  });
});

describe('ratings in My games', () => {
  it('shows the CC Rating before the game and the change, for old games too', () => {
    const games = [fideGame('a', 1000, '1-0'), fideGame('b', 2000, '0-1')];
    const all = computeKfideAll(games);
    const first = gameRating(games[0], all);
    expect(first.before).toBe(1500);
    expect(first.after).toBeGreaterThan(1500);
    expect(ratingText(first)).toMatch(/^1500 \(\+\d+\)$/);
    const second = gameRating(games[1], all);
    expect(second.before).toBe(first.after);
    expect(ratingText(second)).toMatch(/\(−\d+\)$/);
  });
  it('uses the Lichess rating saved with a Lichess game, and none for the computer', () => {
    const all = computeKfideAll([]);
    const li: SavedGame = { ...fideGame('l', 1, '1-0'), kind: 'lichess', myRating: 1712 };
    expect(ratingText(gameRating(li, all))).toBe('1712');
    const old: SavedGame = { ...li, myRating: undefined };
    expect(ratingText(gameRating(old, all))).toBe('');
    expect(ratingText(gameRating({ ...li, kind: 'computer' }, all))).toBe('');
  });
});

describe('friends see study progress', () => {
  it('counts this week: points, puzzles, days and streak', () => {
    const now = new Date(2026, 9, 21, 12).getTime();
    const day = 86_400_000;
    const acts = [
      { at: now, kind: 'puzzle' as const, points: 20, label: 'p' },
      { at: now - 100, kind: 'puzzle' as const, points: 20, label: 'p' },
      { at: now - day, kind: 'game' as const, points: 10, label: 'g' },
    ];
    const p = weekProgress(acts, 1523.4, 40, now);
    expect(p.points).toBe(50);
    expect(p.puzzlesWeek).toBe(2);
    expect(p.studyDays).toBe(2);
    expect(p.streak).toBe(2);
    expect(p.puzzleRating).toBe(1523);
  });
});

describe('menu', () => {
  it('lists each page once, Learn first, Watch second, My games third', () => {
    const hrefs = NAV_ITEMS.map((n) => n.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.slice(0, 3)).toEqual(['/learn', '/watch', '/games']);
    expect(NAV_ITEMS.find((n) => n.href === '/vision')?.label).toBe('Blindfold Gym');
    expect(NAV_ITEMS.find((n) => n.href === '/community')?.label).toBe('FIDE & Local Events');
  });
});

import { describe, expect, it } from 'vitest';
import type { GameReview, MoveReview } from '$lib/coach/review';
import type { SavedGame } from '$lib/stores/myGames';
import { results, reviewedGames, style } from './allTime';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const game = (id: string, side: 'white' | 'black', result: string, at: number, uci = ['e2e4', 'e7e5']): SavedGame => ({
  id, playedAt: at, kind: 'computer', white: side === 'white' ? 'You' : 'Bot', black: side === 'black' ? 'You' : 'Bot', userSide: side, result, reason: '', timeControl: '', startFen: START, uci,
});
const classes = (over: Partial<GameReview['sides']['white']['classes']> = {}) => ({ brilliant: 0, only: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0, ...over });
const review = (acc: number, over = {}): GameReview => ({
  accuracy: acc, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, moves: [], all: [] as MoveReview[], fens: [],
  sides: { white: { accuracy: acc, classes: classes(over) }, black: { accuracy: acc, classes: classes(over) } },
});

describe('all-time stats', () => {
  const games = [game('a', 'white', '1-0', 1), game('b', 'black', '1-0', 2), game('c', 'white', '1/2-1/2', 3), game('d', 'white', '*', 4)];

  it('counts finished games by result, for either colour', () => {
    expect(results(games, 'all')).toEqual({ games: 3, won: 1, drawn: 1, lost: 1 });
    expect(results(games, 'white')).toEqual({ games: 2, won: 1, drawn: 1, lost: 0 });
    expect(results(games, 'black')).toEqual({ games: 1, won: 0, drawn: 0, lost: 1 });
  });

  it('pairs kept reviews with their games and adds up accuracy and badges', () => {
    const g = [game('a', 'white', '1-0', 1, ['e2e4']), game('b', 'black', '0-1', 2, ['d2d4'])];
    const kept = [
      { moves: 'e2e4', side: 'white' as const, review: review(80, { brilliant: 1, miss: 1 }) },
      { moves: 'd2d4', side: 'black' as const, review: review(60, { blunder: 2 }) },
      { moves: 'c2c4', side: 'white' as const, review: review(99) },
    ];
    const list = reviewedGames(g, kept);
    expect(list.map((r) => r.game.id)).toEqual(['a', 'b']);
    const s = style(list, 'all')!;
    expect(s).toMatchObject({ games: 2, accuracy: 70, recent: 0, best: { accuracy: 80 } });
    expect(s.classes).toMatchObject({ brilliant: 1, miss: 1, blunder: 2 });
    expect(style(list, 'black')).toMatchObject({ games: 1, accuracy: 60 });
  });

  it('compares the latest five games with the ones before', () => {
    const accs = [50, 50, 50, 70, 70, 70, 70, 70];
    const g = accs.map((_, i) => game(`g${i}`, 'white', '1-0', i, [`e2e${i}`]));
    const kept = accs.map((a, i) => ({ moves: `e2e${i}`, side: 'white' as const, review: review(a) }));
    const s = style(reviewedGames(g, kept), 'all')!;
    expect(s.recent).toBe(5);
    expect(s.accuracyChange).toBe(20);
  });
});

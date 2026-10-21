import { describe, expect, it } from 'vitest';
import { bankItem, clock, pickPuzzles, sanLine, sideOf, took, topMoves } from './tasks';
import type { Progress } from './api';

describe('classroom questions', () => {
  it('a bank puzzle becomes a question: the opponent move played, the answer is the rest', () => {
    const item = bankItem(['abc', '6k1/5ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 1', 'h7h6 d1d8 g8h7 e1e7', 1200]);
    expect(item?.fen).toBe('6k1/5pp1/7p/8/8/8/5PPP/3RR1K1 w - - 0 2');
    expect(item?.line).toEqual(['d1d8', 'g8h7', 'e1e7']);
    expect(item?.ref).toBe('abc');
    expect(sideOf(item!.fen)).toBe('white');
  });
  it('a puzzle that does not read is left out', () => {
    expect(bankItem(['x', 'nonsense', 'e2e4 e7e5', 1000])).toBeUndefined();
    expect(bankItem(['x', '6k1/5ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 1', 'h7h6', 1000])).toBeUndefined();
  });
  it('picks within the rating range, never the used ones, easiest first', () => {
    const all = Array.from({ length: 50 }, (_, i) => [`p${i}`, 'f', 'm', 800 + i * 20] as [string, string, string, number]);
    const pick = pickPuzzles(all, 1000, 1300, 5, new Set(['p10', 'p11']), () => 0.42);
    expect(pick).toHaveLength(5);
    expect(pick.every((p) => p[3] >= 1000 && p[3] <= 1300 && p[0] !== 'p10' && p[0] !== 'p11')).toBe(true);
    expect(pick.map((p) => p[3])).toEqual([...pick.map((p) => p[3])].sort((a, b) => a - b));
  });
  it('too few in the range: the nearest outside it', () => {
    const all = Array.from({ length: 10 }, (_, i) => [`p${i}`, 'f', 'm', 2000 + i * 10] as [string, string, string, number]);
    expect(pickPuzzles(all, 600, 800, 3, new Set())).toHaveLength(3);
  });
  it('writes lines in SAN with move numbers', () => {
    expect(sanLine('6k1/5pp1/7p/8/8/8/5PPP/3RR1K1 w - - 0 2', ['d1d8', 'g8h7', 'e1e7'])).toBe('2. Rd8+ Kh7 3. Re7');
    expect(sanLine('6k1/5pp1/7p/8/8/8/5PPP/3RR1K1 b - - 0 2', ['g8h7'])).toBe('2... Kh7');
  });
  it("the class's first moves, most played first", () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const p = (uid: string, first: string | undefined, solved: boolean, tried: string[][] = []): Progress => ({ uid, name: uid, item: 1, moves: [], wrong: 0, tried: [], itemStart: 0, results: [{ solved, wrong: tried.length, ms: 1000, points: 5, moves: first ? [first] : [], tried }], points: 5, done: true, at: 0 });
    const tops = topMoves([p('a', 'h5f7', true), p('b', 'h5f7', true), p('c', undefined, false, [['c4f7']])], 0, fen);
    expect(tops[0]).toMatchObject({ san: 'Qxf7#', n: 2, right: true });
    expect(tops[1]).toMatchObject({ san: 'Bxf7+', n: 1, right: false });
  });
  it('clocks and times', () => {
    expect(clock(65_000)).toBe('1:05');
    expect(clock(400)).toBe('0:01');
    expect(clock(-5)).toBe('0:00');
    expect(took(32_400)).toBe('32s');
    expect(took(65_000)).toBe('1m 05s');
  });
});

describe('the class board', () => {
  it('replays the line to a ply, with every move in SAN', async () => {
    const { lineAt, toPgn } = await import('./tasks');
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const at = lineAt(start, ['e2e4', 'e7e5', 'g1f3'], 2);
    expect(at.sans).toEqual(['e4', 'e5', 'Nf3']);
    expect(at.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(at.last).toEqual(['e7', 'e5']);
    expect(lineAt(start, [], 0).fen).toBe(start);
    expect(toPgn(start, ['e2e4', 'e7e5'])).toContain('1. e4 e5 *');
    expect(toPgn('8/8/8/8/8/8/8/K1k5 w - - 0 1', [], 'Ending')).toContain('[FEN "8/8/8/8/8/8/8/K1k5 w - - 0 1"]');
  });
});

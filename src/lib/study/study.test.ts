import { existsSync, readFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { describe, expect, it } from 'vitest';
import { CloudBook, type BookEntry, type BookSource } from '$lib/book/book';
import { playSans, uciToMove } from '$lib/chess/position';
import { polyglotKey } from '$lib/chess/polyglot';
import { badges, bestStreak, dayOf, monthDays, monthPoints, streak, type Activity } from './progress';
import { buildTree, dueCount, grade, learnedCount, nextLine, sameMove, userNodes } from './openingTree';
import { freshCard, Recall, review } from './srs';

const DAY = 86_400_000;
const e = (band: number, uci: string, games: number): BookEntry => ({ band, move: uciToMove(uci)!, games, wins: 0, draws: 0 });

class FakeBook implements BookSource {
  private readonly byKey = new Map<bigint, BookEntry[]>();
  constructor(bySans: Record<string, BookEntry[]>) {
    for (const [s, list] of Object.entries(bySans)) this.byKey.set(polyglotKey(s ? playSans(s) : Chess.default()), list);
  }
  async entries(pos: Chess) {
    return this.byKey.get(polyglotKey(pos)) ?? [];
  }
  prefetch() {}
}

describe('SM-2', () => {
  it('schedules 1 day, 6 days, then grows by the ease', () => {
    const now = 1_000_000;
    let c = freshCard('x', now);
    c = review(c, Recall.easy, now);
    expect(c.intervalDays).toBe(1);
    c = review(c, Recall.easy, now);
    expect(c.intervalDays).toBe(6);
    c = review(c, Recall.slow, now);
    expect(c.intervalDays).toBe(Math.round(6 * 2.7));
  });

  it('a wrong answer comes back in ten minutes and lowers the ease', () => {
    const c = review({ ...freshCard('x', 0), repetitions: 3, intervalDays: 15 }, Recall.wrong, 0);
    expect(c).toMatchObject({ repetitions: 0, intervalDays: 0, due: 600_000 });
    expect(c.ease).toBeLessThan(2.5);
    expect(review({ ...c, ease: 1.3 }, Recall.wrong, 0).ease).toBe(1.3);
  });
});

describe('opening tree', () => {
  // The player is Black in the Sicilian: White's replies branch, Black's move is one.
  const book = new FakeBook({
    'e4 c5': [e(90, 'g1f3', 80), e(90, 'b1c3', 15), e(90, 'a2a3', 2)],
    'e4 c5 Nf3': [e(90, 'd7d6', 50), e(90, 'b8c6', 40)],
    'e4 c5 Nc3': [e(90, 'b8c6', 30)],
    'e4 c5 Nf3 d6': [e(90, 'd2d4', 90)],
    'e4 c5 Nc3 Nc6': [e(90, 'g2g3', 10)],
  });

  it('keeps the main move at your turns and popular replies at theirs', async () => {
    const t = await buildTree({ book, openingId: 'sicilian', rootSans: 'e4 c5', userSide: 'black', depth: 4 });
    const root = t.nodes[t.rootKey];
    expect(root.next.map((x) => x.san)).toEqual(['Nf3', 'Nc3']); // a3 is under 8%
    const afterNf3 = t.nodes[root.next[0].child];
    expect(afterNf3.next.map((x) => x.san)).toEqual(['d6']);
    expect(userNodes(t)).toHaveLength(2);
    expect(dueCount(t, Date.now())).toBe(2);
  });

  it('trains the most overdue branch first', async () => {
    const t = await buildTree({ book, openingId: 'sicilian', rootSans: 'e4 c5', userSide: 'black', depth: 4 });
    const now = Date.now();
    const [nf3, nc3] = t.nodes[t.rootKey].next;
    // Learn the Nf3 position well; the Nc3 one stays due.
    for (let i = 0; i < 3; i++) grade(t, nf3.child, Recall.easy, now);
    expect(learnedCount(t)).toBe(1);
    for (let i = 0; i < 20; i++) expect(nextLine(t, now)[0].san).toBe(nc3.san);
  });

  it('castling counts written either way', () => {
    // After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5: White may castle.
    const fen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    expect(sameMove(fen, 'e1g1', 'e1h1')).toBe(true);
    expect(sameMove(fen, 'e1h1', 'e1g1')).toBe(true);
    expect(sameMove(fen, 'e1f1', 'e1g1')).toBe(false);
  });
});

describe('study progress', () => {
  const at = (daysAgo: number, kind: Activity['kind'] = 'puzzle', points = 20): Activity => ({
    at: new Date(2026, 9, 16, 12).getTime() - daysAgo * DAY,
    kind,
    points,
    label: '',
  });
  const now = new Date(2026, 9, 16, 18).getTime();

  it('counts the streak up to today, or yesterday until today is done', () => {
    expect(streak([at(0), at(1), at(2), at(4)], now)).toBe(3);
    expect(streak([at(1), at(2)], now)).toBe(2);
    expect(streak([at(3)], now)).toBe(0);
    expect(bestStreak([at(9), at(8), at(7), at(6), at(1)])).toBe(4);
  });

  it('sums the month and maps study days', () => {
    const list = [at(0, 'trainer', 10), at(1, 'puzzle', 20), at(40, 'game', 10)];
    expect(monthPoints(list, now)).toBe(30);
    const days = monthDays(list, 2026, 9);
    expect([...days.keys()].sort()).toEqual([15, 16]);
    expect(days.get(16)?.has('trainer')).toBe(true);
    expect(dayOf(now)).toBe('2026-10-16');
  });

  it('awards badges', () => {
    const week = Array.from({ length: 7 }, (_, i) => at(i));
    const earned = badges(week, now, 0).filter((b) => b.earned).map((b) => b.id);
    expect(earned).toEqual(['streak7']);
    expect(badges([], now, 1).find((b) => b.id === 'opening')?.earned).toBe(true);
  });
});

const SHARDS = 'F:/dev/gamesdb_work/site/v1';
describe.runIf(existsSync(SHARDS))('a tree from the real book', () => {
  it('builds the Najdorf for Black from strong players', async () => {
    const fromDisk = (async (url: string) =>
      new Response(readFileSync(`${SHARDS}/${url.split('/').pop()}`) as BodyInit)) as unknown as typeof fetch;
    const t = await buildTree({
      book: new CloudBook('https://book.example/v1', 3000, fromDisk),
      openingId: 'najdorf',
      rootSans: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
      userSide: 'black',
      depth: 10,
    });
    const nodes = Object.keys(t.nodes).length;
    expect(nodes).toBeGreaterThan(15);
    expect(nodes).toBeLessThan(400);
    // White's main tries after 6...a6 are all there.
    const replies = t.nodes[t.rootKey].next.map((x) => x.san);
    expect(replies).toEqual(expect.arrayContaining(['Be3', 'Bg5']));
    console.log(`Najdorf tree: ${nodes} positions, ${userNodes(t).length} to learn; White plays ${replies.join(', ')}`);
  }, 30_000);
});

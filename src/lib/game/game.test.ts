import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import type { NormalMove } from 'chessops/types';
import { describe, expect, it, vi } from 'vitest';
import type { BookEntry, BookSource } from '$lib/book/book';
import { FideBot } from '$lib/bot/fideBot';
import { playSans, uciToMove } from '$lib/chess/position';
import { polyglotKey } from '$lib/chess/polyglot';
import { FideGame, fallbackMove, moveTime, type MoveKind, type TimeControl } from './fideGame';
import { PremoveQueue } from './premoves';

const m = (uci: string) => uciToMove(uci)!;
const e = (band: number, uci: string, games: number): BookEntry => ({ band, move: m(uci), games, wins: 0, draws: 0 });

/** A book keyed by the moves played from the start. */
class FakeBook implements BookSource {
  private readonly byKey = new Map<bigint, BookEntry[]>();
  lookups = 0;
  prefetched: bigint[] = [];
  constructor(bySans: Record<string, BookEntry[]>) {
    for (const [sans, entries] of Object.entries(bySans)) {
      this.byKey.set(polyglotKey(sans ? playSans(sans) : Chess.default()), entries);
    }
  }
  async entries(pos: Chess) {
    this.lookups++;
    return this.byKey.get(polyglotKey(pos)) ?? [];
  }
  prefetch(positions: Chess[]) {
    this.prefetched.push(...positions.map(polyglotKey));
  }
}

const noEngine = async () => undefined;
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A seeded random, so weighted picks are repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

describe('FideBot', () => {
  it('follows the chosen opening, then the book', async () => {
    const book = new FakeBook({ 'e4 c5': [e(72, 'g1f3', 10)] });
    const bot = new FideBot(book, noEngine);
    const c = await bot.choose(playSans('e4'), ['e4'], 1800, ['e4', 'c5']);
    expect(c).toMatchObject({ source: 'opening', move: m('c7c5') });
    expect(book.lookups).toBe(0);
    expect(await bot.choose(playSans('d4'), ['d4'], 1800, ['e4', 'c5'])).toBeUndefined();
    expect(book.lookups).toBe(1);
  });

  it('widens the window only when ±25 has too few games', async () => {
    const book = new FakeBook({ '': [e(72, 'e2e4', 1), e(73, 'd2d4', 6)] });
    const c = await new FideBot(book, noEngine).choose(Chess.default(), [], 1800);
    expect(c).toMatchObject({ source: 'book', window: 50, games: 7 });
  });

  it('uses the engine for one move only, then the book again', async () => {
    const book = new FakeBook({ 'e4 e5 Nf3': [e(72, 'b8c6', 20)] });
    let calls = 0;
    const bot = new FideBot(book, async () => {
      calls++;
      return m('e7e5');
    });
    expect((await bot.choose(playSans('e4'), ['e4'], 1800))?.source).toBe('engine');
    const second = await bot.choose(playSans('e4 e5 Nf3'), ['e4', 'e5', 'Nf3'], 1800);
    expect(second).toMatchObject({ source: 'book', move: m('b8c6') });
    expect(calls).toBe(1);
  });

  it('picks moves in proportion to how often players chose them', async () => {
    const book = new FakeBook({ '': [e(72, 'e2e4', 60), e(72, 'd2d4', 30), e(72, 'c2c4', 10)] });
    const bot = new FideBot(book, noEngine, seeded(7));
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const c = await bot.choose(Chess.default(), [], 1800);
      const k = `${c!.move.from}-${c!.move.to}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(counts['12-28'] / 2000).toBeCloseTo(0.6, 1);
    expect(counts['11-27'] / 2000).toBeCloseTo(0.3, 1);
  });

  it('steers away from openings it played recently', async () => {
    const book = new FakeBook({ '': [e(72, 'e2e4', 50), e(72, 'd2d4', 50)] });
    const bot = new FideBot(book, noEngine, seeded(3));
    bot.recentOpenings = ['e4 e5 Nf3', 'e4 c5', 'e4 e6 d4'];
    let e4 = 0;
    for (let i = 0; i < 2000; i++) if ((await bot.choose(Chess.default(), [], 1800))!.move.from === 12) e4++;
    expect(e4 / 2000).toBeCloseTo(1 / 9, 1);
  });

  it('skips one-off moves and prefers moves that scored well, more so when strong', async () => {
    const scored = (band: number, uci: string, games: number, score: number): BookEntry => ({ band, move: m(uci), games, wins: Math.round(games * score), draws: 0 });
    const share = async (rating: number) => {
      const band = rating / 25;
      const book = new FakeBook({ '': [scored(band, 'e2e4', 50, 0.7), scored(band, 'd2d4', 50, 0.3), scored(band, 'a2a3', 1, 1)] });
      const bot = new FideBot(book, noEngine, seeded(5));
      let e4 = 0;
      for (let i = 0; i < 1000; i++) {
        const c = (await bot.choose(Chess.default(), [], rating))!;
        expect(c.move.from).not.toBe(8);
        if (c.move.from === 12) e4++;
      }
      return e4 / 1000;
    };
    expect(await share(1200)).toBeCloseTo(0.5, 1);
    expect(await share(2500)).toBeGreaterThan(0.75);
  });

  it('lets the engine play when a strong bot’s thin book move fails the guard', async () => {
    const book = new FakeBook({ '': [e(100, 'f2f3', 3), e(60, 'f2f3', 3)] });
    const guarded = new FideBot(book, async () => m('e2e4'), Math.random, async (_p, mv) => mv.from !== 13);
    expect(await guarded.choose(Chess.default(), [], 2500)).toMatchObject({ source: 'engine', move: m('e2e4') });
    // Weaker bots play like their book, mistakes and all.
    expect(await guarded.choose(Chess.default(), [], 1500)).toMatchObject({ source: 'book', move: m('f2f3') });
  });

  it('prefetches the positions after the most popular replies', async () => {
    const book = new FakeBook({ e4: [e(72, 'e7e5', 50), e(80, 'c7c5', 30), e(60, 'e7e6', 10), e(72, 'a7a6', 1)] });
    await new FideBot(book, noEngine).prefetchReplies(playSans('e4'));
    expect(book.prefetched).toEqual(['e4 e5', 'e4 c5', 'e4 e6'].map((s) => polyglotKey(playSans(s))));
  });
});

describe('FideGame', () => {
  const blitz: TimeControl = { minutes: 5, increment: 3, kind: 'Blitz' };

  function game(book: BookSource, opts: { human?: 'white' | 'black'; tc?: TimeControl; engine?: (p: Chess) => Promise<NormalMove | undefined>; pace?: 'quick' | 'real' } = {}) {
    const clock = { t: 0 };
    const g = new FideGame({
      bot: new FideBot(book, opts.engine ?? noEngine, seeded(1)),
      rating: 1800,
      human: opts.human ?? 'white',
      timeControl: opts.tc ?? blitz,
      now: () => clock.t,
      wait: async (ms) => {
        clock.t += ms;
      },
      random: seeded(1),
      pace: opts.pace,
    });
    return { g, clock };
  }

  it("takeback: the player's last move and the reply go, on the player's turn only", async () => {
    const { g } = game(new FakeBook({ e4: [e(72, 'e7e5', 10)], 'e4 e5 Nf3': [e(72, 'b8c6', 10)] }), { tc: { minutes: 0, increment: 0, kind: 'Rapid' } });
    g.begin();
    expect(g.canTakeback).toBe(false);
    expect(g.play(m('e2e4'))).toBe(true);
    expect(g.canTakeback).toBe(false); // the computer is thinking
    await flush();
    expect(g.sans).toEqual(['e4', 'e5']);
    expect(g.play(m('g1f3'))).toBe(true);
    await flush();
    expect(g.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(g.takeback()).toBe(true);
    expect(g.sans).toEqual(['e4', 'e5']);
    expect(g.myTurn).toBe(true);
    // Another move from there: the computer answers as usual.
    expect(g.play(m('g1f3'))).toBe(true);
    await flush();
    expect(g.sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(g.takeback() && g.takeback()).toBe(true);
    expect(g.sans).toEqual([]);
    expect(g.takeback()).toBe(false);
    g.dispose();
  });

  it('a draw the computer agreed to ends the game ½-½, by agreement', async () => {
    const { g } = game(new FakeBook({ e4: [e(72, 'e7e5', 10)] }), { tc: { minutes: 0, increment: 0, kind: 'Rapid' } });
    g.begin();
    expect(g.play(m('e2e4'))).toBe(true);
    await flush();
    g.agreeDraw();
    expect(g.isOver).toBe(true);
    expect(g.result).toBe('½-½');
    expect(g.end).toBe('agreement');
    expect(g.endReason).toBe('Draw by agreement');
    g.dispose();
  });

  it('the bot always answers: a move even when the engine gives none or never answers', async () => {
    const none = game(new FakeBook({}), { human: 'black' });
    none.g.begin();
    await flush();
    expect(none.g.sans).toHaveLength(1);
    none.g.dispose();

    vi.useFakeTimers();
    try {
      const hung = game(new FakeBook({}), { human: 'black', engine: () => new Promise(() => {}) });
      hung.g.begin();
      await vi.advanceTimersByTimeAsync(13_000);
      expect(hung.g.sans).toHaveLength(1);
      expect(hung.g.isOver).toBe(false);
      hung.g.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the fallback move mates in one and takes a free queen', () => {
    const mate = playSans('f3 e5 g4');
    expect(fallbackMove(mate)).toMatchObject({ from: 59, to: 31 });
    const free = Chess.fromSetup(parseFen('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1').unwrap()).unwrap();
    expect(fallbackMove(free)).toMatchObject({ from: 3, to: 35 });
  });

  it('the bot opens as White and answers the player', async () => {
    const { g } = game(new FakeBook({ '': [e(72, 'e2e4', 10)], 'e4 e5': [e(72, 'g1f3', 10)] }), { human: 'black' });
    g.begin();
    await flush();
    expect(g.sans).toEqual(['e4']);
    expect(g.play(m('e7e5'))).toBe(true);
    await flush();
    expect(g.sans).toEqual(['e4', 'e5', 'Nf3']);
    expect(g.moves[2].source).toBe('book');
    g.dispose();
  });

  it("starts at a line's position: its moves on the board, clocks from the moves after it", async () => {
    const clock = { t: 0 };
    const g = new FideGame({
      bot: new FideBot(new FakeBook({ 'e4 c6 d4 d5 e5 Bf5 Nf3': [e(72, 'e7e6', 10)] }), noEngine, seeded(1)),
      rating: 1800,
      human: 'white',
      timeControl: blitz,
      prelude: 'e4 c6 d4 d5 e5 Bf5'.split(' '),
      now: () => clock.t,
      wait: async (ms) => {
        clock.t += ms;
      },
      random: seeded(1),
    });
    g.begin();
    expect(g.sans).toEqual(['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5']);
    expect(g.myTurn).toBe(true);
    expect(g.canAbort).toBe(true);
    clock.t = 30_000;
    // The player's clock doesn't run on their first move from the line.
    expect(g.remaining('white')).toBe(300_000);
    expect(g.play(m('g1f3'))).toBe(true);
    await flush();
    expect(g.sans.slice(6)).toEqual(['Nf3', 'e6']);
    g.dispose();
  });

  it("clocks start with White's first move (as on chess.com) and add the increment", async () => {
    const { g, clock } = game(new FakeBook({ e4: [e(72, 'e7e5', 10)], 'e4 e5 Nf3': [e(72, 'b8c6', 10)] }));
    g.begin();
    // White's first move is not timed…
    clock.t += 20_000;
    g.play(m('e2e4'));
    expect(g.remaining('white')).toBe(300_000);
    // …Black's clock runs from it (4 s to answer, plus the increment).
    clock.t += 4_000;
    await flush();
    expect(g.remaining('black')).toBe(299_000);
    clock.t += 10_000;
    g.play(m('g1f3'));
    await flush();
    expect(g.remaining('white')).toBe(293_000);
    g.dispose();
  });

  it('running out of time loses', async () => {
    const { g, clock } = game(new FakeBook({ e4: [e(72, 'e7e5', 10)] }));
    g.begin();
    g.play(m('e2e4'));
    await flush();
    clock.t += 360_000;
    g.tick();
    expect(g.end).toBe('timeout');
    expect(g.result).toBe('0-1');
    g.dispose();
  });

  it('the same position three times is a draw', async () => {
    const replies = ['g8f6', 'f6g8', 'g8f6', 'f6g8'];
    let i = 0;
    const { g } = game(new FakeBook({}), { engine: async () => m(replies[i++]) });
    g.begin();
    for (const uci of ['g1f3', 'f3g1', 'g1f3', 'f3g1']) {
      expect(g.play(m(uci))).toBe(true);
      await flush();
      if (g.isOver) break;
    }
    expect(g.end).toBe('threefold');
    expect(g.result).toBe('½-½');
    g.dispose();
  });

  it('abort is only possible before the player moves', async () => {
    const { g } = game(new FakeBook({ e4: [e(72, 'e7e5', 5)] }));
    g.begin();
    expect(g.canAbort).toBe(true);
    g.play(m('e2e4'));
    await flush();
    expect(g.canAbort).toBe(false);
    g.dispose();
  });

  it('uses its clock evenly, like a real player, and never runs short', () => {
    for (const [minutes, increment] of [[5, 0], [15, 10], [90, 30]]) {
      const random = seeded(minutes);
      let left = minutes * 60_000;
      const used: number[] = [];
      for (let n = 1; n <= 70; n++) {
        const kind = n <= 8 ? 'theory' : n % 7 === 0 ? 'recapture' : 'normal';
        const t = moveTime({ left, increment: increment * 1000, moveNo: n, rating: 1800, kind, confidence: random(), random });
        used.push(t);
        left += increment * 1000 - t;
      }
      const avg = (a: number, b: number) => used.slice(a - 1, b).reduce((x, y) => x + y, 0) / (b - a + 1);
      // Theory is quick, the middlegame gets the most time, and the pace
      // later on stays within a few times the middlegame's.
      expect(avg(1, 8)).toBeLessThan(avg(11, 30) / 2);
      expect(avg(31, 50)).toBeGreaterThan(avg(11, 30) / 3);
      expect(avg(51, 70)).toBeGreaterThan(avg(11, 30) / 5);
      expect(left).toBeGreaterThan(minutes * 60_000 * 0.05);
    }
  });

  it('in bullet, the quick pace does not hurry the bot: the clock decides there, so it keeps a real pace', async () => {
    const bullet: TimeControl = { minutes: 1, increment: 0, kind: 'Bullet' };
    const { g } = game(new FakeBook({ e4: [e(72, 'e7e5', 5)] }), { tc: bullet, pace: 'quick' });
    g.begin();
    g.play(m('e2e4'));
    await flush();
    expect(g.sans).toEqual(['e4', 'e5']);
    // A move that isn't obvious: about what a 1+0 player takes, not the 0.4–0.6 s that flagged players before.
    let sum = 0;
    for (let i = 0; i < 200; i++) sum += g.thinkTime('engine', 0.2);
    expect(sum / 200).toBeGreaterThan(1100);
    expect(sum / 200).toBeLessThan(3000);
    g.dispose();
  });

  it("in bullet, keeps close to the player's own pace", () => {
    const at = (mirror?: number) => {
      const random = seeded(5);
      let sum = 0;
      for (let i = 0; i < 400; i++) sum += moveTime({ left: 45_000, increment: 0, moveNo: 15, rating: 1400, kind: 'normal', confidence: 0.5, random, fast: true, mirror });
      return sum / 400;
    };
    // A quick player gets a quicker bot, a slow one (a child on a phone) a slower one.
    expect(at(800)).toBeLessThan(at(2500));
    expect(at(2500)).toBeGreaterThan(1500);
    expect(at(800)).toBeLessThan(1300);
  });

  it('in bullet, plays a little weaker when short of time', () => {
    const bullet: TimeControl = { minutes: 1, increment: 0, kind: 'Bullet' };
    const { g } = game(new FakeBook({}), { tc: bullet });
    g.begin();
    expect(g.playingRating()).toBe(g.rating);
    g.dispose();
  });

  it('uses its bullet clock like a player, and lasts a normal game also when the engines are slow (a phone)', () => {
    for (const [minutes, increment] of [[1, 0], [1, 1]]) {
      for (const rating of [1400, 2000, 2800]) {
        for (const mirror of [undefined, 1500]) {
          const random = seeded(rating + increment);
          let left = minutes * 60_000;
          let first40 = 0;
          let at50 = 0;
          for (let n = 1; n <= 60; n++) {
            // No games database in bullet: every move a "normal" one, each taking the engines 0.7 s.
            const kind = n % 6 === 0 ? 'recapture' : 'normal';
            const t = Math.max(700, moveTime({ left, increment: increment * 1000, moveNo: n, rating, kind, confidence: random(), random, fast: true, mirror }));
            left += increment * 1000 - t;
            if (n <= 40) first40 += t;
            if (n === 50) at50 = left;
          }
          // Never out of time in a game of usual length (with an increment, never), but the clock is used: by
          // move 40 most of a 1+0 clock is gone, as for the player, so the game is won on the board.
          expect(at50).toBeGreaterThan(0);
          if (increment) expect(left).toBeGreaterThan(0);
          else expect(first40).toBeGreaterThan(35_000);
        }
      }
    }
  });

  it('thinks briefly on theory and recaptures, longer when unsure', () => {
    const t = (kind: MoveKind, confidence?: number) => {
      const random = seeded(9);
      let sum = 0;
      for (let i = 0; i < 300; i++) sum += moveTime({ left: 600_000, increment: 0, moveNo: 20, rating: 1800, kind, confidence, random });
      return sum / 300 / 1000;
    };
    expect(t('theory')).toBeLessThan(5);
    expect(t('recapture')).toBeLessThan(t('normal', 0.6));
    expect(t('normal', 0.9)).toBeLessThan(t('normal', 0.2));
    expect(t('forced')).toBeLessThan(2);
  });
});

describe('PremoveQueue', () => {
  it('previews queued moves, castling both ways and promotion', () => {
    const q = new PremoveQueue();
    q.add(m('e2e4'));
    q.add(m('g1f3'));
    const b = q.preview(Chess.default().board);
    expect(b.get(28)?.role).toBe('pawn');
    expect(b.get(21)?.role).toBe('knight');
    const start = playSans('e4 e5 Nf3 Nc6 Bc4 Bc5').board;
    for (const castle of ['e1h1', 'e1g1']) {
      const c = new PremoveQueue();
      c.add(m(castle));
      const after = c.preview(start);
      expect(after.get(6)?.role).toBe('king');
      expect(after.get(5)?.role).toBe('rook');
      expect(after.get(7)).toBeUndefined();
    }
  });

  it('plays the next legal premove, and drops the queue on an illegal one', () => {
    const q = new PremoveQueue();
    q.add(m('g1f3'));
    q.add(m('f1c4'));
    expect(q.takeNext(playSans('e4 e5'))).toEqual(m('g1f3'));
    expect(q.length).toBe(1);
    const bad = new PremoveQueue();
    bad.add(m('e4e5'));
    bad.add(m('g1f3'));
    expect(bad.takeNext(playSans('e4 e5'))).toBeUndefined();
    expect(bad.length).toBe(0);
  });
});

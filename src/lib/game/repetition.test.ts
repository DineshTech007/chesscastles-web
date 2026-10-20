import { describe, expect, it, vi } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeUci, parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { polyglotKey } from '$lib/chess/polyglot';

// The engines are stand-ins: Maia's candidates and Stockfish's scores are set by each test.
const scores = vi.hoisted(() => ({ cp: 0, play: null as string | null, policy: [] as { uci: string; p: number }[], byMove: {} as Record<string, number> }));
vi.mock('$lib/engine/stockfish', () => ({
  engine: {
    play: async () => scores.play,
    scoreMoves: async (_fen: string, moves: string[]) => new Map(moves.map((m) => [m, scores.byMove[m] ?? scores.cp])),
  },
}));
vi.mock('$lib/engine/maia', () => ({
  maia: { policy: async () => scores.policy.map((x) => ({ move: parseUci(x.uci) as NormalMove, p: x.p })) },
  maiaUci: (_pos: unknown, m: NormalMove) => makeUci(m),
}));

const { engineMove, maiaPick, materialLead, repeats, stockfishPick } = await import('./engineMove');

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const play = (pos: Chess, uci: string) => pos.play(parseUci(uci)!);

/** A game's positions, counted as FideGame counts them. */
function history(ucis: string[]) {
  const pos = Chess.default();
  const seen = new Map<bigint, number>([[polyglotKey(pos), 1]]);
  for (const u of ucis) {
    play(pos, u);
    const k = polyglotKey(pos);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return { pos, seen: (p: Chess) => seen.get(polyglotKey(p)) ?? 0 };
}

describe('draws by repetition', () => {
  it('knows a move that brings a position back, and one that lets the opponent repeat it a third time', () => {
    // 1.Nf3 Nf6 2.Ng1 Ng8: the start position has been on the board twice.
    const { pos, seen } = history(['g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(repeats(pos, parseUci('g1f3') as NormalMove, seen)).toBe(true);
    expect(repeats(pos, parseUci('e2e4') as NormalMove, seen)).toBe(false);
    expect(repeats(pos, parseUci('b1c3') as NormalMove, seen)).toBe(false);
    // 1.Nc3 Nc6 2.Nb1 Nb8 3.Nf3 Nf6: 4.Ng1 is new, but then ...Ng8 is the start position a third time.
    const b = history(['b1c3', 'b8c6', 'c3b1', 'c6b8', 'g1f3', 'g8f6']);
    expect(repeats(b.pos, parseUci('f3g1') as NormalMove, b.seen)).toBe(true);
    expect(repeats(b.pos, parseUci('f3e5') as NormalMove, b.seen)).toBe(false);
  });

  // The owner's report (20 Oct 2026): FIDE 2000 had a queen against a bishop and repeated ...Qc7, ...Qd7 into a draw.
  const fen = '5k2/2q2P2/2p2KB1/p1P5/8/8/8/8 b - - 0 1';
  const position = () => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  /** ...Qd7 would be the third time. */
  const seen = (p: Chess) => {
    const after = position();
    play(after, 'c7d7');
    return polyglotKey(p) === polyglotKey(after) ? 2 : 0;
  };
  const picks = async (pick: () => Promise<string | undefined>) => {
    const out: string[] = [];
    for (let i = 0; i < 200; i++) out.push((await pick()) ?? '');
    return out.filter((u) => u === 'c7d7').length;
  };

  it('a winning bot plays on instead of repeating (Maia and Stockfish, Stockfish alone, the casual computer)', async () => {
    expect(materialLead(position())).toBe(6);
    scores.cp = 900;
    scores.policy = [
      { uci: 'c7d7', p: 0.7 },
      { uci: 'c7c8', p: 0.2 },
      { uci: 'c7b8', p: 0.1 },
    ];
    const rnd = seeded(11);
    expect(await picks(async () => makeUci((await maiaPick(position(), 2000, undefined, undefined, rnd, undefined, seen))!.move))).toBe(0);
    expect(await picks(async () => makeUci((await stockfishPick(position(), 2000, undefined, rnd, undefined, seen))!))).toBe(0);
    scores.play = 'c7d7';
    expect(await picks(async () => makeUci((await engineMove(position(), 2000, undefined, undefined, seen))!))).toBe(0);
    // Before the fix (no positions passed) Maia's favourite repeated most of the time.
    expect(await picks(async () => makeUci((await maiaPick(position(), 2000, undefined, undefined, rnd))!.move))).toBeGreaterThan(100);
  });

  it('a winning bot does not shuffle into a draw by the fifty-move rule', () => {
    const late = Chess.fromSetup(parseFen('5k2/2q2P2/2p2KB1/p1P5/8/8/8/8 b - - 98 120').unwrap()).unwrap();
    const none = () => 0;
    expect(repeats(late, parseUci('c7d7') as NormalMove, none)).toBe(true);
    expect(repeats(late, parseUci('a5a4') as NormalMove, none)).toBe(false);
    const early = Chess.fromSetup(parseFen('5k2/2q2P2/2p2KB1/p1P5/8/8/8/8 b - - 40 120').unwrap()).unwrap();
    expect(repeats(early, parseUci('c7d7') as NormalMove, none)).toBe(false);
  });

  it('a strong bot plays the mate it is shown; a weak one may not', async () => {
    // Black to move: ...Qg3# is mate; the other moves keep a big win.
    const fenMate = '6k1/5ppp/8/8/8/6q1/5P2/7K b - - 0 1';
    const mate = () => Chess.fromSetup(parseFen(fenMate).unwrap()).unwrap();
    scores.cp = 1400;
    scores.byMove = { g3g1: 3000 };
    scores.policy = [
      { uci: 'g3f3', p: 0.6 },
      { uci: 'g3g1', p: 0.25 },
      { uci: 'g3e1', p: 0.15 },
    ];
    const rnd = seeded(9);
    const mates = async (rating: number) => {
      let n = 0;
      for (let i = 0; i < 200; i++) if (makeUci((await maiaPick(mate(), rating, undefined, undefined, rnd))!.move) === 'g3g1') n++;
      return n;
    };
    expect(await mates(2000)).toBe(200);
    expect(await mates(1400)).toBeLessThan(200);
    let sf = 0;
    for (let i = 0; i < 200; i++) if (makeUci((await stockfishPick(mate(), 2000, undefined, rnd))!) === 'g3g1') sf++;
    expect(sf).toBe(200);
    scores.byMove = {};
  });

  it('a strong bot converts a won position with its best move; a weaker one may drift', async () => {
    const won = () => Chess.fromSetup(parseFen('6k1/5ppp/8/8/8/6q1/5P2/7K b - - 0 1').unwrap()).unwrap();
    scores.cp = 900;
    scores.byMove = { g3e1: 1900 };
    scores.policy = [
      { uci: 'g3f3', p: 0.6 },
      { uci: 'g3e1', p: 0.25 },
      { uci: 'g3h3', p: 0.15 },
    ];
    const rnd = seeded(4);
    const best = async (rating: number) => {
      let n = 0;
      for (let i = 0; i < 200; i++) if (makeUci((await maiaPick(won(), rating, undefined, undefined, rnd))!.move) === 'g3e1') n++;
      return n;
    };
    expect(await best(2000)).toBe(200);
    expect(await best(1400)).toBeLessThan(200);
    scores.byMove = {};
  });

  it('a losing bot takes the draw', async () => {
    scores.cp = -900;
    scores.policy = [
      { uci: 'c7d7', p: 0.7 },
      { uci: 'c7c8', p: 0.2 },
      { uci: 'c7b8', p: 0.1 },
    ];
    const rnd = seeded(5);
    expect(await picks(async () => makeUci((await maiaPick(position(), 2000, undefined, undefined, rnd, undefined, seen))!.move))).toBe(200);
  });
});

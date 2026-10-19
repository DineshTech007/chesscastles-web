import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import type { EngineMove, EnginePick, MoveGuard } from '$lib/bot/fideBot';
import { engine } from '$lib/engine/stockfish';
import { maia, maiaUci } from '$lib/engine/maia';
import { fenOf, uciToMove } from '$lib/chess/position';
import type { TimeControl } from './fideGame';

/** Stockfish at about [rating] (it plays no weaker than 1320). */
export async function engineMove(pos: Chess, rating: number): Promise<NormalMove | undefined> {
  const uci = await engine.play(fenOf(pos), rating, 700);
  return uci ? uciToMove(uci) : undefined;
}

/**
 * How a FIDE rating is played: the Maia-3 rating whose candidate moves look
 * like that player's, and how strictly Stockfish's check steers away from
 * the weaker ones (`tau`: the winning chance a move may give away and still
 * be picked fairly often; 1 = no check, pure Maia).
 *
 * Fitted by scripts/calibrate-bot.ts on 450 positions from real games
 * between FIDE-rated players (CaissaBase, 150 each at 1400, 1800 and 2200):
 * with these settings the bot gives away about as much winning chance per
 * move, and blunders about as often, as the players did. (Real players:
 * 1400 lose 2.9% a move and blunder 2.0% of moves; 1800: 2.7% and 0.7%;
 * 2200: 3.0% and 0.0%. The old Stockfish bot, limited to the same ratings,
 * blundered 2.7%, 2.0% and 2.0%.) Below 1400 and above 2200 the table
 * extends the trend.
 *
 * Those games were played before FIDE's 2024 change, so the table's ratings
 * are converted to today's scale (old + 0.4 × (2000 − old) under 2000): the
 * calibration's 1400 and 1800 players are rated 1640 and 1880 today.
 */
export const STRENGTH: [fide: number, maiaElo: number, tau: number][] = [
  [1160, 1100, 1],
  [1400, 1600, 1],
  [1640, 2400, 1],
  [1880, 2600, 0.3],
  [2200, 2700, 0.1],
  [2600, 2700, 0.035],
  [3000, 2700, 0.012],
];

/** Faster games are played less accurately than the classical games ratings come from. */
const TIME_PRESSURE = (tc?: TimeControl) => (!tc || tc.minutes === 0 ? 0 : tc.minutes + tc.increment * 0.67 <= 2 ? 250 : tc.minutes + tc.increment * 0.67 <= 6 ? 150 : tc.minutes < 30 ? 50 : 0);

export function strengthFor(rating: number, tc?: TimeControl): { elo: number; tau: number } {
  const r = Math.min(3000, Math.max(STRENGTH[0][0], rating - TIME_PRESSURE(tc)));
  const i = Math.max(1, STRENGTH.findIndex(([f]) => f >= r));
  const [f0, e0, t0] = STRENGTH[i - 1];
  const [f1, e1, t1] = STRENGTH[i];
  const k = (r - f0) / (f1 - f0);
  // Tau on a log scale, so the steps between ratings feel even.
  return { elo: Math.round(e0 + (e1 - e0) * k), tau: Math.exp(Math.log(t0) + (Math.log(t1) - Math.log(t0)) * k) };
}

/**
 * The most winning chance (0 to 1) one move may give away at a rating, so a
 * bot never makes a blunder far below its level: 45% at 1200, 35% at 1400,
 * 27% at 1600, then 20% at 1800, 12% at 2200, 7% at 2600 and 4% at 3000.
 * (Real 2200+ players blundered 0% of moves in the calibration games.) Below
 * 1800 a bigger blunder still happens now and then: see slipChance.
 */
export function maxDrop(rating: number): number {
  const steps: [number, number][] = [
    [1200, 0.45],
    [1400, 0.35],
    [1600, 0.27],
    [1800, 0.2],
    [2200, 0.12],
    [2600, 0.07],
    [3000, 0.04],
  ];
  if (rating <= steps[0][0]) return steps[0][1];
  const i = steps.findIndex(([r]) => r >= rating);
  if (i < 0) return steps[steps.length - 1][1];
  if (i === 0) return steps[0][1];
  const [r0, d0] = steps[i - 1];
  const [r1, d1] = steps[i];
  return d0 + ((d1 - d0) * (rating - r0)) / (r1 - r0);
}

/**
 * How often (per move) a player below 1800 may still make a move over the
 * limit, the kind of piece-dropping blunder players at that level do make
 * now and then: 2% of moves at 1200, 1% at 1400, 0.5% at 1600, never from 1800.
 * (At 1400, with about 40 moves a game: one such blunder in two or three games.)
 */
export function slipChance(rating: number): number {
  if (rating >= 1800) return 0;
  if (rating <= 1200) return 0.02;
  return rating <= 1400 ? 0.02 - ((rating - 1200) / 200) * 0.01 : rating <= 1600 ? 0.01 - ((rating - 1400) / 200) * 0.005 : 0.005 * ((1800 - rating) / 200);
}

/**
 * Picks among candidate moves: each weighted by `base` (how likely a human is
 * to play it) times exp(−drop / tau), where drop is the winning chance it
 * gives away against the best candidate. Moves over the rating's limit are
 * left out, unless this is one of the rare moves a slip is allowed (`slip`).
 */
export function pickWeighted<T>(cands: { item: T; base: number; wc: number }[], tau: number, limit: number, slip: boolean, random = Math.random): T {
  const best = Math.max(...cands.map((c) => c.wc));
  let weights = cands.map((c) => (best - c.wc > limit && !slip ? 0 : c.base * Math.exp(-(best - c.wc) / tau)));
  if (!weights.some((w) => w > 0)) weights = cands.map((c) => (c.wc === best ? 1 : 0));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) {
    roll -= weights[i];
    if (roll < 0) return cands[i].item;
  }
  return cands[weights.findIndex((w) => w > 0)].item;
}

/** Stockfish's own best move, at full strength. */
const bestMove = async (pos: Chess, ms: number) => {
  const uci = await engine.play(fenOf(pos), 3190, ms);
  const m = uci ? uciToMove(uci) : undefined;
  return m && pos.isLegal(m) ? m : undefined;
};

/** Checks a book move from a rare line against Stockfish's best (see FideBot's guard). */
export function bookGuard(tc?: TimeControl): MoveGuard {
  return async (pos, move, rating) => {
    const limit = maxDrop(rating - TIME_PRESSURE(tc));
    if (limit >= 1) return true;
    const best = await bestMove(pos, 300);
    if (!best) return true;
    const ucis = [maiaUci(pos, best), maiaUci(pos, move)];
    if (ucis[0] === ucis[1]) return true;
    const scores = await engine.scoreMoves(fenOf(pos), ucis, 400);
    if (!scores.has(ucis[0]) || !scores.has(ucis[1])) return true;
    return winChance(scores.get(ucis[0])!) - winChance(scores.get(ucis[1])!) <= limit;
  };
}

const winChance = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));

/**
 * A human-like move for a player of `rating`: Maia-3 suggests the moves such
 * a player considers, Stockfish scores them, and one is picked in
 * proportion to how likely a human is to play it, less often the more it
 * gives away. `opponent` is the other player's rating, if known.
 */
export async function maiaPick(pos: Chess, rating: number, opponent?: number, tc?: TimeControl, random = Math.random, limitMs?: number): Promise<EnginePick | undefined> {
  const { elo, tau } = strengthFor(rating, tc);
  const oppo = opponent ? Math.min(2700, Math.max(600, elo + (opponent - rating))) : elo;
  const started = Date.now();
  const policy = await maia.policy(pos, elo, oppo);
  if (!policy.length) return undefined;
  // Stockfish's searches get what is left of the limit, with room for getting their answers.
  const room = limitMs === undefined ? Infinity : (limitMs - (Date.now() - started)) * 0.7;
  const strong = rating - TIME_PRESSURE(tc) >= 2000;
  const cands = policy.filter((x, i) => i < (strong ? 8 : 6) && (i === 0 || x.p >= 0.03));
  // A strong player also finds the best move when it isn't a natural one (when there's time to look).
  const bestMs = strong && room >= 500 ? Math.min(300, room * 0.35) : 0;
  if (bestMs) {
    const best = await bestMove(pos, bestMs);
    if (best && !cands.some((c) => maiaUci(pos, c.move) === maiaUci(pos, best))) cands.push({ move: best, p: 0.03 });
  }
  const scoreMs = Math.min(fastGame(tc) ? 250 : strong ? 700 : 500, room - bestMs);
  const r = rating - TIME_PRESSURE(tc);
  let pick = cands[0];
  if (cands.length > 1 && scoreMs < 100) {
    // No time to check: the natural move, as a player short of time plays.
    pick = pickWeighted(cands.map((c) => ({ item: c, base: c.p * c.p, wc: 0 })), 1, 1, false, random);
  } else if (cands.length > 1) {
    // Stockfish scores Maia's candidates: the weaker ones are picked less often, and a
    // blunder far below the rating only now and then (every rating has a limit).
    const ucis = cands.map((c) => maiaUci(pos, c.move));
    const scores = await engine.scoreMoves(fenOf(pos), ucis, scoreMs);
    if (scores.size) {
      const scored = cands.map((c, i) => ({ item: c, base: c.p, wc: scores.has(ucis[i]) ? winChance(scores.get(ucis[i])!) : 0 }));
      pick = pickWeighted(scored, tau, maxDrop(r), random() < slipChance(r), random);
    } else pick = pickWeighted(cands.map((c) => ({ item: c, base: c.p, wc: 0 })), 1, 1, false, random);
  }
  return { move: pick.move, confidence: policy[0].p, engine: 'maia' };
}

/** Bullet and fast blitz: the engines get less time a move. */
const fastGame = (tc?: TimeControl) => !!tc && tc.minutes > 0 && tc.minutes + tc.increment * 0.67 <= 3;

/**
 * Without Maia (not downloaded yet, or it can't run): Stockfish scores every
 * legal move and one is picked like a player of the rating would, often the
 * best, sometimes a slightly weaker one, a real blunder only now and then.
 * (Stockfish's own weakened mode instead plays well and then throws in random
 * blunders no player of that rating makes.)
 */
export async function stockfishPick(pos: Chess, rating: number, tc?: TimeControl, random = Math.random, limitMs?: number): Promise<NormalMove | undefined> {
  const moves: NormalMove[] = [];
  for (const [from, dests] of pos.allDests()) for (const to of dests) moves.push({ from, to, ...(pos.board.get(from)?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0) ? { promotion: 'queen' as const } : {}) });
  if (moves.length <= 1) return moves[0];
  const ucis = moves.map((m) => maiaUci(pos, m));
  const scores = await engine.scoreMoves(fenOf(pos), ucis, Math.max(80, Math.min(fastGame(tc) ? 300 : 700, (limitMs ?? Infinity) * 0.7)));
  if (!scores.size) return undefined;
  const r = rating - TIME_PRESSURE(tc);
  // How far from the best move a player of this rating wanders: 6% of winning chance at 1400, halving every 600 points.
  const tau = 0.06 * 2 ** ((1400 - r) / 600);
  const scored = moves.filter((_, i) => scores.has(ucis[i])).map((m) => ({ item: m, base: 1, wc: winChance(scores.get(maiaUci(pos, m))!) }));
  return pickWeighted(scored, tau, maxDrop(r), random() < slipChance(r), random);
}

/** The FIDE bot's engine: Maia-3 when it is downloaded, otherwise Stockfish. */
export function humanMove(tc?: TimeControl): EngineMove {
  return async (pos, rating, opponent, limitMs) => {
    // Waiting for Maia to load from the browser's storage costs the clock too, and on a
    // slow device, when Maia alone takes most of the time there is, Stockfish picks instead.
    const started = Date.now();
    const tooSlow = limitMs !== undefined && maia.speedMs > limitMs * 0.6;
    if (!tooSlow && (await maia.whenReady(limitMs === undefined ? 5000 : Math.min(5000, limitMs / 3)))) {
      try {
        const pick = await maiaPick(pos, rating, opponent, tc, Math.random, limitMs === undefined ? undefined : limitMs - (Date.now() - started));
        if (pick) return pick;
      } catch (e) {
        console.warn('Maia:', e);
      }
    }
    const rest = limitMs === undefined ? undefined : limitMs - (Date.now() - started);
    const move = (await stockfishPick(pos, rating, tc, Math.random, rest).catch(() => undefined)) ?? (await engineMove(pos, rating));
    return move ? { move, engine: 'stockfish' } : undefined;
  };
}

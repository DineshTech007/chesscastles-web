import type { Color } from 'chessops/types';
import { positionFromFen } from '$lib/chess/position';
import { whiteChances, type EngineInfo } from '$lib/engine/stockfish';
import { phaseOf } from '$lib/insights/analysis';
import type { GameReview, MoveReview } from '$lib/coach/review';
import type { MoveClass } from './badges';

/**
 * The game report's numbers, from a finished review: how each side played in
 * each part of the game and kind of position, the evaluation along the game,
 * and its turning points. Accuracy is the review's own measure (from the
 * winning chance each move gave away).
 */
export type Area = 'opening' | 'middlegame' | 'endgame' | 'tactics' | 'strategy';
export const AREAS: { id: Area; label: string; hint: string }[] = [
  { id: 'opening', label: 'Opening', hint: 'The first moves, until the pieces are out' },
  { id: 'middlegame', label: 'Middlegame', hint: 'With most pieces still on the board' },
  { id: 'endgame', label: 'Endgame', hint: 'Few pieces left' },
  { id: 'tactics', label: 'Sharp moments', hint: 'Tactics: positions where one move mattered much more than the rest' },
  { id: 'strategy', label: 'Calm moves', hint: 'Strategy: positions with several fair moves, where plans decide' },
];

/** The accuracy of one move from the winning chance it gave away (0..1), as in the review. */
export const moveAccuracy = (drop: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop * 100) - 3.1669));

/** A sharp position: the best move keeps 10%+ more winning chance than the second best. */
function sharp(m: MoveReview): boolean {
  const b = m.before;
  if (!b.second) return false;
  const mine = (x: EngineInfo) => (m.color === 'white' ? whiteChances(x) : 1 - whiteChances(x));
  return mine(b) - mine(b.second) >= 0.1;
}

export interface AreaScore {
  accuracy: number;
  moves: number;
}

export function areasOf(review: GameReview, side: Color): Partial<Record<Area, AreaScore>> {
  const sums: Record<Area, { s: number; n: number }> = { opening: { s: 0, n: 0 }, middlegame: { s: 0, n: 0 }, endgame: { s: 0, n: 0 }, tactics: { s: 0, n: 0 }, strategy: { s: 0, n: 0 } };
  for (const m of review.all) {
    if (m.color !== side) continue;
    const a = moveAccuracy(m.drop);
    const phase = m.cls === 'book' ? 'opening' : phaseOf(positionFromFen(m.fenBefore));
    sums[phase].s += a;
    sums[phase].n++;
    if (m.cls === 'book') continue;
    const kind = sharp(m) ? 'tactics' : 'strategy';
    sums[kind].s += a;
    sums[kind].n++;
  }
  const out: Partial<Record<Area, AreaScore>> = {};
  for (const [k, v] of Object.entries(sums) as [Area, { s: number; n: number }][]) if (v.n >= 2) out[k] = { accuracy: Math.round(v.s / v.n), moves: v.n };
  return out;
}

/** The mark an accuracy earns, shown with the review's badges. */
export const markOf = (accuracy: number): MoveClass => (accuracy >= 90 ? 'best' : accuracy >= 80 ? 'excellent' : accuracy >= 65 ? 'good' : accuracy >= 50 ? 'inaccuracy' : 'mistake');

/** White's winning chances after each move (ply = moves played), for the graph; the start is 0.5. */
export function curve(review: GameReview): { ply: number; w: number; move?: MoveReview }[] {
  return [{ ply: 0, w: 0.5 }, ...review.all.map((m) => ({ ply: m.ply + 1, w: whiteChances(m.after), move: m }))];
}

/** The moves where the game turned most: the biggest losses of winning chance, a few per side. */
export function turningPoints(review: GameReview, n = 3): MoveReview[] {
  return review.all
    .filter((m) => m.cls === 'blunder' || m.cls === 'miss' || m.cls === 'mistake' || m.drop >= 0.15)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, n);
}

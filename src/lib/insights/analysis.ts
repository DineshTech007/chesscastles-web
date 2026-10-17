import type { Chess } from 'chessops/chess';
import { attacks, between, ray } from 'chessops/attacks';
import type { Color, NormalMove, Role, Square } from 'chessops/types';
import { makeUci, parseUci, squareFile, squareRank } from 'chessops/util';
import { makeSan } from 'chessops/san';
import { fenOf, positionFromFen, START_FEN } from '$lib/chess/position';
import { engine, type EngineInfo } from '$lib/engine/stockfish';
import type { ImportedGame } from './games';

/**
 * Guru's analysis of a player's games, move by move (a port of the app's
 * lib/insights/move_analysis.dart): the engine scores every position, and
 * each move gets its cost, its phase, the situation, and for mistakes the
 * tactic that was missed or allowed.
 */

export const CONFIG = {
  depth: 10,
  inaccuracy: 0.05,
  mistake: 0.1,
  blunder: 0.15,
  winningCp: 150,
  conversionCp: 200,
  lowClockShare: 0.1,
  slowOpeningShare: 0.08,
  minGamesForOpening: 3,
  minMovesForPhase: 40,
  minThemeCount: 2,
  minWinningGames: 3,
};

/** Mates are stored as ±(MATE − moves), so they sort above any real score. */
export const MATE = 20000;
export const isMate = (cp: number) => Math.abs(cp) >= MATE - 1000;

/** Expected score for the mover, 0..1 (the Lichess curve). */
export function expectedScore(cpForMover: number): number {
  if (isMate(cpForMover)) return cpForMover > 0 ? 1 : 0;
  const c = Math.max(-1000, Math.min(1000, cpForMover));
  return 1 / (1 + Math.exp(-0.00368208 * c));
}

export type MoveClass = 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export const classify = (drop: number): MoveClass => (drop >= CONFIG.blunder ? 'blunder' : drop >= CONFIG.mistake ? 'mistake' : drop >= CONFIG.inaccuracy ? 'inaccuracy' : 'good');
const capCp = (v: number) => (isMate(v) ? (v > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, v)));
export const centipawnLoss = (before: number, after: number) => Math.max(0, capCp(before) - capCp(after));

export type Phase = 'opening' | 'middlegame' | 'endgame';
/** Opening: the first 12 moves while most pieces are on. Endgame: at most six pieces (not pawns or kings). */
export function phaseOf(pos: Chess): Phase {
  const b = pos.board;
  const pieces = b.occupied.diff(b.pawn).diff(b.king).size();
  if (pieces <= 6) return 'endgame';
  if (pos.fullmoves <= 12 && pieces > 10) return 'opening';
  return 'middlegame';
}

export type Situation = 'winning' | 'equal' | 'losing';
const situationOf = (cp: number): Situation => (cp >= CONFIG.winningCp ? 'winning' : cp <= -CONFIG.winningCp ? 'losing' : 'equal');

/** Tactics recognised reliably; anything else is "other" (better no label than a guessed one). */
export type Tactic = 'mate' | 'backRank' | 'fork' | 'pin' | 'skewer' | 'hanging' | 'other';
export const TACTICS: Record<Tactic, { label: string; theme: string }> = {
  mate: { label: 'Missed or allowed mate', theme: 'mateIn2' },
  backRank: { label: 'Back-rank mate', theme: 'backRankMate' },
  fork: { label: 'Fork', theme: 'fork' },
  pin: { label: 'Pin', theme: 'pin' },
  skewer: { label: 'Skewer', theme: 'skewer' },
  hanging: { label: 'Hanging piece', theme: 'hangingPiece' },
  other: { label: 'Other', theme: 'middlegame' },
};

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
const valueAt = (pos: Chess, s: Square) => {
  const p = pos.board.get(s);
  return p ? VALUE[p.role] : 0;
};
const other = (c: Color): Color => (c === 'white' ? 'black' : 'white');
const attackedBy = (pos: Chess, s: Square, by: Color) => pos.kingAttackers(s, by, pos.board.occupied).nonEmpty();

/** What tactic `move` carries out from `before` (by the side to move). */
export function detectTactic(before: Chess, move: NormalMove, leadsToMate = false): Tactic {
  if (!before.isLegal(move)) return 'other';
  const me = before.turn;
  const them = other(me);
  const after = before.clone();
  after.play(move);
  const b = after.board;
  if (after.isCheckmate() || leadsToMate) {
    const king = b.kingOf(them);
    if (king !== undefined && after.isCheckmate()) {
      const backRank = them === 'white' ? 0 : 7;
      const wall = them === 'white' ? 1 : 6;
      if (squareRank(king) === backRank && squareRank(move.to) === backRank) {
        let blocked = true;
        for (const df of [-1, 0, 1]) {
          const f = squareFile(king) + df;
          if (f < 0 || f > 7) continue;
          const p = b.get(wall * 8 + f);
          if (!p || p.color !== them) blocked = false;
        }
        if (blocked) return 'backRank';
      }
    }
    return 'mate';
  }
  // Taking a piece nobody was defending.
  const captured = before.board.get(move.to);
  if (captured && captured.role !== 'pawn' && !attackedBy(before, move.to, them)) return 'hanging';
  const mover = b.get(move.to);
  if (!mover) return 'other';
  const moverValue = VALUE[mover.role];
  const occupied = b.occupied;
  // Fork: the moved piece hits two targets worth hitting.
  const hits = attacks(mover, move.to, occupied).intersect(b[them]);
  let targets = 0;
  for (const s of hits) {
    const v = valueAt(after, s);
    const defended = attackedBy(after, s, them);
    if (v >= 3 && (v > moverValue || !defended || b.get(s)?.role === 'king')) targets++;
  }
  if (targets >= 2) return 'fork';
  // Pin or skewer: a line piece hits a piece with a bigger (pin) or smaller (skewer) one behind it.
  if (mover.role === 'bishop' || mover.role === 'rook' || mover.role === 'queen') {
    for (const first of hits) {
      const behind = ray(move.to, first).diff(between(move.to, first)).intersect(b[them]);
      for (const second of behind) {
        if (second === first) continue;
        if (between(first, second).intersect(occupied).nonEmpty()) continue;
        if (!between(move.to, second).has(first)) continue;
        const df = Math.abs(squareFile(move.to) - squareFile(second));
        const dr = Math.abs(squareRank(move.to) - squareRank(second));
        const straight = df === 0 || dr === 0;
        const diagonal = df === dr;
        if (mover.role === 'rook' ? !straight : mover.role === 'bishop' ? !diagonal : !(straight || diagonal)) continue;
        const front = valueAt(after, first);
        const back = valueAt(after, second);
        if (back > front && back >= 3) return 'pin';
        if (front > back && front >= 5 && back >= 3) return 'skewer';
      }
    }
  }
  return 'other';
}

/** One move of one game, analysed. */
export interface MoveFacts {
  ply: number;
  uci: string;
  san: string;
  /** Played by our player. */
  user: boolean;
  /** White's view; mates as ±(MATE − n). */
  cpBefore: number;
  cpAfter: number;
  cpl: number;
  /** Expected score lost, 0..1. */
  drop: number;
  cls: MoveClass;
  phase: Phase;
  situation: Situation;
  bestUci?: string;
  bestSan?: string;
  tactic?: Tactic;
  tacticMissed?: boolean;
  clockMs?: number | null;
  spentMs?: number;
  /** The position before the move. */
  fen: string;
}

export const isError = (m: MoveFacts) => m.cls === 'mistake' || m.cls === 'blunder';
export const moveLabel = (m: MoveFacts) => `${Math.floor(m.ply / 2) + 1}${m.ply % 2 === 0 ? '.' : '...'} ${m.san}`;

export interface AnalyzedGame {
  game: ImportedGame;
  moves: MoveFacts[];
}

/** White's view in centipawns (mates as ±(MATE − n)). */
const whiteCp = (i: EngineInfo) => {
  if (i.mate !== undefined) return i.mate > 0 ? MATE - i.mate : -MATE - i.mate;
  return i.cp ?? 0;
};

/** Turns engine scores for every position into per-move facts (scores has one more entry than the moves). */
export function describeGame(g: ImportedGame, scores: number[], best: (string | undefined)[]): MoveFacts[] {
  const out: MoveFacts[] = [];
  const pos = positionFromFen(START_FEN);
  const lastClock: Record<Color, number> = { white: g.baseSeconds * 1000, black: g.baseSeconds * 1000 };
  for (let i = 0; i < g.uci.length && i + 1 < scores.length; i++) {
    const move = parseUci(g.uci[i]) as NormalMove | undefined;
    if (!move || !pos.isLegal(move)) break;
    const side = pos.turn;
    const sign = side === 'white' ? 1 : -1;
    const before = scores[i] * sign;
    const after = scores[i + 1] * sign;
    const drop = Math.max(0, expectedScore(before) - expectedScore(after));
    const cls = classify(drop);
    let bestMove: NormalMove | undefined;
    const bu = best[i] ? (parseUci(best[i]!) as NormalMove | undefined) : undefined;
    if (bu && pos.isLegal(bu)) bestMove = bu;
    const fen = fenOf(pos);
    const next = pos.clone();
    next.play(move);
    let tactic: Tactic | undefined;
    let missed = false;
    if (cls === 'mistake' || cls === 'blunder') {
      // First: did the move walk into something (the engine's reply)?
      const r = best[i + 1] ? (parseUci(best[i + 1]!) as NormalMove | undefined) : undefined;
      if (r && !next.isEnd()) tactic = detectTactic(next, r, isMate(after) && after < 0);
      // Else: was there something to find?
      if ((!tactic || tactic === 'other') && bestMove) {
        const t = detectTactic(pos, bestMove, isMate(before) && before > 0);
        if (t !== 'other') {
          tactic = t;
          missed = true;
        }
      }
      tactic ??= 'other';
    }
    const clock = g.clocks[i] ?? null;
    let spent: number | undefined;
    if (clock !== null) {
      spent = Math.max(0, lastClock[side] - clock + g.increment * 1000);
      lastClock[side] = clock;
    }
    out.push({
      ply: i,
      uci: g.uci[i],
      san: g.san[i] ?? g.uci[i],
      user: side === g.userColor,
      cpBefore: scores[i],
      cpAfter: scores[i + 1],
      cpl: centipawnLoss(before, after),
      drop,
      cls,
      phase: phaseOf(pos),
      situation: situationOf(before),
      bestUci: bestMove ? makeUci(bestMove) : undefined,
      bestSan: bestMove ? makeSan(pos, bestMove) : undefined,
      tactic,
      tacticMissed: missed,
      clockMs: clock,
      spentMs: spent,
      fen,
    });
    pos.play(move);
  }
  return out;
}

/** Scores a game with the engine (every position, `depth`) and describes its moves. */
export async function analyzeGame(g: ImportedGame, depth = CONFIG.depth, stopped: () => boolean = () => false): Promise<AnalyzedGame> {
  const pos = positionFromFen(START_FEN);
  const scores: number[] = [];
  const best: (string | undefined)[] = [];
  const positions = [fenOf(pos)];
  for (const u of g.uci) {
    const m = parseUci(u) as NormalMove;
    if (!m || !pos.isLegal(m)) break;
    pos.play(m);
    positions.push(fenOf(pos));
  }
  for (let i = 0; i < positions.length; i++) {
    if (stopped()) throw new Error('stopped');
    const p = positionFromFen(positions[i]);
    if (p.isCheckmate()) {
      scores.push(p.turn === 'white' ? -MATE : MATE);
      best.push(undefined);
      continue;
    }
    if (p.isEnd()) {
      scores.push(0);
      best.push(undefined);
      continue;
    }
    const info = await engine.evaluate(positions[i], depth);
    scores.push(info ? whiteCp(info) : 0);
    best.push(info?.pv[0]);
  }
  return { game: g, moves: describeGame(g, scores, best) };
}

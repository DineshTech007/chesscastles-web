import { CONFIG, isError, type AnalyzedGame, type MoveFacts, type Phase, type Tactic, TACTICS } from './analysis';
import { openingFamily, userRating, userScore, type ImportedGame } from './games';

/**
 * Guru's report on a player's analysed games (a port of the app's
 * lib/insights/weakness.dart): phases, openings, tactics, time trouble,
 * converting won positions, and the weaknesses ranked by what they cost.
 */

export interface MoveRef {
  game: ImportedGame;
  move: MoveFacts;
}

export interface PhaseStat {
  phase: Phase;
  moves: number;
  acpl: number;
  errors: number;
  lost: number;
}

export interface OpeningStat {
  color: 'white' | 'black';
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  slips: MoveRef[];
  typicalSlipMove?: number;
  repeatedSlip?: MoveRef;
  repeatedCount: number;
  score: number;
}

export interface TacticStat {
  tactic: Tactic;
  allowed: number;
  missed: number;
  lost: number;
  examples: MoveRef[];
}

export type WeaknessKind = 'tactic' | 'opening' | 'endgame' | 'openingPhase' | 'timeTrouble' | 'slowOpening' | 'conversion';

export interface Weakness {
  kind: WeaknessKind;
  title: string;
  /** Plain words with the sample size. */
  evidence: string;
  /** Expected points lost per game: what ranks the findings. */
  impact: number;
  examples: MoveRef[];
  tactic?: Tactic;
  opening?: OpeningStat;
}

export interface Report {
  games: number;
  moves: number;
  score: number;
  acpl: number;
  accuracy: number;
  blundersPerGame: number;
  mistakesPerGame: number;
  phases: PhaseStat[];
  openings: OpeningStat[];
  tactics: TacticStat[];
  time: { errors: number; lowClockErrors: number; slowOpeningMoves: number; timedGames: number };
  conversion: { winningGames: number; won: number; drawn: number; lost: number; examples: MoveRef[] };
  byColor: { color: 'white' | 'black'; games: number; score: number; acpl: number }[];
  weaknesses: Weakness[];
  /** Strong points, for encouragement. */
  strengths: string[];
  averageRating?: number;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const accuracyOf = (drop: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop * 100) - 3.1669));

export function buildReport(all: AnalyzedGame[]): Report {
  const games = all.filter((g) => g.moves.length);
  const n = games.length;
  const userMoves: MoveRef[] = games.flatMap((g) => g.moves.filter((m) => m.user).map((move) => ({ game: g.game, move })));
  const score = avg(games.map((g) => userScore(g.game)));
  const acpl = avg(userMoves.map((r) => r.move.cpl));
  const blunders = userMoves.filter((r) => r.move.cls === 'blunder').length;
  const mistakes = userMoves.filter((r) => r.move.cls === 'mistake').length;
  const ratings = games.map((g) => userRating(g.game)).filter((r): r is number => typeof r === 'number');

  const phases: PhaseStat[] = (['opening', 'middlegame', 'endgame'] as Phase[]).map((phase) => {
    const ms = userMoves.filter((r) => r.move.phase === phase);
    return { phase, moves: ms.length, acpl: avg(ms.map((r) => r.move.cpl)), errors: ms.filter((r) => isError(r.move)).length, lost: ms.reduce((s, r) => s + r.move.drop, 0) };
  });

  // Openings, by colour and family.
  const groups = new Map<string, AnalyzedGame[]>();
  for (const g of games) {
    const key = `${g.game.userColor}|${openingFamily(g.game.opening ?? 'Unknown')}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const openings: OpeningStat[] = [];
  for (const [key, gs] of groups) {
    const [color, name] = key.split('|') as ['white' | 'black', string];
    const slips: MoveRef[] = [];
    for (const g of gs) {
      const first = g.moves.find((m) => m.user && m.phase === 'opening' && m.cls !== 'good');
      if (first) slips.push({ game: g.game, move: first });
    }
    const byLine = new Map<string, MoveRef[]>();
    for (const s of slips) {
      const key2 = `${s.game.uci.slice(0, s.move.ply).join(' ')}|${s.move.uci}`;
      byLine.set(key2, [...(byLine.get(key2) ?? []), s]);
    }
    const repeated = [...byLine.values()].filter((l) => l.length >= 2).sort((a, b) => b.length - a.length);
    const moveNos = slips.map((s) => Math.floor(s.move.ply / 2) + 1).sort((a, b) => a - b);
    const wins = gs.filter((g) => userScore(g.game) === 1).length;
    const draws = gs.filter((g) => userScore(g.game) === 0.5).length;
    openings.push({
      color,
      name,
      games: gs.length,
      wins,
      draws,
      losses: gs.length - wins - draws,
      slips,
      typicalSlipMove: moveNos.length ? moveNos[Math.floor(moveNos.length / 2)] : undefined,
      repeatedSlip: repeated[0]?.[0],
      repeatedCount: repeated[0]?.length ?? 0,
      score: (wins + draws / 2) / gs.length,
    });
  }
  openings.sort((a, b) => b.games - a.games);

  // Tactics.
  const tactics: TacticStat[] = [];
  for (const t of Object.keys(TACTICS) as Tactic[]) {
    const ms = userMoves.filter((r) => isError(r.move) && r.move.tactic === t).sort((a, b) => b.move.drop - a.move.drop);
    if (!ms.length) continue;
    tactics.push({ tactic: t, allowed: ms.filter((r) => !r.move.tacticMissed).length, missed: ms.filter((r) => r.move.tacticMissed).length, lost: ms.reduce((s, r) => s + r.move.drop, 0), examples: ms.slice(0, 5) });
  }
  tactics.sort((a, b) => b.lost - a.lost);

  // Time.
  const timed = games.filter((g) => g.game.baseSeconds > 0 && g.game.clocks.some((c) => c !== null));
  const timedMoves = timed.flatMap((g) => g.moves.filter((m) => m.user).map((move) => ({ game: g.game, move })));
  const lowClock = (r: MoveRef) => r.move.clockMs != null && r.move.clockMs < r.game.baseSeconds * 1000 * CONFIG.lowClockShare;
  const errors = timedMoves.filter((r) => isError(r.move));
  const lowErrors = errors.filter(lowClock).sort((a, b) => b.move.drop - a.move.drop);
  const openingMoves = timedMoves.filter((r) => r.move.phase === 'opening');
  const slow = openingMoves.filter((r) => (r.move.spentMs ?? 0) > r.game.baseSeconds * 1000 * CONFIG.slowOpeningShare).sort((a, b) => (b.move.spentMs ?? 0) - (a.move.spentMs ?? 0));
  const time = { errors: errors.length, lowClockErrors: lowErrors.length, slowOpeningMoves: slow.length, timedGames: timed.length };

  // Conversion: ahead by 2 pawns and didn't win.
  let winning = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  const convExamples: MoveRef[] = [];
  for (const g of games) {
    const sign = g.game.userColor === 'white' ? 1 : -1;
    if (!g.moves.some((m) => m.user && m.cpBefore * sign >= CONFIG.conversionCp)) continue;
    winning++;
    const s = userScore(g.game);
    if (s === 1) won++;
    else if (s === 0.5) drawn++;
    else lost++;
    if (s < 1) {
      const worst = g.moves.filter((m) => m.user && m.cpBefore * sign >= CONFIG.winningCp).sort((a, b) => b.drop - a.drop)[0];
      if (worst) convExamples.push({ game: g.game, move: worst });
    }
  }
  convExamples.sort((a, b) => b.move.drop - a.move.drop);
  const conversion = { winningGames: winning, won, drawn, lost, examples: convExamples.slice(0, 5) };

  const byColor = (['white', 'black'] as const).map((color) => {
    const gs = games.filter((g) => g.game.userColor === color);
    return { color, games: gs.length, score: avg(gs.map((g) => userScore(g.game))), acpl: avg(gs.flatMap((g) => g.moves.filter((m) => m.user).map((m) => m.cpl))) };
  });

  // The findings, ranked by what they cost.
  const found: Weakness[] = [];
  if (n) {
    for (const t of tactics) {
      if (t.tactic === 'other' || t.allowed + t.missed < CONFIG.minThemeCount) continue;
      const parts = [t.allowed ? `${t.allowed} allowed` : '', t.missed ? `${t.missed} missed` : ''].filter(Boolean).join(', ');
      found.push({
        kind: 'tactic',
        tactic: t.tactic,
        title: t.tactic === 'mate' ? 'Checkmates missed or allowed' : t.tactic === 'backRank' ? 'Back-rank danger' : t.tactic === 'hanging' ? 'Hanging pieces' : `${TACTICS[t.tactic].label}s`,
        evidence: `${plural(t.allowed + t.missed, 'costly move')} in ${plural(n, 'game')} involved ${TACTICS[t.tactic].label.toLowerCase()} tactics (${parts}).`,
        impact: t.lost / n,
        examples: t.examples.slice(0, 3),
      });
    }
    for (const o of openings) {
      if (o.games < CONFIG.minGamesForOpening || o.score >= 0.45) continue;
      const where = o.repeatedSlip
        ? ` You went wrong in the same position ${o.repeatedCount} times, at move ${Math.floor(o.repeatedSlip.move.ply / 2) + 1}.`
        : o.typicalSlipMove
          ? ` Your first slip usually comes around move ${o.typicalSlipMove}.`
          : '';
      found.push({
        kind: 'opening',
        opening: o,
        title: `${o.name} as ${o.color === 'white' ? 'White' : 'Black'}`,
        evidence: `You scored ${pct(o.score)} in ${plural(o.games, 'game')} (${o.wins}W ${o.draws}D ${o.losses}L).${where}`,
        impact: ((0.5 - o.score) * o.games) / n + 0.01,
        examples: [o.repeatedSlip, ...o.slips.filter((s) => s !== o.repeatedSlip).slice(0, 2)].filter((x): x is MoveRef => !!x),
      });
    }
    const end = phases[2];
    if (end.moves >= CONFIG.minMovesForPhase && end.acpl > acpl * 1.15) {
      found.push({
        kind: 'endgame',
        title: 'Endgames',
        evidence: `You lose ${Math.round(end.acpl)} centipawns a move in endgames, against ${Math.round(acpl)} overall (${end.moves} endgame moves, ${plural(end.errors, 'mistake')}).`,
        impact: (end.lost / n) * 0.8,
        examples: userMoves.filter((r) => r.move.phase === 'endgame' && isError(r.move)).sort((a, b) => b.move.drop - a.move.drop).slice(0, 3),
      });
    }
    const open = phases[0];
    if (open.moves >= CONFIG.minMovesForPhase && open.acpl > acpl * 1.15 && open.errors >= 3) {
      found.push({
        kind: 'openingPhase',
        title: 'The first moves',
        evidence: `Your opening moves lose ${Math.round(open.acpl)} centipawns each, against ${Math.round(acpl)} overall (${open.moves} opening moves, ${plural(open.errors, 'mistake')}).`,
        impact: (open.lost / n) * 0.8,
        examples: userMoves.filter((r) => r.move.phase === 'opening' && isError(r.move)).sort((a, b) => b.move.drop - a.move.drop).slice(0, 3),
      });
    }
    if (time.lowClockErrors >= 3 && time.errors > 0) {
      found.push({
        kind: 'timeTrouble',
        title: 'Mistakes in time trouble',
        evidence: `${time.lowClockErrors} of your ${time.errors} mistakes came with less than ${pct(CONFIG.lowClockShare)} of your time left (${plural(time.timedGames, 'timed game')}).`,
        impact: lowErrors.reduce((s, r) => s + r.move.drop, 0) / n,
        examples: lowErrors.slice(0, 3),
      });
    }
    if (time.slowOpeningMoves >= 3) {
      found.push({
        kind: 'slowOpening',
        title: 'Long thinks in the opening',
        evidence: `${time.slowOpeningMoves} opening moves each took more than ${pct(CONFIG.slowOpeningShare)} of your starting clock.`,
        impact: (time.slowOpeningMoves / n) * 0.02 + (time.lowClockErrors > 0 ? 0.01 : 0),
        examples: slow.slice(0, 3),
      });
    }
    if (winning >= CONFIG.minWinningGames && drawn + lost >= 2) {
      found.push({
        kind: 'conversion',
        title: 'Winning won positions',
        evidence: `You were ahead by 2 pawns or more in ${plural(winning, 'game')} but won only ${won} (${drawn} drawn, ${lost} lost).`,
        impact: (drawn * 0.5 + lost) / n,
        examples: convExamples.slice(0, 3),
      });
    }
  }
  found.sort((a, b) => b.impact - a.impact);

  // Strengths: the best phase, a strong opening, good conversion.
  const strengths: string[] = [];
  const bestPhase = phases.filter((p) => p.moves >= 20).sort((a, b) => a.acpl - b.acpl)[0];
  if (bestPhase && bestPhase.acpl < acpl * 0.9) strengths.push(`Your ${bestPhase.phase} is your strongest phase (${Math.round(bestPhase.acpl)} centipawns lost a move).`);
  const bestOpening = openings.filter((o) => o.games >= 3).sort((a, b) => b.score - a.score)[0];
  if (bestOpening && bestOpening.score >= 0.6) strengths.push(`You score ${pct(bestOpening.score)} with the ${bestOpening.name} as ${bestOpening.color === 'white' ? 'White' : 'Black'}.`);
  if (winning >= 3 && won / winning >= 0.85) strengths.push(`You convert won positions well: ${won} of ${winning} won.`);

  return {
    games: n,
    moves: userMoves.length,
    score,
    acpl,
    accuracy: Math.round(avg(userMoves.map((r) => accuracyOf(r.move.drop)))),
    blundersPerGame: n ? blunders / n : 0,
    mistakesPerGame: n ? mistakes / n : 0,
    phases,
    openings,
    tactics,
    time,
    conversion,
    byColor,
    weaknesses: found.slice(0, 5),
    strengths,
    averageRating: ratings.length ? Math.round(avg(ratings)) : undefined,
  };
}

/** Positions from the player's own games worth solving again: mistakes and missed chances while the game was still alive. */
export function mistakesToTrain(games: AnalyzedGame[], tactic?: Tactic): MoveRef[] {
  const out: MoveRef[] = [];
  for (const g of games) {
    const sign = g.game.userColor === 'white' ? 1 : -1;
    for (const m of g.moves) {
      if (!m.user || !isError(m) || !m.bestUci) continue;
      if (m.cpBefore * sign < -300) continue;
      if (tactic && m.tactic !== tactic) continue;
      out.push({ game: g.game, move: m });
    }
  }
  return out.sort((a, b) => b.move.drop - a.move.drop);
}

/** One game at a glance: the player's accuracy and how many errors they made. */
export function gameSummary(g: AnalyzedGame) {
  const mine = g.moves.filter((m) => m.user);
  const n = (c: string) => mine.filter((m) => m.cls === c).length;
  return {
    accuracy: mine.length ? Math.round(mine.reduce((s, m) => s + accuracyOf(m.drop), 0) / mine.length) : 0,
    blunders: n('blunder'),
    mistakes: n('mistake'),
    inaccuracies: n('inaccuracy'),
  };
}

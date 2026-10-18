import { polyglotKey } from '$lib/chess/polyglot';
import { playSans, positionFromFen, START_FEN, uciToMove } from '$lib/chess/position';
import type { AnalyzedGame } from '$lib/insights/analysis';
import { isError } from '$lib/insights/analysis';
import { userScore, type ImportedGame } from '$lib/insights/games';
import { STUDY_OPENINGS, type StudyOpening } from './openingStudy';

/**
 * Finds the opening study's openings and lines in a player's own games (the
 * chess.com or Lichess games imported for Insights): by position, so move
 * orders and transpositions count, and only when the player had the
 * opening's side (the Caro-Kann as Black). A line where the player keeps
 * losing becomes a study task: its model games, puzzles and trainer.
 */
const PLIES = 30;

interface Target {
  opening: StudyOpening;
  root: string;
  /** Deepest first. */
  lines: { id: string; key: string; depth: number }[];
}
let targets: Target[] | undefined;
function allTargets(): Target[] {
  targets ??= STUDY_OPENINGS.map((o) => ({
    opening: o,
    root: polyglotKey(playSans(o.root)).toString(16),
    lines: o.lines
      .map((l) => ({ id: l.id, key: polyglotKey(playSans(l.sans)).toString(16), depth: l.sans.split(' ').length }))
      .sort((a, b) => b.depth - a.depth),
  }));
  return targets;
}

/** The study opening and line a game reached (with the player on the opening's side), if any. */
export function studyLineOf(uci: string[], userColor: 'white' | 'black'): { opening: string; line: string; at: number } | undefined {
  const mine = allTargets().filter((t) => t.opening.side === userColor);
  if (!mine.length) return undefined;
  const pos = positionFromFen(START_FEN);
  // Position key -> the ply count when the game first reached it.
  const seen = new Map<string, number>();
  for (const [i, u] of uci.slice(0, PLIES).entries()) {
    const m = uciToMove(u);
    if (!m || !pos.isLegal(m)) break;
    pos.play(m);
    const k = polyglotKey(pos).toString(16);
    if (!seen.has(k)) seen.set(k, i + 1);
  }
  for (const t of mine) {
    if (!seen.has(t.root) && !t.lines.some((l) => seen.has(l.key))) continue;
    const hit = t.lines.find((l) => seen.has(l.key));
    return { opening: t.opening.id, line: hit?.id ?? 'other', at: seen.get(hit ? hit.key : t.root)! };
  }
  return undefined;
}

export interface StudyLineStat {
  opening: string;
  line: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  /** The move where the player's first mistake usually came (analysed games only). */
  firstSlip?: number;
  /** The moves that most often followed the line in the player's games, and in how many. */
  usual?: { sans: string; games: number };
}

/** The player's results in each study line they reached, the weakest first. */
export function studyStats(games: (ImportedGame | AnalyzedGame)[]): StudyLineStat[] {
  const by = new Map<string, StudyLineStat & { slips: number[]; paths: Map<string, number> }>();
  for (const x of games) {
    const g = 'game' in x ? x.game : x;
    const hit = studyLineOf(g.uci, g.userColor);
    if (!hit) continue;
    const k = `${hit.opening}|${hit.line}`;
    const { at, ...where } = hit;
    const s = by.get(k) ?? { ...where, games: 0, wins: 0, draws: 0, losses: 0, score: 0, slips: [] as number[], paths: new Map<string, number>() };
    // What came next in this game (four moves after the line), written with move numbers.
    const next = g.san.slice(at, at + 4);
    if (next.length) {
      const text = next.map((san, i) => ((at + i) % 2 === 0 ? `${(at + i) / 2 + 1}.${san}` : i === 0 ? `${Math.floor((at + i) / 2) + 1}...${san}` : san)).join(' ');
      s.paths.set(text, (s.paths.get(text) ?? 0) + 1);
    }
    const sc = userScore(g);
    s.games++;
    if (sc === 1) s.wins++;
    else if (sc === 0) s.losses++;
    else s.draws++;
    if ('moves' in x) {
      const slip = x.moves.find((m) => m.user && isError(m));
      if (slip) s.slips.push(Math.floor(slip.ply / 2) + 1);
    }
    by.set(k, s);
  }
  return [...by.values()]
    .map(({ slips, paths, ...s }) => ({
      ...s,
      ...(paths.size ? { usual: [...paths.entries()].sort((a, b) => b[1] - a[1]).map(([sans, games]) => ({ sans, games }))[0] } : {}),
      score: (s.wins + s.draws / 2) / s.games,
      ...(slips.length ? { firstSlip: Math.round(slips.reduce((a, b) => a + b, 0) / slips.length) } : {}),
    }))
    .sort((a, b) => a.score - b.score || b.games - a.games);
}

/** "Keeps losing here": at least two losses and under 40% in at least three games. */
export const isWeak = (s: StudyLineStat) => s.games >= 3 && s.losses >= 2 && s.score < 0.4;

export const studyHref = (opening: string, line: string, tab?: 'plans' | 'games' | 'puzzles' | 'trainer' | 'play') =>
  `/learn/study/${opening}?line=${line}${tab ? `&tab=${tab}` : ''}`;

/** "Caro-Kann Defence, Advance Variation". */
export function studyLineName(s: Pick<StudyLineStat, 'opening' | 'line'>): string {
  const o = STUDY_OPENINGS.find((x) => x.id === s.opening);
  const l = o?.lines.find((x) => x.id === s.line);
  return o ? `${o.name}, ${l ? l.name : 'other lines'}` : s.opening;
}

/** "4 losses in 5 games (20%)". */
export const resultText = (s: StudyLineStat) =>
  `${s.wins} ${s.wins === 1 ? 'win' : 'wins'}, ${s.draws} ${s.draws === 1 ? 'draw' : 'draws'}, ${s.losses} ${s.losses === 1 ? 'loss' : 'losses'} in ${s.games} ${s.games === 1 ? 'game' : 'games'} (${Math.round(s.score * 100)}%)`;

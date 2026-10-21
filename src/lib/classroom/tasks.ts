/** Questions for a class: from the board's position, or a set from the puzzle bank (static/data/puzzles). */
import { makeFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { positionFromFen } from '$lib/chess/position';
import type { Item, Progress } from './api';

/** The themes a coach can pick a set from (files in static/data/puzzles). */
export const THEMES: { id: string; label: string }[] = [
  { id: 'mateIn1', label: 'Mate in 1' },
  { id: 'mateIn2', label: 'Mate in 2' },
  { id: 'mateIn3', label: 'Mate in 3' },
  { id: 'fork', label: 'Fork' },
  { id: 'pin', label: 'Pin' },
  { id: 'skewer', label: 'Skewer' },
  { id: 'discoveredAttack', label: 'Discovered attack' },
  { id: 'doubleCheck', label: 'Double check' },
  { id: 'hangingPiece', label: 'Hanging piece' },
  { id: 'trappedPiece', label: 'Trapped piece' },
  { id: 'deflection', label: 'Deflection' },
  { id: 'attraction', label: 'Attraction' },
  { id: 'backRankMate', label: 'Back-rank mate' },
  { id: 'smotheredMate', label: 'Smothered mate' },
  { id: 'sacrifice', label: 'Sacrifice' },
  { id: 'kingsideAttack', label: 'Kingside attack' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'advancedPawn', label: 'Advanced pawn' },
  { id: 'endgame', label: 'Endgame' },
  { id: 'pawnEndgame', label: 'Pawn endgame' },
  { id: 'rookEndgame', label: 'Rook endgame' },
  { id: 'queenEndgame', label: 'Queen endgame' },
  { id: 'opening', label: 'Opening' },
  { id: 'middlegame', label: 'Middlegame' },
];

type ThemePuzzle = [id: string, fen: string, moves: string, rating: number];

/**
 * A bank puzzle as a class question: the bank's position is before the opponent's move, so that move is played first
 * and the answer is the rest (the student's move first). Undefined when it doesn't read.
 */
export function bankItem(p: ThemePuzzle, title = ''): Item | undefined {
  const [ref, fen, moves, rating] = p;
  const ucis = moves.split(' ').filter(Boolean);
  if (ucis.length < 2) return undefined;
  try {
    const pos = positionFromFen(fen);
    const first = parseUci(ucis[0]) as NormalMove | undefined;
    if (!first || !pos.isLegal(first)) return undefined;
    pos.play(first);
    return { fen: makeFen(pos.toSetup()), line: ucis.slice(1), goal: '', elo: 1500, title, ref, rating };
  } catch {
    return undefined;
  }
}

/**
 * `count` puzzles of a theme with ratings from `from` to `to`, not used before in this class (`used`), easiest first.
 * Picked at random within the range, so two sets of the same theme differ.
 */
export async function puzzleSet(theme: string, from: number, to: number, count: number, used: Set<string>, random = Math.random): Promise<Item[]> {
  const res = await fetch(`/data/puzzles/${theme}.json`);
  if (!res.ok) throw new Error('The puzzles could not be loaded. Try again.');
  const all = (await res.json()) as ThemePuzzle[];
  const pick = pickPuzzles(all, from, to, count, used, random);
  return pick.map((p) => bankItem(p)).filter((i): i is Item => !!i);
}

export function pickPuzzles<T extends ThemePuzzle>(all: T[], from: number, to: number, count: number, used: Set<string>, random = Math.random): T[] {
  let pool = all.filter((p) => p[3] >= from && p[3] <= to && !used.has(p[0]));
  // Too few in the range: the nearest ones outside it.
  if (pool.length < count) {
    const mid = (from + to) / 2;
    pool = all.filter((p) => !used.has(p[0])).sort((a, b) => Math.abs(a[3] - mid) - Math.abs(b[3] - mid)).slice(0, Math.max(count * 4, 20));
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).sort((a, b) => a[3] - b[3]);
}

/** A line of moves in SAN from a position ("1. Qxf7#", "23... Kh7 24. Re7"). */
export function sanLine(fen: string, ucis: string[]): string {
  try {
    const pos = positionFromFen(fen);
    let no = pos.fullmoves;
    const out: string[] = [];
    ucis.forEach((u, i) => {
      const m = parseUci(u) as NormalMove | undefined;
      if (!m || !pos.isLegal(m)) return;
      const san = makeSan(pos, m);
      if (pos.turn === 'white') out.push(`${no}. ${san}`);
      else out.push(i === 0 ? `${no}... ${san}` : san);
      pos.play(m);
      if (pos.turn === 'white') no++;
    });
    return out.join(' ');
  } catch {
    return '';
  }
}

/** The side to move in a position: the student's colour in a question. */
export const sideOf = (fen: string): 'white' | 'black' => (fen.split(' ')[1] === 'b' ? 'black' : 'white');

/**
 * The class's first moves on one puzzle, most played first, from every try (right or wrong): the coach sees at a
 * glance what the class thought.
 */
export function topMoves(progress: Progress[], item: number, fen: string): { san: string; uci: string; n: number; right: boolean }[] {
  const count = new Map<string, { n: number; right: boolean }>();
  const add = (u: string | undefined, right: boolean) => {
    if (!u) return;
    const c = count.get(u) ?? { n: 0, right };
    c.n++;
    c.right ||= right;
    count.set(u, c);
  };
  for (const p of progress) {
    const r = p.results[item];
    const tried = r ? r.tried : p.item === item ? p.tried : [];
    for (const t of tried ?? []) add(t[0], false);
    if (r) add(r.moves[0], r.solved);
    else if (p.item === item && p.moves[0]) add(p.moves[0], true);
  }
  return [...count]
    .map(([uci, c]) => ({ uci, n: c.n, right: c.right, san: sanLine(fen, [uci]).replace(/^\d+\.(\.\.)? /, '') }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
}

/** "1:05" from milliseconds (whole seconds, rounded up while counting down). */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
/** "32s", "1m 05s": time taken. */
export function took(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/** The board's line replayed: the position at `ply`, its last move, and every move in SAN (for the move list). */
export function lineAt(root: string, moves: string[], ply: number) {
  const sans: string[] = [];
  let at: { fen: string; last?: [string, string]; check: boolean; turn: 'white' | 'black'; pos?: ReturnType<typeof positionFromFen> } = { fen: root, check: false, turn: sideOf(root) };
  try {
    const pos = positionFromFen(root);
    if (ply === 0) at = { fen: root, check: pos.isCheck(), turn: pos.turn, pos: pos.clone() };
    moves.forEach((u, i) => {
      const m = parseUci(u) as NormalMove | undefined;
      if (!m || !pos.isLegal(m)) return;
      sans.push(makeSan(pos, m));
      pos.play(m);
      if (i + 1 === ply) at = { fen: makeFen(pos.toSetup()), last: [u.slice(0, 2), u.slice(2, 4)], check: pos.isCheck(), turn: pos.turn, pos: pos.clone() };
    });
  } catch {
    /* a position that can't be played (set up for show): no moves */
  }
  return { ...at, sans };
}

/** The board's line as PGN (from its own position when it isn't the usual start). */
export function toPgn(root: string, moves: string[], title = ''): string {
  const start = root === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const head = [`[Event "${title.replace(/"/g, "'") || 'Chess Castles class'}"]`, `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]`, ...(start ? [] : ['[SetUp "1"]', `[FEN "${root}"]`])];
  return `${head.join('\n')}\n\n${sanLine(root, moves)} *\n`;
}

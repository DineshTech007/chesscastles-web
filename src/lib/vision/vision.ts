import type { Chess } from 'chessops/chess';
import type { NormalMove, Role } from 'chessops/types';
import { makeSquare, parseUci } from 'chessops/util';
import { parseSan } from 'chessops/san';
import { makeSan } from 'chessops/san';
import { fenOf, positionFromFen } from '$lib/chess/position';

/**
 * Blindfold Gym: the chess skill of seeing the board in your head. Puzzles are
 * given as text (the pieces and the moves, no board); the board appears
 * only with the answer.
 */

/** [id, fen, moves, rating] from static/data/vision.json (Lichess puzzles, CC0). */
export type VisionPuzzle = [string, string, string, number];

const ORDER: Role[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const LETTER: Record<Role, string> = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '' };
const NAME: Record<Role, [string, string]> = {
  king: ['King', 'King'],
  queen: ['Queen', 'Queens'],
  rook: ['Rook', 'Rooks'],
  bishop: ['Bishop', 'Bishops'],
  knight: ['Knight', 'Knights'],
  pawn: ['Pawn', 'Pawns'],
};

export interface SideText {
  color: 'white' | 'black';
  /** "Kg1 Qd1 Ra1 Rf1 Nf3", then "pawns a2 b2 c2". */
  pieces: string;
  pawns: string;
  /** Grouped and spelled out: "King g1 · Rooks a1, f1 · Pawns a2, b2". */
  long: string;
}

/** Each side's pieces as text, kings first, then queens, rooks, bishops, knights, pawns. */
export function describe(pos: Chess): SideText[] {
  return (['white', 'black'] as const).map((color) => {
    const groups: string[] = [];
    const short: string[] = [];
    let pawns = '';
    for (const role of ORDER) {
      const squares = [...pos.board.pieces(color, role)].map((s) => makeSquare(s)).sort();
      if (!squares.length) continue;
      groups.push(`${NAME[role][squares.length > 1 ? 1 : 0]} ${squares.join(', ')}`);
      if (role === 'pawn') pawns = squares.join(' ');
      else short.push(...squares.map((s) => LETTER[role] + s));
    }
    return { color, pieces: short.join(' '), pawns, long: groups.join(' · ') };
  });
}

/** A typed move ("Qh7#", "qxh7", "d3h7", "0-0") as a legal move, or undefined. */
export function readMove(pos: Chess, typed: string): NormalMove | undefined {
  const t = typed.trim().replace(/0/g, 'O').replace(/[!?]+$/, '');
  if (!t) return undefined;
  const uci = /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(t) ? parseUci(t.toLowerCase()) : undefined;
  if (uci && 'from' in uci && pos.isLegal(uci)) return uci;
  // SAN, forgiving about case for the piece letter ("qh7" = "Qh7", but "bxc5" stays a pawn move).
  const tries = [t, t[0].toUpperCase() + t.slice(1)];
  for (const s of tries) {
    const m = parseSan(pos, s);
    if (m && 'from' in m) return m;
  }
  return undefined;
}

/** One blindfold puzzle in play. */
export class BlindPuzzle {
  readonly start: Chess;
  readonly moves: NormalMove[];
  /** Index in `moves` of the next move the solver must find. */
  step = 1;
  /** The solver's moves (UCI), for the server's check. */
  readonly played: string[] = [];
  status: 'solving' | 'solved' | 'failed' = 'solving';

  constructor(readonly puzzle: VisionPuzzle) {
    this.start = positionFromFen(puzzle[1]);
    const pos = this.start.clone();
    this.moves = [];
    for (const u of puzzle[2].split(' ')) {
      const m = parseUci(u) as NormalMove;
      this.moves.push(m);
      pos.play(m);
    }
  }

  get id() {
    return this.puzzle[0];
  }
  get rating() {
    return this.puzzle[3];
  }
  /** The solver's colour (the side that moves after the opponent's first move). */
  get side(): 'white' | 'black' {
    return this.start.turn === 'white' ? 'black' : 'white';
  }
  /** The position before move `i`. */
  positionAt(i: number): Chess {
    const p = this.start.clone();
    for (const m of this.moves.slice(0, i)) p.play(m);
    return p;
  }
  /** SAN of move `i` in its position. */
  san(i: number): string {
    return makeSan(this.positionAt(i), this.moves[i]);
  }
  /** The moves so far (the opponent's first move and every move after), in SAN. */
  get shown(): string[] {
    return this.moves.slice(0, this.step).map((_, i) => this.san(i));
  }

  /**
   * Checks the solver's typed move. Right: the next opponent reply (if any)
   * is played and its SAN returned. A different move that also checkmates
   * counts as right, as on Lichess.
   */
  answer(typed: string): { ok: boolean; illegal?: boolean; reply?: string } {
    const pos = this.positionAt(this.step);
    const m = readMove(pos, typed);
    if (!m) return { ok: false, illegal: true };
    const want = this.moves[this.step];
    const same = m.from === want.from && m.to === want.to && (m.promotion ?? 'queen') === (want.promotion ?? 'queen');
    const after = pos.clone();
    after.play(m);
    const mates = after.isCheckmate();
    this.played.push(`${makeSquare(m.from)}${makeSquare(m.to)}${m.promotion ? m.promotion[0] : ''}`);
    if (!same && !mates) {
      this.status = 'failed';
      return { ok: false };
    }
    if (mates || this.step + 1 >= this.moves.length) {
      this.status = 'solved';
      this.step = this.moves.length;
      return { ok: true };
    }
    const reply = this.san(this.step + 1);
    this.step += 2;
    return { ok: true, reply };
  }
}

// ---------- the bank ----------

let bank: Promise<VisionPuzzle[]> | undefined;
export const loadVisionBank = (): Promise<VisionPuzzle[]> => (bank ??= fetch('/data/vision.json').then((r) => r.json() as Promise<VisionPuzzle[]>));

const SEEN = 'k24.vision.seen';

/** A puzzle near `rating`, not one of the last few hundred seen; few pieces for low ratings. */
export async function nextVisionPuzzle(rating: number, random = Math.random): Promise<VisionPuzzle> {
  const all = await loadVisionBank();
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(SEEN) ?? '[]');
  } catch {
    /* none */
  }
  const skip = new Set(seen);
  for (const width of [100, 200, 400, 2000]) {
    const near = all.filter((p) => Math.abs(p[3] - rating) <= width && !skip.has(p[0]));
    if (near.length) {
      const p = near[Math.floor(random() * near.length)];
      try {
        localStorage.setItem(SEEN, JSON.stringify([p[0], ...seen].slice(0, 400)));
      } catch {
        /* fine */
      }
      return p;
    }
  }
  return all[Math.floor(random() * all.length)];
}

// ---------- the player's Vision record (this browser) ----------

export interface VisionRecord {
  rating: number;
  games: number;
  solved: number;
  bestSprint: number;
  bestMemory: number;
  /** "2026-10-16" and that day's best sprint. */
  sprintDay?: string;
  sprintToday?: number;
}

const KEY = 'k24.vision';
export const VISION_START = 1000;

export function loadVision(): VisionRecord {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (r && typeof r.rating === 'number') return { bestSprint: 0, bestMemory: 0, solved: 0, games: 0, ...r };
  } catch {
    /* first visit */
  }
  return { rating: VISION_START, games: 0, solved: 0, bestSprint: 0, bestMemory: 0 };
}

export function saveVision(r: VisionRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* private mode */
  }
}

/** Elo against the puzzle's rating: K 40 for the first 20 puzzles, then 20. Same rule as the server. */
export function visionRatingAfter(rating: number, games: number, puzzleRating: number, solved: boolean): number {
  const k = games < 20 ? 40 : 20;
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  return Math.max(100, Math.round(rating + k * ((solved ? 1 : 0) - expected)));
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export { fenOf };

import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { parseSan } from 'chessops/san';
import { encodeMove, movesInWindow, type BookMove, type BookSource } from '$lib/book/book';
import { sanOf } from '$lib/chess/position';

/** Where the bot's move came from. */
export type MoveSource = 'opening' | 'book' | 'engine';

export interface BotChoice {
  move: NormalMove;
  source: MoveSource;
  /** Games in the window that reached the position (book moves). */
  games: number;
  /** ± points of the rating window used (book moves). */
  window: number;
  /** How clearly this move stood out (0 to 1): its share of the games, or Maia's probability for its top move. */
  confidence?: number;
  /** For engine moves: the human-like Maia or Stockfish. */
  engine?: 'maia' | 'stockfish';
}

/** An engine's choice, with how sure it was. */
export interface EnginePick {
  move: NormalMove;
  confidence?: number;
  engine?: 'maia' | 'stockfish';
}

/**
 * The engine's move for a position at about a rating (`opponent`: the
 * player's rating, if known; `limitMs`: how long the engines may take, from
 * the bot's clock).
 */
export type EngineMove = (pos: Chess, rating: number, opponent?: number, limitMs?: number) => Promise<NormalMove | EnginePick | undefined>;

/** Whether a book move is safe for a player of `rating` to play (false: it loses too much). */
export type MoveGuard = (pos: Chess, move: NormalMove, rating: number) => Promise<boolean>;

/** Book moves from fewer games than this are checked by the guard (strong bots only). */
export const THIN_BOOK = 20;
/** The rating from which the guard checks thin book moves. */
export const GUARD_FROM = 1800;

/** How many plies count as "the opening" for variety. */
export const VARIETY_PLIES = 8;

/**
 * Picks moves the way a FIDE-rated player would (a port of the app's
 * lib/fide_play/fide_bot.dart):
 * 1. While the game follows the chosen opening, play its next move.
 * 2. Else real games by players within ±25, then ±50, then ±100 points,
 *    weighted by how often they chose each move.
 * 3. Only if no window has `minGames` games, the engine plays this one
 *    move; the next move checks the book again.
 * Early moves that repeat a recent game's opening are made less likely.
 * Strong players mostly play the well-trodden, well-scoring moves: one-off
 * moves (under 3% of many games) are skipped, and moves are weighted by how
 * well they scored, more so the higher the rating. A move from only a few
 * games (a rare sideline) is checked by `guard` at 1800+, so a bot never
 * copies one club game's blunder.
 */
export class FideBot {
  windows = [25, 50, 100];
  minGames = 2;
  recentOpenings: string[] = [];

  constructor(
    readonly book: BookSource,
    private readonly engineMove: EngineMove,
    private readonly random: () => number = Math.random,
    private readonly guard?: MoveGuard,
  ) {}

  async choose(pos: Chess, playedSans: string[], rating: number, openingSans?: string[], opponent?: number, limitMs?: number): Promise<BotChoice | undefined> {
    const fromOpening = this.openingMove(pos, playedSans, openingSans);
    if (fromOpening) return { move: fromOpening, source: 'opening', games: 0, window: 0 };

    const entries = await this.book.entries(pos);
    if (entries.length) {
      for (const window of this.windows) {
        const moves = movesInWindow(entries, this.book.bookRating?.(rating) ?? rating, window).filter((x) => pos.isLegal(x.move));
        const games = moves.reduce((s, x) => s + x.games, 0);
        if (games >= this.minGames) {
          const move = this.pick(pos, playedSans, moves, rating);
          if (this.guard && rating >= GUARD_FROM && games < THIN_BOOK && !(await this.guard(pos, move, rating).catch(() => true))) break;
          const chosen = moves.filter((x) => encodeMove(x.move) === encodeMove(move)).reduce((s, x) => s + x.games, 0);
          return { move, source: 'book', games, window, confidence: chosen / games };
        }
      }
    }
    const got = await this.engineMove(pos, rating, opponent, limitMs);
    const pick: EnginePick | undefined = got && 'move' in got ? got : got ? { move: got } : undefined;
    if (!pick || !pos.isLegal(pick.move)) return undefined;
    return { move: pick.move, source: 'engine', games: 0, window: 0, confidence: pick.confidence, engine: pick.engine };
  }

  /** Fetches the positions after the player's most popular replies. */
  async prefetchReplies(pos: Chess, count = 3): Promise<void> {
    const entries = await this.book.entries(pos);
    if (!entries.length) return;
    const totals = new Map<number, { move: NormalMove; games: number }>();
    for (const e of entries) {
      const code = encodeMove(e.move);
      const t = totals.get(code) ?? { move: e.move, games: 0 };
      t.games += e.games;
      totals.set(code, t);
    }
    const top = [...totals.values()].sort((a, b) => b.games - a.games).slice(0, count);
    this.book.prefetch(
      top
        .filter((t) => pos.isLegal(t.move))
        .map((t) => {
          const next = pos.clone();
          next.play(t.move);
          return next;
        }),
    );
  }

  private openingMove(pos: Chess, played: string[], opening?: string[]): NormalMove | undefined {
    if (!opening || played.length >= opening.length) return undefined;
    for (let i = 0; i < played.length; i++) if (played[i] !== opening[i]) return undefined;
    const m = parseSan(pos, opening[played.length]);
    return m && 'from' in m ? m : undefined;
  }

  private pick(pos: Chess, played: string[], moves: BookMove[], rating: number): NormalMove {
    const total = moves.reduce((s, x) => s + x.games, 0);
    // How much results count: not at all for beginners, fully at 2200+.
    const care = Math.min(1, Math.max(0, (rating - 1200) / 1000));
    const weights = moves.map((x) => {
      if (total >= 30 && x.games < total * 0.03) return 0;
      let w = x.games;
      if (x.games >= 8) {
        const score = (x.wins + x.draws / 2) / x.games;
        w *= ((score + 0.25) / 0.75) ** (2 * care);
      }
      if (played.length < VARIETY_PLIES && this.recentOpenings.length) {
        const line = [...played, sanOf(pos, x.move)].join(' ');
        const repeats = this.recentOpenings.filter((o) => o === line || o.startsWith(line + ' ')).length;
        w *= 0.5 ** repeats;
      }
      return w;
    });
    if (!weights.some((w) => w > 0)) return moves[0].move;
    let roll = this.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < moves.length; i++) {
      roll -= weights[i];
      if (roll < 0) return moves[i].move;
    }
    return moves[0].move;
  }
}

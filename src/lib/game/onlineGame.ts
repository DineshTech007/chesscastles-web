import { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { moveToUci, positionFromFen, sanOf, uciToMove } from '$lib/chess/position';

export interface OnlinePlayer {
  name: string;
  rating?: number;
  title?: string;
  /** Lichess's computer level, when the opponent is Stockfish. */
  ai?: number;
}

export interface OnlinePly {
  move: NormalMove;
  san: string;
  after: Chess;
}

const FINISHED = new Set(['aborted', 'mate', 'resign', 'stalemate', 'timeout', 'draw', 'outoftime', 'cheat', 'noStart', 'variantEnd']);

/**
 * A game on Lichess, rebuilt from its Board API stream (gameFull, then
 * gameState after every move). The player's own move is shown at once and
 * undone if Lichess refuses it.
 */
export class OnlineGame {
  id = '';
  white: OnlinePlayer = { name: 'White' };
  black: OnlinePlayer = { name: 'Black' };
  initial = 0;
  increment = 0;
  rated = false;
  speed = '';
  start: Chess = Chess.default();
  plies: OnlinePly[] = [];
  wtime = 0;
  btime = 0;
  /** When the last clock reading arrived (ms since the epoch). */
  clockAt = 0;
  status = 'created';
  winner?: 'white' | 'black';
  whiteOffersDraw = false;
  blackOffersDraw = false;
  /** A move sent and not yet confirmed. */
  pending?: string;

  /** The player's side; set from the game itself when joining from a link. */
  constructor(public me: 'white' | 'black' | undefined) {}

  get position(): Chess {
    return (this.plies.length ? this.plies[this.plies.length - 1].after : this.start).clone();
  }
  get isOver(): boolean {
    return FINISHED.has(this.status);
  }
  get myTurn(): boolean {
    return !this.isOver && !!this.me && this.position.turn === this.me && !this.pending;
  }
  get opponent(): OnlinePlayer {
    return this.me === 'black' ? this.white : this.black;
  }
  /** Lichess lets either player abort until both have moved. */
  get canAbort(): boolean {
    return !this.isOver && this.plies.length < 2;
  }
  /** Whether this player has made their first move (Abort until then; Resign and Offer draw after, as on Chess.com). */
  get movedYet(): boolean {
    return !!this.me && this.plies.length >= (this.start.turn === this.me ? 1 : 2);
  }

  /** Applies one line of the game stream; returns true if the board changed. */
  apply(o: any, now = Date.now()): boolean {
    if (o.type === 'gameFull') {
      this.id = o.id;
      const p = (x: any): OnlinePlayer =>
        x?.aiLevel ? { name: `Stockfish level ${x.aiLevel}`, ai: x.aiLevel } : { name: x?.name ?? x?.id ?? '?', rating: x?.rating, title: x?.title };
      this.white = p(o.white);
      this.black = p(o.black);
      this.initial = o.clock?.initial ?? 0;
      this.increment = o.clock?.increment ?? 0;
      this.rated = !!o.rated;
      this.speed = o.speed ?? '';
      this.start = o.initialFen && o.initialFen !== 'startpos' ? positionFromFen(o.initialFen) : Chess.default();
      return this.applyState(o.state, now);
    }
    if (o.type === 'gameState') return this.applyState(o, now);
    return false;
  }

  private applyState(s: any, now: number): boolean {
    const ucis: string[] = String(s.moves ?? '').split(' ').filter(Boolean);
    let changed = false;
    // Rebuild only when Lichess's list differs from what is shown.
    const same = ucis.length === this.plies.length && ucis.every((u, i) => this.uciAt(i) === u);
    if (!same) {
      const pos = this.start.clone();
      const plies: OnlinePly[] = [];
      for (const u of ucis) {
        const m = uciToMove(u);
        if (!m || !pos.isLegal(m)) break;
        const san = sanOf(pos, m);
        pos.play(m);
        plies.push({ move: m, san, after: pos.clone() });
      }
      this.plies = plies;
      changed = true;
    }
    this.pending = undefined;
    this.wtime = s.wtime ?? this.wtime;
    this.btime = s.btime ?? this.btime;
    this.clockAt = now;
    this.status = s.status ?? this.status;
    this.winner = s.winner;
    this.whiteOffersDraw = !!s.wdraw;
    this.blackOffersDraw = !!s.bdraw;
    return changed;
  }

  private uciAt(i: number): string {
    return moveToUci(this.plies[i].move);
  }

  /** Shows the player's move at once (before Lichess confirms it). */
  playLocal(m: NormalMove, uci: string): boolean {
    const pos = this.position;
    if (!this.myTurn || !pos.isLegal(m)) return false;
    const san = sanOf(pos, m);
    pos.play(m);
    this.plies = [...this.plies, { move: m, san, after: pos }];
    this.pending = uci;
    return true;
  }

  /** Lichess refused the move: take it back. */
  undoLocal(): void {
    if (!this.pending) return;
    this.plies = this.plies.slice(0, -1);
    this.pending = undefined;
  }

  /** A side's clock now: the side to move loses time since the last reading. */
  remaining(side: 'white' | 'black', now = Date.now()): number {
    const t = side === 'white' ? this.wtime : this.btime;
    const running = !this.isOver && this.plies.length >= 2 && this.position.turn === side && !this.pending;
    return Math.max(0, running ? t - (now - this.clockAt) : t);
  }

  /** "1-0", "0-1", "½-½" or "" (aborted). */
  get result(): string {
    if (this.status === 'aborted' || this.status === 'noStart') return '';
    return this.winner === 'white' ? '1-0' : this.winner === 'black' ? '0-1' : '½-½';
  }

  get endReason(): string {
    const loser = this.winner === 'white' ? 'Black' : 'White';
    switch (this.status) {
      case 'mate':
        return 'Checkmate';
      case 'resign':
        return `${loser} resigned`;
      case 'outoftime':
      case 'timeout':
        return `${loser} ran out of time`;
      case 'stalemate':
        return 'Stalemate';
      case 'draw':
        return 'Draw agreed';
      case 'aborted':
        return 'Game aborted';
      case 'noStart':
        return 'The game did not start';
      default:
        return this.status;
    }
  }
}

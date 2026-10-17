import type { Board } from 'chessops/board';
import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { squareFile, squareRank } from 'chessops/util';

/**
 * Several premoves in a row (a port of the app's lib/game/premove_queue.dart):
 * queued while the opponent thinks, each from the position the earlier ones
 * lead to. The first is played when the turn comes if it is legal; an
 * illegal one drops the whole queue.
 */
export class PremoveQueue {
  static readonly maxLength = 8;
  private items: NormalMove[] = [];

  get moves(): readonly NormalMove[] {
    return this.items;
  }
  get length(): number {
    return this.items.length;
  }

  add(m: NormalMove): boolean {
    if (this.items.length >= PremoveQueue.maxLength) return false;
    this.items.push(m);
    return true;
  }

  clear(): void {
    this.items = [];
  }

  /** The board after the queued moves (the opponent's replies unknown). */
  preview(board: Board): Board {
    const b = board.clone();
    for (const m of this.items) apply(b, m);
    return b;
  }

  /** The next premove to play in pos (the player's turn), or undefined and cleared. */
  takeNext(pos: Chess): NormalMove | undefined {
    const m = this.items[0];
    if (!m) return undefined;
    if (!pos.isLegal(m)) {
      this.clear();
      return undefined;
    }
    this.items = this.items.slice(1);
    return m;
  }
}

function apply(b: Board, m: NormalMove): void {
  const piece = b.get(m.from);
  if (!piece) return;
  const target = b.get(m.to);
  const castle =
    piece.role === 'king' &&
    ((target?.color === piece.color && target.role === 'rook') || Math.abs(squareFile(m.from) - squareFile(m.to)) === 2);
  if (castle) {
    const kingSide = squareFile(m.to) > squareFile(m.from);
    const rank = squareRank(m.from) * 8;
    const rookFrom = rank + (kingSide ? 7 : 0);
    const rook = b.get(rookFrom);
    b.take(m.from);
    if (rook) {
      b.take(rookFrom);
      b.set(rank + (kingSide ? 5 : 3), rook);
    }
    b.set(rank + (kingSide ? 6 : 2), piece);
    return;
  }
  b.take(m.from);
  b.set(m.to, m.promotion ? { ...piece, role: m.promotion } : piece);
}

import type { Chess } from 'chessops/chess';
import { normalizeMove } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { BAND_WIDTH, type BookEntry, type BookSource } from '$lib/book/book';
import { polyglotKey } from '$lib/chess/polyglot';
import { uciToMove } from '$lib/chess/position';

/**
 * A study opening's own book (scripts/study/repertoire.py): the moves played
 * in the opening's games only, so the trainer teaches what players of this
 * opening choose and every reply their opponents tried. Positions are kept
 * in 256 small files by the first two hex digits of the key. Every move
 * counts as rated 2000, so the trainer's rating floor keeps them.
 */
const BAND = Math.floor(2000 / BAND_WIDTH);
type Row = [uci: string, games: number, wins: number, draws: number];

export class StudyBook implements BookSource {
  private readonly files = new Map<string, Promise<Record<string, Row[]>>>();
  constructor(readonly opening: string) {}

  private file(prefix: string): Promise<Record<string, Row[]>> {
    let f = this.files.get(prefix);
    if (!f) {
      f = fetch(`/data/study/book/${this.opening}/${prefix}.json`).then((r) => (r.ok ? (r.json() as Promise<Record<string, Row[]>>) : {}));
      f.catch(() => this.files.delete(prefix));
      this.files.set(prefix, f);
    }
    return f;
  }

  async entries(pos: Chess): Promise<BookEntry[]> {
    const key = polyglotKey(pos).toString(16).padStart(16, '0');
    const rows = (await this.file(key.slice(0, 2)))[key] ?? [];
    const out: BookEntry[] = [];
    for (const [u, games, wins, draws] of rows) {
      const m = uciToMove(u);
      if (m) out.push({ band: BAND, move: normalizeMove(pos, m) as NormalMove, games, wins, draws });
    }
    return out;
  }

  prefetch(positions: Chess[]): void {
    for (const p of positions) void this.file(polyglotKey(p).toString(16).padStart(16, '0').slice(0, 2)).catch(() => undefined);
  }
}

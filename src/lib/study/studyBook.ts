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

/**
 * The opening's own book, continued by our engines where its games run out
 * (fewer than `minGames` reach a position), as a course author continues a
 * line with analysis: at the student's turns Stockfish's best move, at the
 * opponent's turns the moves Maia (the human-like engine) expects from players
 * of `elo` (up to two, each 25%+ likely). At most `extraPlies` beyond the last
 * position with games and `budget` engine positions in all, so a tree stays
 * quick to build. Positions answered by the engines are listed in `engineKeys`.
 */
export class HybridBook implements BookSource {
  readonly engineKeys = new Set<string>();
  private used = 0;
  /** Plies since the last position with games, per position key. */
  private readonly beyond = new Map<string, number>();

  constructor(
    private readonly book: BookSource,
    private readonly side: 'white' | 'black',
    private readonly elo = 1800,
    private readonly minGames = 4,
    private readonly extraPlies = 12,
    private readonly budget = 220,
  ) {}

  async entries(pos: Chess): Promise<BookEntry[]> {
    const own = await this.book.entries(pos);
    const key = polyglotKey(pos).toString(16);
    if (own.reduce((s, e) => s + e.games, 0) >= this.minGames) return own;
    // How far past the games this position is: its parent's distance + 1 (the trainer asks parents first).
    const depth = this.beyond.get(key) ?? 0;
    if (depth >= this.extraPlies || this.used >= this.budget || pos.isEnd()) return own;
    this.used++;
    const { engine } = await import('$lib/engine/stockfish');
    const { maia } = await import('$lib/engine/maia');
    const { fenOf, uciToMove: toMove } = await import('$lib/chess/position');
    let out: { move: NormalMove; weight: number }[] = [];
    if (pos.turn === this.side) {
      const info = await engine.evaluate(fenOf(pos), 12, 1, 1500);
      const m = info?.pv[0] ? toMove(info.pv[0]) : undefined;
      if (m && pos.isLegal(m)) out = [{ move: m, weight: 100 }];
    } else {
      if (await maia.whenReady(3000)) {
        const policy = (await maia.policy(pos, this.elo)).filter((x) => x.p >= 0.25).slice(0, 2);
        out = policy.map((x) => ({ move: x.move, weight: Math.round(x.p * 100) }));
      }
      if (!out.length) {
        const info = await engine.evaluate(fenOf(pos), 12, 1, 1500);
        const m = info?.pv[0] ? toMove(info.pv[0]) : undefined;
        if (m && pos.isLegal(m)) out = [{ move: m, weight: 100 }];
      }
    }
    if (!out.length) return own;
    this.engineKeys.add(key);
    for (const o of out) {
      const after = pos.clone();
      after.play(o.move);
      this.beyond.set(polyglotKey(after).toString(16), depth + 1);
    }
    return out.map((o) => ({ band: BAND, move: o.move, games: o.weight, wins: 0, draws: 0 }));
  }

  prefetch(positions: Chess[]): void {
    this.book.prefetch(positions);
  }
}

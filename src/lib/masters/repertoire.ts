import type { Chess } from 'chessops/chess';
import { normalizeMove } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { BAND_WIDTH, type BookEntry, type BookSource } from '$lib/book/book';
import { polyglotKey } from '$lib/chess/polyglot';
import { uciToMove } from '$lib/chess/position';
import { LEGENDS } from '$lib/coach/content/legends';
import type { Opening } from '$lib/openings';
import { TEACHERS } from './content';

/**
 * A master's opening repertoire for the opening trainer: the moves a great
 * player chose in their classical games (scripts/masters/openings.py), as a
 * book the trainer builds its tree from. Every move counts as rated 2800, so
 * any rating floor keeps them.
 */
const BAND = Math.floor(2800 / BAND_WIDTH);

type Row = [uci: string, games: number, wins: number, draws: number];
interface RepertoireFile {
  games: number;
  pos: Record<string, Row[]>;
}

export class RepertoireBook implements BookSource {
  private data?: Promise<RepertoireFile>;
  constructor(
    readonly teacher: string,
    readonly side: 'white' | 'black',
  ) {}

  load(): Promise<RepertoireFile> {
    this.data ??= fetch(`/data/masters/openings/${this.teacher}-${this.side}.json`).then((r) => {
      if (!r.ok) throw new Error('missing');
      return r.json() as Promise<RepertoireFile>;
    });
    return this.data.catch((e) => {
      this.data = undefined;
      throw e;
    });
  }

  async entries(pos: Chess): Promise<BookEntry[]> {
    const d = await this.load();
    const out: BookEntry[] = [];
    for (const [u, games, wins, draws] of d.pos[polyglotKey(pos).toString(16)] ?? []) {
      const m = uciToMove(u);
      // The data writes castling as e1g1; the trainer uses king-takes-rook.
      if (m) out.push({ band: BAND, move: normalizeMove(pos, m) as NormalMove, games, wins, draws });
    }
    return out;
  }

  prefetch(): void {
    void this.load().catch(() => undefined);
  }
}

/** "m-carlsen-white" -> the teacher and side, when it is a master's repertoire. */
export function masterOf(id: string): { teacher: string; side: 'white' | 'black' } | undefined {
  const m = /^m-([a-z]+)-(white|black)$/.exec(id);
  if (!m || !TEACHERS.some((t) => t.id === m[1])) return undefined;
  return { teacher: m[1], side: m[2] as 'white' | 'black' };
}

/** The trainer's "opening" for a master's repertoire. */
export function masterOpening(id: string): Opening | undefined {
  const m = masterOf(id);
  const name = m && LEGENDS[m.teacher]?.name;
  if (!m || !name) return undefined;
  const colour = m.side === 'white' ? 'White' : 'Black';
  return {
    id,
    name: `Openings from ${name}'s games (${colour})`,
    sans: '',
    side: m.side,
    blurb: `Learn the openings ${name} played with ${colour} in classical tournament games: at your turns, the move ${name} chose most often; at your opponent's turns, the replies ${name} met most.`,
  };
}

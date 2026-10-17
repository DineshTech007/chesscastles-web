import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { BookShard, decodeMove } from '$lib/book/book';
import { polyglotKey } from '$lib/chess/polyglot';
import { decodeMoves } from './caissa';

/**
 * The CaissaBase games database on Cloudflare (built by the app's
 * tool/gamesdb): reference games per position, a small header per game, and
 * every game's moves.
 */
export const REFS_URL = 'https://refs.chesscastles.com';
export const GAMES_URL = 'https://games.chesscastles.com';
const REF_BITS = 13n;
const GAME_SHARD_BITS = 9;

export interface RefEntry {
  gameId: number;
  /** The move played in that game from this position. */
  move: NormalMove;
  /** Average rating of the two players (0 when unrated). */
  elo: number;
}

export interface GameHeader {
  id: number;
  white: string;
  black: string;
  whiteElo: number;
  blackElo: number;
  year: number;
  result: string;
  event: string;
}

export interface DbGame extends GameHeader {
  site?: string;
  date?: string;
  round?: string;
  eco?: string;
  start: Chess;
  moves: NormalMove[];
}

/** Up to 8 entries of 8 bytes: uint32 game id, uint16 move, uint16 Elo. */
export function decodeRefs(b: Uint8Array): RefEntry[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: RefEntry[] = [];
  for (let i = 0; i + 8 <= b.length; i += 8) {
    out.push({ gameId: view.getUint32(i, true), move: decodeMove(view.getUint16(i + 4, true)), elo: view.getUint16(i + 6, true) });
  }
  return out;
}

/** A small cache of fetched files (most recently used kept). */
class Cache<T> {
  private readonly map = new Map<string, Promise<T>>();
  constructor(private readonly max: number) {}
  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const p = load();
    p.catch(() => this.map.delete(key));
    this.map.set(key, p);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
    return p;
  }
}

export class GamesDb {
  private readonly refShards = new Cache<BookShard>(128);
  private readonly headerShards = new Cache<Record<string, unknown[]>>(64);
  private readonly gameShards = new Cache<Record<string, any>>(8);

  constructor(
    private readonly refsBase = REFS_URL,
    private readonly gamesBase = GAMES_URL,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private async json(url: string): Promise<any> {
    const res = await this.fetchFn(url);
    if (!res.ok) throw new Error(`The games database answered ${res.status}`);
    return res.json();
  }

  /** The strongest games that reached a position, with the move each played. */
  async refs(pos: Chess): Promise<RefEntry[]> {
    const key = polyglotKey(pos);
    const id = Number(key >> (64n - REF_BITS));
    const name = id.toString(16).padStart(4, '0');
    const shard = await this.refShards.get(name, async () => {
      const res = await this.fetchFn(`${this.refsBase}/r1/${name}.bin`);
      if (!res.ok) throw new Error(`The games database answered ${res.status}`);
      return new BookShard(new Uint8Array(await res.arrayBuffer()));
    });
    const b = shard.blob(key);
    return b ? decodeRefs(b) : [];
  }

  async header(gameId: number): Promise<GameHeader | undefined> {
    const shard = String(gameId >> GAME_SHARD_BITS).padStart(5, '0');
    const all = await this.headerShards.get(shard, () => this.json(`${this.refsBase}/h1/${shard}.json`));
    const h = all[String(gameId)] as [string, string, number, number, number, string, string] | undefined;
    if (!h) return undefined;
    return { id: gameId, white: h[0], black: h[1], whiteElo: h[2], blackElo: h[3], year: h[4], result: h[5], event: h[6] };
  }

  /** A whole game: headers and moves. */
  async game(gameId: number): Promise<DbGame | undefined> {
    const shard = String(gameId >> GAME_SHARD_BITS).padStart(5, '0');
    const all = await this.gameShards.get(shard, () => this.json(`${this.gamesBase}/g1/${shard}.json`));
    const g = all[String(gameId)];
    if (!g) return undefined;
    const { start, moves } = decodeMoves(g.m ?? '', g.fen);
    return {
      id: gameId,
      white: g.w,
      black: g.b,
      whiteElo: g.we ?? 0,
      blackElo: g.be ?? 0,
      year: Number(String(g.d ?? '').slice(0, 4)) || 0,
      result: g.r,
      event: g.ev ?? '',
      site: g.si,
      date: g.d,
      round: g.rd,
      eco: g.eco,
      start,
      moves,
    };
  }
}

export const gamesDb = new GamesDb();

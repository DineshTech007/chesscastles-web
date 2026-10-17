import type { Chess } from 'chessops/chess';
import type { NormalMove, Role } from 'chessops/types';
import { polyglotKey } from '$lib/chess/polyglot';

/**
 * The FIDE games book: 16,384 static files on Cloudflare, built from 5.4
 * million rated over-the-board games by the app's tool/gamesdb. The same
 * files serve the app and this website (see lib/fide_play/fide_book.dart).
 */
export const BOOK_URL = 'https://book.chesscastles.com/v1';

/** Rating bands are 25 points wide (band 72 = 1800–1824). */
export const BAND_WIDTH = 25;
const SHARD_BITS = 14n;
const LOW48 = (1n << 48n) - 1n;

export interface BookEntry {
  band: number;
  move: NormalMove;
  games: number;
  /** Wins and draws for the player who made the move. */
  wins: number;
  draws: number;
}

export interface BookMove {
  move: NormalMove;
  games: number;
  wins: number;
  draws: number;
}

const PROMOTION: (Role | undefined)[] = [undefined, 'knight', 'bishop', 'rook', 'queen'];

/** from | to << 6 | promotion << 12; castling is king to rook. */
export function decodeMove(code: number): NormalMove {
  const promotion = PROMOTION[(code >> 12) & 7];
  const m: NormalMove = { from: code & 63, to: (code >> 6) & 63 };
  return promotion ? { ...m, promotion } : m;
}

export function encodeMove(m: NormalMove): number {
  return m.from | (m.to << 6) | (m.promotion ? PROMOTION.indexOf(m.promotion) : 0) << 12;
}

/** Unpacks a position's entries: band byte, move code (LE16), three varints. */
export function decodeBlob(bytes: Uint8Array): BookEntry[] {
  const out: BookEntry[] = [];
  let i = 0;
  const varint = () => {
    let value = 0;
    let mul = 1;
    for (;;) {
      const b = bytes[i++];
      value += (b & 0x7f) * mul;
      if (b < 0x80) return value;
      mul *= 128;
    }
  };
  while (i < bytes.length) {
    const band = bytes[i];
    const code = bytes[i + 1] | (bytes[i + 2] << 8);
    i += 3;
    const games = varint();
    const wins = varint();
    const draws = varint();
    out.push({ band, move: decodeMove(code), games, wins, draws });
  }
  return out;
}

/** One shard file: count, sorted low-48-bit keys, offsets, blobs. */
export class BookShard {
  private readonly view: DataView;
  readonly length: number;
  private readonly offsets: number;
  private readonly blobs: number;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.length = this.view.getUint32(0, true);
    this.offsets = 4 + 6 * this.length;
    this.blobs = this.offsets + 4 * (this.length + 1);
  }

  private keyAt(i: number): number {
    const o = 4 + 6 * i;
    // 48 bits fit exactly in a JavaScript number.
    return this.view.getUint32(o, true) + this.view.getUint16(o + 4, true) * 2 ** 32;
  }

  /** The raw blob stored for [key], found by binary search (shared by the book and the reference files). */
  blob(key: bigint): Uint8Array | undefined {
    const want = Number(key & LOW48);
    let lo = 0;
    let hi = this.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const k = this.keyAt(mid);
      if (k < want) lo = mid + 1;
      else if (k > want) hi = mid - 1;
      else {
        const start = this.view.getUint32(this.offsets + 4 * mid, true);
        const end = this.view.getUint32(this.offsets + 4 * mid + 4, true);
        return this.bytes.subarray(this.blobs + start, this.blobs + end);
      }
    }
    return undefined;
  }

  lookup(key: bigint): BookEntry[] {
    const b = this.blob(key);
    return b ? decodeBlob(b) : [];
  }
}

export const shardOf = (key: bigint): number => Number(key >> (64n - SHARD_BITS));

/** Sums entries for players rated minRating..maxRating (inclusive), most played first. */
export function movesInRange(entries: BookEntry[], minRating: number, maxRating = 9999): BookMove[] {
  const lo = Math.floor(minRating / BAND_WIDTH);
  const hi = Math.floor(maxRating / BAND_WIDTH);
  const sums = new Map<number, BookMove>();
  for (const e of entries) {
    if (e.band < lo || e.band > hi) continue;
    const code = encodeMove(e.move);
    const s = sums.get(code) ?? { move: e.move, games: 0, wins: 0, draws: 0 };
    s.games += e.games;
    s.wins += e.wins;
    s.draws += e.draws;
    sums.set(code, s);
  }
  return [...sums.values()].sort((a, b) => b.games - a.games);
}

/** Players rated rating ± window (rating − window inclusive, rating + window exclusive). */
export const movesInWindow = (entries: BookEntry[], rating: number, window: number) =>
  movesInRange(entries, rating - window, rating + window - 1);

/** Where book moves come from; a fake in tests. */
export interface BookSource {
  entries(pos: Chess): Promise<BookEntry[]>;
  prefetch(positions: Chess[]): void;
}

/**
 * Reads the book over the network, one shard per lookup, kept in memory
 * (the browser's HTTP cache keeps them across visits: they are immutable).
 * A slow or failed fetch returns nothing, so the bot lets the engine play
 * that move instead of waiting.
 */
export class CloudBook implements BookSource {
  private readonly memory = new Map<number, BookShard>();
  private readonly loading = new Map<number, Promise<BookShard | null>>();
  private offlineUntil = 0;
  private failures = 0;

  constructor(
    private readonly base = BOOK_URL,
    private readonly timeoutMs = 6000,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  async entries(pos: Chess): Promise<BookEntry[]> {
    const key = polyglotKey(pos);
    const shard = await this.shard(shardOf(key));
    return shard?.lookup(key) ?? [];
  }

  prefetch(positions: Chess[]): void {
    for (const p of positions) void this.shard(shardOf(polyglotKey(p)));
  }

  private shard(id: number): Promise<BookShard | null> {
    const hit = this.memory.get(id);
    if (hit) {
      this.memory.delete(id);
      this.memory.set(id, hit); // most recently used last
      return Promise.resolve(hit);
    }
    let p = this.loading.get(id);
    if (!p) {
      p = this.load(id).finally(() => this.loading.delete(id));
      this.loading.set(id, p);
    }
    return p;
  }

  private async load(id: number): Promise<BookShard | null> {
    if (Date.now() < this.offlineUntil) return null;
    const name = id.toString(16).padStart(4, '0');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.base}/${name}.bin`, { signal: ctl.signal });
      if (!res.ok) return null;
      const shard = new BookShard(new Uint8Array(await res.arrayBuffer()));
      this.memory.set(id, shard);
      this.failures = 0;
      if (this.memory.size > 512) this.memory.delete(this.memory.keys().next().value!);
      return shard;
    } catch {
      // One slow fetch only costs this move; after a few in a row (offline), the
      // engine plays for a few seconds instead of every move waiting for a timeout.
      if (++this.failures >= 3) this.offlineUntil = Date.now() + 8_000;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

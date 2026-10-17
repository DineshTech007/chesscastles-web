import { existsSync, readFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { describe, expect, it } from 'vitest';
import { playSans, sanOf, uciToMove } from '$lib/chess/position';
import { polyglotKey } from '$lib/chess/polyglot';
import {
  BookShard,
  CloudBook,
  decodeBlob,
  decodeMove,
  encodeMove,
  movesInRange,
  movesInWindow,
  shardOf,
  type BookEntry,
} from './book';

const m = (uci: string) => uciToMove(uci)!;
const e = (band: number, uci: string, games: number): BookEntry => ({
  band,
  move: m(uci),
  games,
  wins: 0,
  draws: 0,
});

function varint(v: number): number[] {
  const out: number[] = [];
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}

const blobEntry = (band: number, uci: string, n: number, w: number, d: number) => {
  const code = encodeMove(m(uci));
  return [band, code & 0xff, code >> 8, ...varint(n), ...varint(w), ...varint(d)];
};

/** A shard file as build_book.py writes it. */
function shardBytes(blobs: Map<bigint, number[]>): Uint8Array {
  const low = (k: bigint) => Number(k & ((1n << 48n) - 1n));
  const keys = [...blobs.keys()].sort((a, b) => low(a) - low(b));
  const out: number[] = [];
  const u32 = (v: number) => out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  u32(keys.length);
  for (const k of keys) {
    const l = low(k);
    for (let i = 0; i < 6; i++) out.push(Math.floor(l / 2 ** (8 * i)) & 0xff);
  }
  let offset = 0;
  for (const k of keys) {
    u32(offset);
    offset += blobs.get(k)!.length;
  }
  u32(offset);
  for (const k of keys) out.push(...blobs.get(k)!);
  return new Uint8Array(out);
}

describe('book format', () => {
  it('round-trips moves, including castling and promotion', () => {
    for (const uci of ['e2e4', 'e1h1', 'a7a8q', 'b2a1n']) {
      expect(decodeMove(encodeMove(m(uci)))).toEqual(m(uci));
    }
  });

  it('decodes bands, moves and large counts', () => {
    const entries = decodeBlob(
      new Uint8Array([...blobEntry(72, 'e2e4', 1300, 500, 400), ...blobEntry(80, 'g1f3', 300000, 120000, 99999)]),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ band: 72, games: 1300, wins: 500, draws: 400 });
    expect(entries[1]).toMatchObject({ band: 80, games: 300000, wins: 120000, draws: 99999 });
  });

  it('a ±25 window around 1800 is bands 1775–1824', () => {
    const entries = [e(70, 'e2e4', 100), e(71, 'e2e4', 10), e(72, 'e2e4', 20), e(72, 'd2d4', 7), e(73, 'e2e4', 100)];
    expect(movesInWindow(entries, 1800, 25).map((x) => x.games)).toEqual([30, 7]);
    expect(movesInRange(entries, 0)[0].games).toBe(230);
  });

  it('a shard finds every key by binary search', () => {
    const positions = [Chess.default(), playSans('e4'), playSans('d4'), playSans('e4 c5'), playSans('Nf3 d5 g3')];
    const blobs = new Map(positions.map((p, i) => [polyglotKey(p), blobEntry(72, 'a2a3', i + 1, 0, 0)]));
    const shard = new BookShard(shardBytes(blobs));
    positions.forEach((p, i) => expect(shard.lookup(polyglotKey(p))[0].games).toBe(i + 1));
    expect(shard.lookup(polyglotKey(playSans('c4')))).toEqual([]);
  });
});

describe('CloudBook', () => {
  it('fetches one shard per position, then answers from memory', async () => {
    const start = Chess.default();
    const key = polyglotKey(start);
    const urls: string[] = [];
    const fake = (async (url: string) => {
      urls.push(url);
      return new Response(shardBytes(new Map([[key, blobEntry(72, 'e2e4', 40, 15, 10)]])) as BodyInit);
    }) as unknown as typeof fetch;
    const book = new CloudBook('https://book.example/v1', 3000, fake);
    expect((await book.entries(start))[0].move).toEqual(m('e2e4'));
    await book.entries(start);
    expect(urls).toEqual([`https://book.example/v1/${shardOf(key).toString(16).padStart(4, '0')}.bin`]);
  });

  it('returns nothing when offline', async () => {
    const fail = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    const book = new CloudBook('https://book.example/v1', 3000, fail);
    expect(await book.entries(Chess.default())).toEqual([]);
  });
});

// Checks the real built book when it is on this PC (the app's build output).
const SHARDS = 'F:/dev/gamesdb_work/site/v1';
describe.runIf(existsSync(SHARDS))('the built book', () => {
  it('answers like real 1800 players', () => {
    const pos = playSans('e4 c5 Nf3');
    const key = polyglotKey(pos);
    const name = shardOf(key).toString(16).padStart(4, '0');
    const shard = new BookShard(new Uint8Array(readFileSync(`${SHARDS}/${name}.bin`)));
    const moves = movesInWindow(shard.lookup(key), 1800, 25);
    expect(moves.length).toBeGreaterThan(2);
    expect(moves.slice(0, 3).map((x) => sanOf(pos, x.move))).toEqual(['d6', 'Nc6', 'e6']);
  });
});

describe.runIf(existsSync(SHARDS))('the bot on the built book', () => {
  it('plays moves as often as 1800 players chose them', async () => {
    const { FideBot } = await import('$lib/bot/fideBot');
    // Serves shard files from disk instead of the network.
    const fromDisk = (async (url: string) =>
      new Response(readFileSync(`${SHARDS}/${url.split('/').pop()}`) as BodyInit)) as unknown as typeof fetch;
    const bot = new FideBot(new CloudBook('https://book.example/v1', 3000, fromDisk), async () => undefined);
    const pos = playSans('e4 e5 Nf3');
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const c = await bot.choose(pos, ['e4', 'e5', 'Nf3'], 1800);
      const san = sanOf(pos, c!.move);
      counts[san] = (counts[san] ?? 0) + 1;
    }
    expect(counts['Nc6'] / 2000).toBeGreaterThan(0.76);
    expect(counts['Nc6'] / 2000).toBeLessThan(0.86);
    expect((counts['Qe7'] ?? 0) / 2000).toBeLessThan(0.01);
  });
});

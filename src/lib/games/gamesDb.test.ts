import { existsSync, readFileSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { describe, expect, it } from 'vitest';
import { encodeMove } from '$lib/book/book';
import { playSans, sanOf, uciToMove } from '$lib/chess/position';
import { polyglotKey } from '$lib/chess/polyglot';
import { decodeRefs, GamesDb } from './gamesDb';

function refBlob(entries: [number, string, number][]): Uint8Array {
  const b = new Uint8Array(entries.length * 8);
  const v = new DataView(b.buffer);
  entries.forEach(([id, uci, elo], i) => {
    v.setUint32(i * 8, id, true);
    v.setUint16(i * 8 + 4, encodeMove(uciToMove(uci)!), true);
    v.setUint16(i * 8 + 6, elo, true);
  });
  return b;
}

/** A one-key shard in the book layout. */
function shard(key: bigint, blob: Uint8Array): Uint8Array {
  const low = Number(key & ((1n << 48n) - 1n));
  const out = new Uint8Array(4 + 6 + 8 + blob.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 1, true);
  for (let i = 0; i < 6; i++) out[4 + i] = Math.floor(low / 2 ** (8 * i)) & 0xff;
  v.setUint32(10, 0, true);
  v.setUint32(14, blob.length, true);
  out.set(blob, 18);
  return out;
}

describe('games database', () => {
  it('decodes reference entries', () => {
    const refs = decodeRefs(refBlob([[42, 'g1f3', 2700], [7, 'e1h1', 0]]));
    expect(refs).toEqual([
      { gameId: 42, move: uciToMove('g1f3'), elo: 2700 },
      { gameId: 7, move: uciToMove('e1h1'), elo: 0 },
    ]);
  });

  it('finds a position\'s games and their headers', async () => {
    const pos = playSans('e4 e5');
    const key = polyglotKey(pos);
    const name = Number(key >> 51n).toString(16).padStart(4, '0');
    const fake = (async (url: string) => {
      if (url.endsWith(`/r1/${name}.bin`)) return new Response(shard(key, refBlob([[1025, 'g1f3', 2750]])) as BodyInit);
      // Every shard file exists; most hold no positions.
      if (url.includes('/r1/')) return new Response(new Uint8Array(8) as BodyInit);
      if (url.endsWith('/h1/00002.json')) return Response.json({ '1025': ['Carlsen, Magnus', 'Caruana, Fabiano', 2850, 2820, 2018, '1-0', 'Tata Steel'] });
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    const db = new GamesDb('https://refs.example', 'https://games.example', fake);
    const refs = await db.refs(pos);
    expect(refs).toHaveLength(1);
    expect(sanOf(pos, refs[0].move)).toBe('Nf3');
    expect(await db.header(1025)).toMatchObject({ white: 'Carlsen, Magnus', year: 2018, result: '1-0', event: 'Tata Steel' });
    expect(await db.refs(Chess.default())).toEqual([]);
  });
});

// The real headers file, when it has been built on this PC.
const H = 'F:/dev/gamesdb_work/refs_site/h1/00000.json';
describe.runIf(existsSync(H))('the built headers', () => {
  it('has game 1 with players and a result', () => {
    const all = JSON.parse(readFileSync(H, 'utf-8'));
    const g1 = all['1'];
    expect(g1[0]).toBe('Zhang, Zhi');
    expect(g1[5]).toBe('1-0');
  });
});

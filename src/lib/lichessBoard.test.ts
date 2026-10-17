import { describe, expect, it } from 'vitest';
import { readNdjson } from './lichessBoard';

describe('readNdjson', () => {
  it('reads objects split across chunks and skips keep-alive lines', async () => {
    const chunks = ['{"type":"gameFull","id":"ab', 'c"}\n\n', '{"type":"gameState","moves":"e2e4"}\n', '\n'];
    const body = new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
        c.close();
      },
    });
    const got: any[] = [];
    await readNdjson(new Response(body), (o) => got.push(o));
    expect(got).toEqual([
      { type: 'gameFull', id: 'abc' },
      { type: 'gameState', moves: 'e2e4' },
    ]);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playSans } from '$lib/chess/position';
import { polyglotKey } from '$lib/chess/polyglot';
import { GamesDb } from './gamesDb';

// The real reference and games files, when they have been built on this PC.
const WORK = 'F:/dev/gamesdb_work';
const ready = existsSync(`${WORK}/refs_site/r1/meta.json`) && existsSync(`${WORK}/games_site/g1/00000.json`);

const localFetch = (async (url: string) => {
  const path = url.replace('https://refs.local', `${WORK}/refs_site`).replace('https://games.local', `${WORK}/games_site`);
  if (!existsSync(path)) return new Response('missing', { status: 404 });
  return new Response(readFileSync(path) as BodyInit);
}) as unknown as typeof fetch;

describe.runIf(ready)('the built reference games', () => {
  const db = new GamesDb('https://refs.local', 'https://games.local', localFetch);

  for (const line of ['', 'e4', 'e4 e5 Nf3 Nc6 Bb5 a6', 'd4 Nf6 c4 e6 Nc3 Bb4', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'e4 e5 Nf3 Nc6 Bc4 Nf6 O-O']) {
    it(`games for "${line || 'start'}" reach it and play the stored move`, async () => {
      const pos = playSans(line);
      const want = polyglotKey(pos);
      const refs = await db.refs(pos);
      expect(refs.length).toBe(8);
      // Strongest first.
      for (let i = 1; i < refs.length; i++) expect(refs[i - 1].elo).toBeGreaterThanOrEqual(refs[i].elo);
      for (const ref of refs) {
        const g = (await db.game(ref.gameId))!;
        expect(g).toBeDefined();
        const p = g.start.clone();
        let found = false;
        for (const m of g.moves) {
          if (polyglotKey(p) === want) {
            expect(m).toEqual(ref.move);
            found = true;
            break;
          }
          p.play(m);
        }
        expect(found, `game ${ref.gameId}`).toBe(true);
        expect((await db.header(ref.gameId))?.white).toBe(g.white);
        // Model games by people, not engines.
        expect(`${g.event} ${g.white} ${g.black}`).not.toMatch(/TCEC|CCC|Stockfish|Komodo|Leela/i);
        expect(ref.elo).toBeLessThan(2900);
      }
    });
  }
});

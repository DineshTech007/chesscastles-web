// Builds static/data/openings.json from the Lichess chess-openings TSVs (CC0):
// [eco, name, "e4 e5 Nf3 …"] for every named opening, each line checked as legal.
// Run: npx vite-node scripts/build-openings.ts F:/dev/gamesdb_work/openings static/data/openings.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { playSans } from '$lib/chess/position';

const [dir, out] = process.argv.slice(2);
const rows: [string, string, string][] = [];
let bad = 0;
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  for (const line of readFileSync(join(dir, `${f}.tsv`), 'utf-8').split('\n').slice(1)) {
    const [eco, name, pgn] = line.split('\t');
    if (!eco || !name || !pgn) continue;
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/).join(' ');
    try {
      playSans(sans);
      rows.push([eco, name, sans]);
    } catch {
      bad++;
    }
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(rows));
console.log(rows.length, 'openings,', bad, 'skipped');

// Copies the Treasury's rules (src/lib/economy/core.ts) to the API worker, so the website and the server run the very
// same rules (gold, gems, prices, quests). Run after changing core.ts:  node scripts/sync-economy.mjs [api-worker dir]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] ?? join(root, '../knight24/server/api-worker'));
const out = join(target, 'src/economyCore.ts');
if (!existsSync(join(target, 'src'))) {
  console.error(`No API worker at ${target}`);
  process.exit(1);
}
const core = readFileSync(join(root, 'src/lib/economy/core.ts'), 'utf8');
writeFileSync(out, `// A COPY of the website's src/lib/economy/core.ts (chesscastles-web): change it there, then run\n// \`node scripts/sync-economy.mjs\` in the website's folder. Do not edit here.\n${core}`);
console.log(`Wrote ${out}`);

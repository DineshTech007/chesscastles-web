// Adds the winning line (Stockfish's best continuation, up to 7 moves) to each
// lesson moment, so a lesson can play the idea out move by move.
// Run: node scripts/moment-lines.mjs src/lib/coach/data/moments.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const [path, depth = '18'] = process.argv.slice(2);

let waiting;
let ready;
const lines = [];
const sf = require('stockfish')('lite-single', (line) => {
  if (line === 'uciok' && ready) return ready();
  lines.push(line);
  if (waiting && line.startsWith('bestmove')) {
    const w = waiting;
    waiting = undefined;
    w(lines.splice(0));
  }
});
await new Promise((r) => {
  ready = r;
  sf.processCommand('uci');
});
ready = undefined;
const ask = (cmds) =>
  new Promise((resolve) => {
    lines.length = 0;
    waiting = resolve;
    for (const c of cmds) sf.processCommand(c);
  });

const data = JSON.parse(readFileSync(path, 'utf-8'));
let n = 0;
for (const list of Object.values(data)) {
  for (const m of list) {
    const got = await ask([`position fen ${m.fen}`, `go depth ${depth} searchmoves ${m.move}`]);
    let pv = [];
    for (const l of got) {
      const t = l.split(' ');
      if (t[0] === 'info' && t.includes('pv')) pv = t.slice(t.indexOf('pv') + 1);
    }
    // The legend's move first, then the best play for both sides (at most 7 moves in all).
    m.line = pv[0] === m.move ? pv.slice(0, 7) : [m.move];
    n++;
  }
}
writeFileSync(path, JSON.stringify(data));
console.log('lines for', n, 'moments');
sf.terminate?.();
process.exit(0);

// Checks each endgame lesson position with Stockfish (does it really win, or
// really hold, as the lesson says?) and records a demonstration line.
// Run: node scripts/endgame-lines.mjs src/lib/coach/data/endgames.json
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const [outPath] = process.argv.slice(2);

/** id, position, what the lesson claims (for the side to move unless noted), demo length in plies. */
const POSITIONS = [
  ['queen-mate', '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', 'win', 40],
  ['rook-mate', '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', 'win', 60],
  ['rook-ladder', '8/8/3k4/8/8/8/8/R3K2R w - - 0 1', 'win', 30],
  ['ladder-final', '4k3/R7/8/8/8/8/8/4K2R w - - 0 1', 'win', 1],
  ['king-in-front', '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 'win', 14],
  ['opposition-draw', '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1', 'draw', 10],
  ['opposition-win', '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1', 'win-white', 16],
  ['square-inside', '7k/8/8/p7/8/8/3K4/8 w - - 0 1', 'draw', 10],
  ['square-outside', '7k/8/8/p7/8/8/6K1/8 w - - 0 1', 'win-black', 10],
  ['outside-passer', '8/5kpp/8/P7/8/8/5KPP/8 w - - 0 1', 'win', 24],
  ['lucena', '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', 'win', 24],
  ['philidor', '4k3/8/r7/4PK2/8/8/8/1R6 b - - 0 1', 'draw', 16],
  ['rook-behind', 'r7/5pk1/6p1/P7/8/6P1/5PK1/R7 w - - 0 1', 'win', 16],
  ['queen-vs-pawn', '6K1/8/8/8/8/2k5/3p4/7Q w - - 0 1', 'win', 24],
  // A theoretical win in 30+ moves: beyond this search, so no demo line, practice only.
  ['bishop-knight', '8/8/8/4k3/8/8/8/2B1KN2 w - - 0 1', 'better', 0],
];

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
/** Best move and score (for the side to move; mate n = 100000 - n) after `moves` from fen. */
async function search(fen, moves, depth) {
  const got = await ask([`position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`, `go depth ${depth}`]);
  let score = 0;
  for (const l of got) {
    const t = l.split(' ');
    if (t[0] !== 'info' || !t.includes('score')) continue;
    const i = t.indexOf('score');
    const v = Number(t[i + 2]);
    score = t[i + 1] === 'mate' ? (v > 0 ? 100000 - v : -100000 - v) : v;
  }
  const best = got.find((l) => l.startsWith('bestmove'))?.split(' ')[1];
  return { best: best && best !== '(none)' ? best : undefined, score };
}

const out = {};
let bad = 0;
for (const [id, fen, claim, plies] of POSITIONS) {
  const first = await search(fen, [], 24);
  const whiteToMove = fen.split(' ')[1] === 'w';
  const forWhite = whiteToMove ? first.score : -first.score;
  const ok =
    claim === 'win' ? first.score >= 400 :
    claim === 'win-white' ? forWhite >= 400 :
    claim === 'win-black' ? forWhite <= -400 :
    claim === 'draw' ? Math.abs(first.score) <= 80 :
    claim === 'better' ? first.score >= 100 : false;
  if (!ok) bad++;
  const line = [];
  for (let i = 0; i < plies; i++) {
    const r = await search(fen, line, 16);
    if (!r.best) break;
    line.push(r.best);
  }
  out[id] = { fen, claim, score: first.score, ok, line };
  console.log(id.padEnd(16), claim.padEnd(10), String(first.score).padStart(7), ok ? 'OK' : 'WRONG', line.length, 'plies');
}
writeFileSync(outPath, JSON.stringify(out));
console.log(bad ? `${bad} positions do not match their claim` : 'all positions match their claims');
sf.terminate?.();
process.exit(0);

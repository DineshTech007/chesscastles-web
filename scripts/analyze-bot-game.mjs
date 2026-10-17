// Checks a game against the FIDE bot move by move with Stockfish: how much winning
// chance each move gave away, both sides' accuracy, and the bot's biggest mistakes
// (to see whether it plays like its rating).
// Run: node scripts/analyze-bot-game.mjs game.json [depth]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { parseUci } from 'chessops/util';

const require = createRequire(import.meta.url);
const [gamePath, depthArg] = process.argv.slice(2);
const depth = Number(depthArg) || 14;
const game = JSON.parse(readFileSync(gamePath, 'utf8'));

let waiting;
const lines = [];
const sf = require('stockfish')('lite-single', (line) => {
  lines.push(line);
  if (waiting && line.startsWith('bestmove')) {
    const w = waiting;
    waiting = undefined;
    w(lines.splice(0));
  }
});
sf.processCommand('uci');
const ask = (cmds) => new Promise((resolve) => { lines.length = 0; waiting = resolve; for (const c of cmds) sf.processCommand(c); });
async function evalPos(moves) {
  // Castling is saved king-takes-rook (e1h1); Stockfish wants the king's own square (e1g1).
  const CASTLE = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
  const uci = moves.map((u) => CASTLE[u] ?? u);
  const got = await ask([`position fen ${game.startFen}${uci.length ? ` moves ${uci.join(' ')}` : ''}`, `go depth ${depth}`]);
  let score = 0;
  for (const l of got) {
    const t = l.split(' ');
    if (t[0] !== 'info' || !t.includes('score')) continue;
    const i = t.indexOf('score');
    const v = Number(t[i + 2]);
    score = t[i + 1] === 'mate' ? (v > 0 ? 3000 - v : -3000 - v) : v;
  }
  return { score: moves.length % 2 === 0 ? score : -score, best: got.find((l) => l.startsWith('bestmove'))?.split(' ')[1] };
}
const win = (cp) => 100 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));
const accuracy = (drop) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));

const botSide = game.userSide === 'white' ? 'black' : 'white';
const pos = Chess.fromSetup(parseFen(game.startFen).unwrap()).unwrap();
let before = await evalPos([]);
const rows = [];
for (let i = 0; i < game.uci.length; i++) {
  const side = i % 2 === 0 ? 'white' : 'black';
  const m = parseUci(game.uci[i]);
  const best = before.best && before.best !== '(none)' ? makeSan(pos, parseUci(before.best)) : undefined;
  const san = makeSan(pos, m);
  pos.play(m);
  // A finished game is scored directly (the engine is not asked to search it).
  const after = pos.isCheckmate() ? { score: side === 'white' ? 3000 : -3000 } : pos.isEnd() ? { score: 0 } : await evalPos(game.uci.slice(0, i + 1));
  const sign = side === 'white' ? 1 : -1;
  rows.push({ ply: i, side, san, best, cpBefore: sign * before.score, drop: Math.max(0, win(sign * before.score) - win(sign * after.score)) });
  before = after;
}
for (const s of ['white', 'black']) {
  const mine = rows.filter((r) => r.side === s);
  const acc = mine.reduce((t, r) => t + accuracy(r.drop), 0) / mine.length;
  const n = (lo, hi = 101) => mine.filter((r) => r.drop >= lo && r.drop < hi).length;
  console.log(`${s}${s === botSide ? ` (BOT ${game.opponentRating})` : ' (player)'}: accuracy ${acc.toFixed(1)}% · inaccuracies ${n(10, 20)} · mistakes ${n(20, 30)} · blunders ${n(30)}`);
}
console.log('\nBot moves that gave away 10%+ winning chance:');
for (const r of rows.filter((r) => r.side === botSide && r.drop >= 10)) {
  console.log(`  ${Math.floor(r.ply / 2) + 1}${r.side === 'white' ? '.' : '...'} ${r.san}  (-${r.drop.toFixed(0)}%, best ${r.best}, eval before ${(r.cpBefore / 100).toFixed(1)})`);
}
// The evaluation after every move (from White's side), to see where the game turned.
if (process.env.CURVE) {
  const evalAfter = (k) => (k + 1 < rows.length ? rows[k + 1].cpBefore * (rows[k + 1].side === 'white' ? 1 : -1) : rows[k].side === 'white' ? 3000 : -3000);
  console.log('\nEval after each move (White, in pawns):');
  console.log(rows.map((r, k) => `${r.ply % 2 ? '' : `${Math.floor(r.ply / 2) + 1}.`}${r.san}(${(evalAfter(k) / 100).toFixed(1)})`).join(' '));
}
process.exit(0);

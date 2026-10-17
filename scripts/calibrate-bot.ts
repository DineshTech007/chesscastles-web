// Scores, on positions from real rated games (scripts/calibrate-positions.ts),
// the move the player chose, Maia-3's predictions at several ratings and the
// weakened Stockfish the bot used before, so the bot's settings can be chosen
// to play like real players of each rating. Each move's cost is how much
// winning chance it gives away (Stockfish, depth 12).
// Run: npx vite-node scripts/calibrate-bot.ts positions.json out.json <dir with onnxruntime-node> <maia3.onnx>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { parseUci } from 'chessops/util';
import { fenOf, positionFromFen } from '$lib/chess/position';
import { boardTokens, maiaUci, mirrorFen } from '$lib/engine/maia';

const [posPath, outPath, ortDir, modelPath] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const ort = createRequire(`${ortDir}/index.js`)('onnxruntime-node');
const session = await ort.InferenceSession.create(modelPath);
const MOVES: Record<string, string> = JSON.parse(readFileSync('static/maia/moves.json', 'utf8'));
const INDEX = Object.fromEntries(Object.entries(MOVES).map(([i, u]) => [u, Number(i)]));
export const ELOS = [1100, 1300, 1500, 1700, 1900, 2100, 2300, 2500, 2700];

const mirrorUci = (u: string) => u[0] + String(9 - Number(u[1])) + u[2] + String(9 - Number(u[3])) + u.slice(4);

function legalMoves(pos: Chess): NormalMove[] {
  const out: NormalMove[] = [];
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      const promo = pos.board.get(from)?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0);
      for (const promotion of promo ? (['queen', 'knight', 'rook', 'bishop'] as const) : [undefined]) {
        const m: NormalMove = promotion ? { from, to, promotion } : { from, to };
        if (pos.isLegal(m)) out.push(m);
      }
    }
  }
  return out;
}

/** Maia's probability for each legal move (standard UCI, castling as e1g1). */
async function policy(pos: Chess, elo: number, oppo: number): Promise<[string, number][]> {
  const black = pos.turn === 'black';
  const fen = black ? mirrorFen(fenOf(pos)) : fenOf(pos);
  const out = await session.run({
    tokens: new ort.Tensor('float32', boardTokens(fen), [1, 64, 12]),
    elo_self: new ort.Tensor('float32', Float32Array.from([elo]), [1]),
    elo_oppo: new ort.Tensor('float32', Float32Array.from([oppo]), [1]),
  });
  const logits = out.logits_move.data as Float32Array;
  const legal: [string, number][] = [];
  for (const m of legalMoves(pos)) {
    const u = maiaUci(pos, m);
    const i = INDEX[black ? mirrorUci(u) : u];
    if (i !== undefined) legal.push([u, logits[i]]);
  }
  const max = Math.max(...legal.map((l) => l[1]));
  const exps = legal.map((l) => Math.exp(l[1] - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return legal.map((l, i) => [l[0], exps[i] / sum] as [string, number]).sort((a, b) => b[1] - a[1]);
}

// Stockfish (the same lite build as the website), driven over UCI.
let waiting: ((l: string[]) => void) | undefined;
let ready: (() => void) | undefined;
const lines: string[] = [];
const sf = require('stockfish')('lite-single', (line: string) => {
  if (line === 'uciok' && ready) return ready();
  lines.push(line);
  if (waiting && line.startsWith('bestmove')) {
    const w = waiting;
    waiting = undefined;
    w(lines.splice(0));
  }
});
await new Promise<void>((r) => {
  ready = r;
  sf.processCommand('uci');
});
ready = undefined;
const ask = (cmds: string[]) =>
  new Promise<string[]>((resolve) => {
    lines.length = 0;
    waiting = resolve;
    for (const c of cmds) sf.processCommand(c);
  });
async function search(fen: string, moves: string[], go: string) {
  const got = await ask([`position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`, go]);
  let score = 0;
  for (const l of got) {
    const t = l.split(' ');
    if (t[0] !== 'info' || !t.includes('score')) continue;
    const i = t.indexOf('score');
    const v = Number(t[i + 2]);
    score = t[i + 1] === 'mate' ? (v > 0 ? 3000 - v : -3000 - v) : v;
  }
  return { best: got.find((l) => l.startsWith('bestmove'))?.split(' ')[1], score };
}
const winChance = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));

const positions: { band: number; fen: string; human: string; ply: number; game: number }[] = JSON.parse(readFileSync(posPath, 'utf8'));
const out = [];
const started = Date.now();
for (const [n, p] of positions.entries()) {
  const pos = positionFromFen(p.fen);
  const hm = parseUci(p.human) as NormalMove;
  const human = maiaUci(pos, hm);
  const maia: Record<number, [string, number][]> = {};
  for (const elo of ELOS) maia[elo] = (await policy(pos, elo, elo)).filter(([, q], i) => i < 12 && q >= 0.01).map(([u, q]) => [u, Math.round(q * 1000) / 1000]);

  sf.processCommand('setoption name UCI_LimitStrength value true');
  sf.processCommand(`setoption name UCI_Elo value ${Math.max(1320, p.band)}`);
  const sfMove = (await search(p.fen, [], 'go movetime 700')).best!;
  sf.processCommand('setoption name UCI_LimitStrength value false');

  const root = await search(p.fen, [], 'go depth 13');
  const want = new Set([human, sfMove, root.best!]);
  for (const elo of ELOS) for (const [u, q] of maia[elo].slice(0, 6)) if (q >= 0.04) want.add(u);
  const loss: Record<string, number> = {};
  for (const u of want) {
    const after = await search(p.fen, [u], 'go depth 12');
    loss[u] = Math.round(Math.max(0, winChance(root.score) - winChance(-after.score)) * 1000) / 1000;
  }
  out.push({ band: p.band, ply: p.ply, game: p.game, human, sf: sfMove, best: root.best, score: root.score, loss, maia });
  if (n % 10 === 9) {
    console.log(`${n + 1}/${positions.length} in ${Math.round((Date.now() - started) / 1000)} s`);
    writeFileSync(outPath, JSON.stringify(out));
  }
}
writeFileSync(outPath, JSON.stringify(out));
console.log('done');
sf.terminate?.();
process.exit(0);

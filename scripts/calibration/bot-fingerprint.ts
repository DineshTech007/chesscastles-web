// Castle Calibration, step 3: our FIDE players' own moves on the very positions the real players faced
// (fingerprint.mjs's rows, from move 8 on), chosen by the site's code (maiaPick: Maia-3's candidates, Stockfish's
// check, time pressure, instinct moves, slips, blunder limits) and scored the same way (Stockfish depth 11, the
// winning chance given away), so fingerprint-report.mjs gives the bot's fingerprint next to the real players'.
// Each worker runs Maia (onnxruntime-node) and two Stockfish processes (the bot's and the scorer's), one thread
// each. A worker that stops picks up where it left off.
//   npx vite-node scripts/calibration/bot-fingerprint.ts -- <fp dir> <outDir> <worker> <workers> <onnxruntime-node dir> <maia3.onnx> [perLevel=500]
// Env: SPEED (the bot's search time against the site's, default 0.3: a phone's browser is slower than this PC's
// Stockfish), STRENGTH (JSON, replaces the STRENGTH table to try other settings).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { fenOf, positionFromFen } from '$lib/chess/position';
import { boardTokens, maia, maiaUci, mirrorFen } from '$lib/engine/maia';
import { engine } from '$lib/engine/stockfish';
import { maiaPick, STRENGTH } from '$lib/game/engineMove';
import type { TimeControl } from '$lib/game/fideGame';

const [fpDir, outDir, wArg, nArg, ortDir, modelPath, perArg] = process.argv.slice(2).filter((a) => a !== '--');
const worker = Number(wArg), workers = Number(nArg), PER = Number(perArg ?? 500);
const SPEED = Number(process.env.SPEED ?? 0.3);
const SF = 'C:/dev/tools/stockfish/stockfish/stockfish-windows-x86-64-avx2.exe';
/** The time controls the levels are measured at: a typical blitz and rapid game on the site. */
const TC: Record<string, TimeControl> = { blitz: { minutes: 3, increment: 2 }, rapid: { minutes: 15, increment: 10 } } as Record<string, TimeControl>;
if (process.env.STRENGTH) STRENGTH.splice(0, STRENGTH.length, ...JSON.parse(process.env.STRENGTH));

/** A Stockfish process spoken to line by line. */
function stockfish(hash: number) {
  const p = spawn(SF, [], { stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  let lines: string[] = [];
  let wait: { done: (l: string) => boolean; resolve: (ls: string[]) => void } | undefined;
  p.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      lines.push(l);
      if (wait?.done(l)) {
        const w = wait;
        wait = undefined;
        const got = lines;
        lines = [];
        w.resolve(got);
      }
    }
  });
  const send = (s: string) => p.stdin.write(s + '\n');
  const until = (done: (l: string) => boolean) => new Promise<string[]>((resolve) => (wait = { done, resolve }));
  const ready = (async () => {
    send('uci');
    await until((l) => l === 'uciok');
    send('setoption name Threads value 1');
    send(`setoption name Hash value ${hash}`);
    send('isready');
    await until((l) => l === 'readyok');
  })();
  return { send, until, ready, quit: () => send('quit') };
}

// The bot's Stockfish, answering as the site's engine does (src/lib/engine/stockfish.ts), with SPEED of its time.
const bot = stockfish(16);
await bot.ready;
const e = engine as unknown as Record<string, unknown>;
e.play = async (fen: string, elo: number, ms = 700) => {
  bot.send('setoption name UCI_LimitStrength value true');
  bot.send(`setoption name UCI_Elo value ${Math.min(3190, Math.max(1320, elo))}`);
  bot.send('setoption name MultiPV value 1');
  bot.send(`position fen ${fen}`);
  bot.send(`go movetime ${Math.max(20, Math.round(ms * SPEED))}`);
  const ls = await bot.until((l) => l.startsWith('bestmove'));
  const uci = ls[ls.length - 1].split(' ')[1];
  return uci && uci !== '(none)' ? uci : null;
};
e.scoreMoves = async (fen: string, moves: string[], ms = 600) => {
  const scores = new Map<string, number>();
  if (!moves.length) return scores;
  bot.send('setoption name UCI_LimitStrength value false');
  bot.send(`setoption name MultiPV value ${moves.length}`);
  bot.send(`position fen ${fen}`);
  bot.send(`go movetime ${Math.max(20, Math.round(ms * SPEED))} searchmoves ${moves.join(' ')}`);
  for (const line of await bot.until((l) => l.startsWith('bestmove'))) {
    if (!line.startsWith('info')) continue;
    const t = line.split(' ');
    const at = (k: string) => t.indexOf(k);
    if (at('pv') >= 0 && at('score') >= 0) {
      const v = Number(t[at('score') + 2]);
      scores.set(t[at('pv') + 1], t[at('score') + 1] === 'mate' ? (v > 0 ? 3000 - v : -3000 - v) : v);
    }
  }
  bot.send('setoption name MultiPV value 1');
  return scores;
};

// Maia-3 on onnxruntime-node, answering as the site's Maia does (src/lib/engine/maia.ts).
const ort = createRequire(`${ortDir}/index.js`)('onnxruntime-node');
const session = await ort.InferenceSession.create(modelPath, { intraOpNumThreads: 1, interOpNumThreads: 1 });
const MOVES: Record<string, string> = JSON.parse(readFileSync('static/maia/moves.json', 'utf8'));
const INDEX: Record<string, number> = Object.fromEntries(Object.entries(MOVES).map(([i, u]) => [u, Number(i)]));
const mirrorUci = (u: string) => u[0] + String(9 - Number(u[1])) + u[2] + String(9 - Number(u[3])) + u.slice(4);
(maia as unknown as Record<string, unknown>).policy = async (pos: Chess, elo: number, oppo = elo) => {
  const black = pos.turn === 'black';
  const fen = black ? mirrorFen(fenOf(pos)) : fenOf(pos);
  const out = await session.run({
    tokens: new ort.Tensor('float32', boardTokens(fen), [1, 64, 12]),
    elo_self: new ort.Tensor('float32', Float32Array.from([elo]), [1]),
    elo_oppo: new ort.Tensor('float32', Float32Array.from([oppo]), [1]),
  });
  const logits = out.logits_move.data as Float32Array;
  const legal: { move: NormalMove; logit: number }[] = [];
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      const promos = pos.board.get(from)?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0) ? (['queen', 'knight', 'rook', 'bishop'] as const) : [undefined];
      for (const promotion of promos) {
        const m: NormalMove = promotion ? { from, to, promotion } : { from, to };
        if (!pos.isLegal(m)) continue;
        const u = maiaUci(pos, m);
        const i = INDEX[black ? mirrorUci(u) : u];
        if (i !== undefined) legal.push({ move: m, logit: logits[i] });
      }
    }
  }
  const max = Math.max(...legal.map((l) => l.logit));
  const exps = legal.map((l) => Math.exp(l.logit - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return legal.map((l, i) => ({ move: l.move, p: exps[i] / sum })).sort((a, b) => b.p - a.p);
};

// The scorer: the same measure as fingerprint.mjs (depth 11, mate as ±(10000 − 10 × moves)).
const scorer = stockfish(64);
await scorer.ready;
async function evaluate(fen: string) {
  scorer.send(`position fen ${fen}`);
  scorer.send('go depth 11');
  let score = 0;
  for (const l of await scorer.until((l) => l.startsWith('bestmove'))) {
    const m = / score (cp|mate) (-?\d+)/.exec(l);
    if (m && l.includes(' depth ')) score = m[1] === 'cp' ? Number(m[2]) : Math.sign(Number(m[2])) * (10000 - Math.abs(Number(m[2])) * 10);
  }
  return score;
}
const wc = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));

/** A repeatable random number source, one per position. */
function seeded(text: string) {
  let a = 0;
  for (let i = 0; i < text.length; i++) a = (Math.imul(a, 31) + text.charCodeAt(i)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Row = { g: number; type: string; level: number; ply: number; fen: string; best: string; score: number; wc: number; prevLoss?: number; mover: string };
const all: Row[] = readdirSync(fpDir)
  .filter((f) => /^moves-\d+\.jsonl$/.test(f))
  .flatMap((f) => readFileSync(`${fpDir}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row))
  .filter((r) => TC[r.type]);
// PER positions per type and level, a fixed random choice (the same for every worker and every run).
const groups = new Map<string, Row[]>();
for (const r of all) groups.set(`${r.type}:${r.level}`, [...(groups.get(`${r.type}:${r.level}`) ?? []), r]);
const chosen: Row[] = [];
for (const [, rows] of [...groups].sort()) {
  const rnd = seeded(`${rows[0].type}:${rows[0].level}`);
  const order = rows.map((r) => ({ r, k: rnd() })).sort((a, b) => a.k - b.k);
  chosen.push(...order.slice(0, PER).map((x) => x.r));
}
const mine = chosen.filter((_, i) => i % workers === worker);
mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/moves-${worker}.jsonl`;
const key = (r: { g: number; ply: number; type: string }) => `${r.type}:${r.g}:${r.ply}`;
const done = new Set(existsSync(outPath) ? readFileSync(outPath, 'utf8').split('\n').filter(Boolean).map((l) => key(JSON.parse(l))) : []);

const started = Date.now();
let n = 0;
for (const r of mine) {
  if (done.has(key(r))) continue;
  const pos = positionFromFen(r.fen);
  if (!pos) continue;
  const pick = await maiaPick(pos, r.level, r.level, TC[r.type], seeded(key(r)));
  if (!pick) continue;
  const uci = maiaUci(pos, pick.move);
  const after = pos.clone();
  after.play(pick.move);
  const loss = after.isCheckmate() ? 0 : Math.max(0, wc(r.score) - wc(-(await evaluate(fenOf(after)))));
  const row = { g: r.g, type: r.type, level: r.level, ply: r.ply, human: uci, best: r.best, loss: +loss.toFixed(4), wc: r.wc, prevLoss: r.prevLoss, mover: r.mover, rating: r.level };
  appendFileSync(outPath, JSON.stringify(row) + '\n');
  if (++n % 100 === 0) console.log(`worker ${worker}: ${n + done.size}/${mine.length}, ${Math.round((Date.now() - started) / 1000)} s`);
}
bot.quit();
scorer.quit();
console.log(`worker ${worker}: done (${mine.length} positions)`);
process.exit(0);

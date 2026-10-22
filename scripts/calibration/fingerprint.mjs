// Castle Calibration, step 2: every position of the sampled real games (sample-lumbra.mjs) from move 8 (out of the
// book) to move 40, evaluated by Stockfish, and what each real move cost: the winning chance it gave away (as
// Lichess counts it), whether it was Stockfish's choice, the opponent's previous move's cost (to see who punishes).
// One worker of several (each its own Stockfish, one thread); a worker that stops picks up where it left off.
//   node scripts/calibration/fingerprint.mjs <sample.jsonl> <outDir> <worker> <workers> [depth=11] [stockfish.exe]
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Chess } from 'chessops/chess';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';

const [samplePath, outDir, wArg, nArg, depthArg, sfPath] = process.argv.slice(2);
const worker = Number(wArg), workers = Number(nArg), depth = Number(depthArg ?? 11);
const SF = sfPath ?? 'F:/dev/tools/stockfish/stockfish/stockfish-windows-x86-64-avx2.exe';
const FIRST_PLY = 16, LAST_PLY = 80;
/** At most this many games per type and level (env MAXPER; classical half), the first of the sample's random order. */
const MAXPER = Number(process.env.MAXPER ?? 150);
mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/moves-${worker}.jsonl`;
const donePath = `${outDir}/done-${worker}.txt`;
const done = new Set(existsSync(donePath) ? readFileSync(donePath, 'utf8').split('\n').filter(Boolean) : []);
const counts = {};
const games = readFileSync(samplePath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l, i) => ({ i, ...JSON.parse(l) }))
  .filter((g) => {
    const k = `${g.type}:${g.level}`;
    counts[k] = (counts[k] ?? 0) + 1;
    return counts[k] <= (g.type === 'classical' ? Math.ceil(MAXPER / 2) : MAXPER);
  })
  .filter((g) => g.i % workers === worker);

// Stockfish over UCI.
const sf = spawn(SF, [], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '';
let waiter;
sf.stdout.on('data', (d) => {
  buf += d.toString();
  let k;
  while ((k = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, k).trim();
    buf = buf.slice(k + 1);
    waiter?.(line);
  }
});
const send = (s) => sf.stdin.write(s + '\n');
function until(test) {
  return new Promise((res) => {
    const seenLines = [];
    waiter = (line) => {
      seenLines.push(line);
      if (test(line)) {
        waiter = undefined;
        res(seenLines);
      }
    };
  });
}
send('uci');
await until((l) => l === 'uciok');
send('setoption name Threads value 1');
send('setoption name Hash value 64');
send('isready');
await until((l) => l === 'readyok');

/** The score (centipawns, side to move; mate as ±(10000 − plies)) and best move at a position. */
async function evaluate(fen) {
  send(`position fen ${fen}`);
  send(`go depth ${depth}`);
  const lines = await until((l) => l.startsWith('bestmove'));
  let score = 0;
  for (const l of lines) {
    const m = / score (cp|mate) (-?\d+)/.exec(l);
    if (m && l.includes(` depth `)) score = m[1] === 'cp' ? Number(m[2]) : Math.sign(Number(m[2])) * (10000 - Math.abs(Number(m[2])) * 10);
  }
  const best = lines[lines.length - 1].split(' ')[1];
  return { score, best };
}
/** Lichess's winning chance for a score (side to move), 0 to 1. */
const wc = (cp) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));

let n = 0;
const started = Date.now();
for (const g of games) {
  const key = String(g.i);
  if (done.has(key)) continue;
  const pos = Chess.default();
  const rows = [];
  const evals = [];
  try {
    for (let ply = 0; ply < Math.min(g.san.length, LAST_PLY + 1); ply++) {
      const move = parseSan(pos, g.san[ply]);
      if (!move) break;
      if (ply >= FIRST_PLY) {
        const fen = makeFen(pos.toSetup());
        const e = await evaluate(fen);
        evals[ply] = e;
        rows.push({ ply, fen, human: makeUci(move), best: e.best, score: e.score });
      }
      pos.play(move);
      if (pos.isEnd()) break;
    }
    // A move's cost: the winning chance at its position (best play) minus what was left after it (the next
    // position's score, from the mover's side). The last evaluated position has no next one.
    const outRows = [];
    for (let k = 0; k + 1 < rows.length; k++) {
      const r = rows[k], next = rows[k + 1];
      if (next.ply !== r.ply + 1) break;
      const before = wc(r.score), after = wc(-next.score);
      outRows.push({ ...r, loss: Math.max(0, +(before - after).toFixed(4)), wc: +before.toFixed(4) });
    }
    for (let k = 1; k < outRows.length; k++) outRows[k].prevLoss = outRows[k - 1].loss;
    const lines = outRows.map((r) => JSON.stringify({ g: g.i, type: g.type, level: g.level, ...r, mover: r.ply % 2 === 0 ? 'white' : 'black', rating: r.ply % 2 === 0 ? g.w : g.b }));
    if (lines.length) appendFileSync(outPath, lines.join('\n') + '\n');
  } catch (e) {
    console.log('skipped game', g.i, String(e).slice(0, 80));
  }
  appendFileSync(donePath, key + '\n');
  n++;
  if (n % 20 === 0) console.log(`worker ${worker}: ${n + done.size}/${games.length} games, ${Math.round((Date.now() - started) / 1000)} s`);
}
send('quit');
console.log(`worker ${worker}: done (${games.length} games)`);

// Audits the FIDE-level opponents' play in every stored game against them: each bot move is
// checked by Stockfish, and the dubious decisions a player would notice are listed per game:
// a win thrown away into a draw (repetition, stalemate, fifty moves, bare kings), a big
// blunder, a won position shuffled without progress, an underpromotion, a loss on time.
//   node scripts/bot-audit.mjs <games.json from D1> [--depth 10] [--limit N]
// Writes reports/bot-audit.md and reports/bot-audit.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DEPTH = Number(flag('--depth', 10));
const LIMIT = Number(flag('--limit', 0));
const rows = JSON.parse(readFileSync(args[0], 'utf8'))[0].results;
const require = createRequire(import.meta.url);

let waiting;
let ready;
let lines = [];
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
sf.processCommand('setoption name Hash value 32');
const ask = (cmds) =>
  new Promise((r) => {
    lines = [];
    waiting = r;
    for (const c of cmds) sf.processCommand(c);
  });
/** Centipawns for the side to move (mate as ±10000 − n), and the best move. */
async function evalFen(fen) {
  const got = await ask([`position fen ${fen}`, `go depth ${DEPTH}`]);
  let score = 0;
  let best;
  for (const l of got) {
    const t = l.split(' ');
    if (t[0] === 'info' && t.includes('score')) {
      const i = t.indexOf('score');
      const v = Number(t[i + 2]);
      score = t[i + 1] === 'mate' ? (v > 0 ? 10000 - v : -10000 - v) : v;
      best = t[t.indexOf('pv') + 1];
    }
  }
  return { score, best };
}

const DRAW_REASONS = /three times|Stalemate|50 moves|cannot checkmate|Neither side/i;
const out = [];
let done = 0;
const t0 = Date.now();
for (const r of LIMIT ? rows.slice(0, LIMIT) : rows) {
  const g = JSON.parse(r.data);
  if (!Array.isArray(g.uci) || g.uci.length < 2 || !g.opponentRating) continue;
  const bot = g.userSide === 'white' ? 'black' : 'white';
  const botResult = g.result === '½-½' || g.result === '1/2-1/2' ? 'draw' : (g.result === '1-0') === (bot === 'white') ? 'win' : g.result === '*' ? 'unfinished' : 'loss';
  const pos = g.startFen ? Chess.fromSetup(parseFen(g.startFen).unwrap()).unwrap() : Chess.default();
  const botEvals = []; // the bot's eval (its point of view) before each of its moves
  const blunders = [];
  const underpromos = [];
  let totalLoss = 0;
  let botMoves = 0;
  let prev;
  for (let i = 0; i < g.uci.length; i++) {
    const m = parseUci(g.uci[i]);
    if (!m || !pos.isLegal(m)) break;
    const mover = pos.turn;
    if (mover === bot) {
      const before = prev ?? (await evalFen(makeFen(pos.toSetup())));
      const san = makeSan(pos, m);
      const bestSan = before.best ? makeSan(pos, parseUci(before.best)) : '?';
      pos.play(m);
      const afterSide = await evalFen(makeFen(pos.toSetup()));
      const after = -afterSide.score; // back to the bot's point of view
      prev = undefined;
      const loss = Math.max(0, Math.min(1000, before.score - after));
      totalLoss += loss;
      botMoves++;
      botEvals.push({ ply: i + 1, san, before: before.score, after });
      if (before.score - after >= 300 && before.score > -300) blunders.push(`${Math.floor(i / 2) + 1}${mover === 'white' ? '.' : '...'}${san} (best ${bestSan}): ${(before.score / 100).toFixed(1)} → ${(after / 100).toFixed(1)}`);
      if (m.promotion && m.promotion !== 'queen') underpromos.push(`${Math.floor(i / 2) + 1}${mover === 'white' ? '.' : '...'}${san}`);
      // The eval after the bot's move is the eval before the player's move; the player's reply gives the next "before".
    } else {
      pos.play(m);
      prev = undefined;
    }
  }
  const last = botEvals.slice(-12);
  const maxLate = Math.max(-99999, ...last.map((e) => e.before));
  const threwWin = botResult === 'draw' && DRAW_REASONS.test(g.reason ?? '') && maxLate >= 300;
  // Shuffling: 20 bot moves in a row with the bot at +8 or better and no progress (the eval never rises by 100).
  let shuffle = 0;
  let run = 0;
  for (let k = 1; k < botEvals.length; k++) {
    if (botEvals[k].before >= 800 && botEvals[k].before <= botEvals[k - 1].before + 100) run++;
    else run = 0;
    shuffle = Math.max(shuffle, run);
  }
  const timeLoss = /opponent ran out of time/i.test(g.reason ?? '');
  const flags = [];
  if (threwWin) flags.push(`threw a win: ${g.reason} with the bot at +${(maxLate / 100).toFixed(1)} in its last 12 moves`);
  if (blunders.length) flags.push(`${blunders.length} big blunder${blunders.length > 1 ? 's' : ''}: ${blunders.slice(0, 3).join('; ')}`);
  if (shuffle >= 20) flags.push(`shuffled ${shuffle} moves in a row while winning (+8 or more) without progress`);
  if (underpromos.length) flags.push(`underpromotion: ${underpromos.join(', ')}`);
  if (timeLoss) flags.push(`lost on time${new Date(g.playedAt) < new Date('2026-10-19T12:30:00Z') ? ' (before the 19 Oct clock fix)' : ''}`);
  out.push({ id: g.id, uid: r.uid, played: new Date(g.playedAt).toISOString().slice(0, 16), rating: g.opponentRating, tc: g.timeControl, bot, botResult, reason: g.reason, plies: g.uci.length, avgLoss: botMoves ? Math.round(totalLoss / botMoves) : 0, blunders: blunders.length, botMoves, flags });
  done++;
  if (done % 10 === 0) console.log(`${done} games, ${Math.round((Date.now() - t0) / 1000)} s`);
}
mkdirSync('reports', { recursive: true });
writeFileSync('reports/bot-audit.json', JSON.stringify(out, null, 1));
const by = (f) => out.filter(f);
const flagged = by((g) => g.flags.length);
const buckets = [...new Set(out.map((g) => g.rating))].sort((a, b) => a - b);
const md = [
  `# FIDE-level opponents: audit of ${out.length} stored games (${new Date().toISOString().slice(0, 10)}, Stockfish depth ${DEPTH})`, '',
  'Every bot move checked. A "big blunder" loses 3 pawns or more of evaluation from a position that was not already lost; "threw a win" is a draw by repetition, stalemate, fifty moves or bare kings with the bot at +3 or better in its last twelve moves; "shuffled" is twenty bot moves in a row at +8 or better without progress.', '',
  '| Bot rating | Games | Bot W/D/L | Avg loss per move (cp) | Big blunders per game | Games with a dubious decision |', '|---|---|---|---|---|---|',
  ...buckets.map((r) => {
    const gs = by((g) => g.rating === r);
    const w = gs.filter((g) => g.botResult === 'win').length;
    const d = gs.filter((g) => g.botResult === 'draw').length;
    const l = gs.filter((g) => g.botResult === 'loss').length;
    return `| ${r} | ${gs.length} | ${w}/${d}/${l} | ${Math.round(gs.reduce((a, g) => a + g.avgLoss, 0) / Math.max(1, gs.length))} | ${(gs.reduce((a, g) => a + g.blunders, 0) / Math.max(1, gs.length)).toFixed(2)} | ${gs.filter((g) => g.flags.length).length} |`;
  }),
  '', `## Dubious decisions (${flagged.length} games)`, '',
  ...flagged.sort((a, b) => b.rating - a.rating).map((g) => `- **${g.id.slice(0, 8)}** · bot ${g.rating} as ${g.bot} vs ${g.uid.replace('lichess:', '')} · ${g.tc} · ${g.played} · bot ${g.botResult} (${g.reason}) · ${g.plies} plies\n  - ${g.flags.join('\n  - ')}`),
].join('\n');
writeFileSync('reports/bot-audit.md', md);
console.log(`${out.length} games audited, ${flagged.length} with a dubious decision → reports/bot-audit.md`);
// Last: the engine's quit ends the process.
sf.processCommand('quit');

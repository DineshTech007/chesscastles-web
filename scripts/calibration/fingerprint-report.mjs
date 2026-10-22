// Castle Calibration: the fingerprint of real FIDE players at each level and type (from fingerprint.mjs), the
// targets the FIDE-level players must match. Costs are winning chance given away (Lichess's measure), per move.
//   node scripts/calibration/fingerprint-report.mjs <dir with moves-*.jsonl> [out.json]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const [dir, outJson] = process.argv.slice(2);
const rows = readdirSync(dir)
  .filter((f) => /^moves-\d+\.jsonl$/.test(f))
  .flatMap((f) => readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));

/** The measures for a set of moves. */
export function measure(ms) {
  const n = ms.length;
  if (!n) return undefined;
  const contested = ms.filter((m) => m.wc > 0.1 && m.wc < 0.9);
  const avg = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : NaN);
  const share = (a, f) => (a.length ? a.filter(f).length / a.length : NaN);
  const punishable = ms.filter((m) => (m.prevLoss ?? 0) >= 0.2 && m.wc > 0.5);
  const winning = ms.filter((m) => m.wc >= 0.85 && m.wc < 0.99);
  return {
    moves: n,
    games: new Set(ms.map((m) => m.g)).size,
    /** Average winning chance given away a move (all moves, then in undecided positions). */
    loss: avg(ms, (m) => m.loss),
    lossContested: avg(contested, (m) => m.loss),
    /** Stockfish's own choice. */
    top1: share(ms, (m) => m.human === m.best),
    /** Per 40 of the player's moves. */
    inaccuracies40: share(ms, (m) => m.loss >= 0.05 && m.loss < 0.1) * 40,
    mistakes40: share(ms, (m) => m.loss >= 0.1 && m.loss < 0.2) * 40,
    blunders40: share(ms, (m) => m.loss >= 0.2) * 40,
    /** After the opponent's blunder (20%+), how often the reply keeps the gain (gives back under 5%). */
    punish: share(punishable, (m) => m.loss < 0.05),
    punishN: punishable.length,
    /** In a winning position (85%+), the average given away (converting). */
    lossWinning: avg(winning, (m) => m.loss),
    /** Middlegame (moves 8-25) and later (26-40). */
    lossEarly: avg(contested.filter((m) => m.ply < 50), (m) => m.loss),
    lossLate: avg(contested.filter((m) => m.ply >= 50), (m) => m.loss),
  };
}

const out = {};
const pct = (x, d = 1) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '');
const num = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '');
for (const type of ['blitz', 'rapid', 'classical']) {
  const levels = [...new Set(rows.filter((r) => r.type === type).map((r) => r.level))].sort((a, b) => a - b);
  if (!levels.length) continue;
  console.log(`\n## ${type}`);
  console.log('| Level | Games | Moves | Loss/move | Loss (undecided) | Best move | Inacc./40 | Mistakes/40 | Blunders/40 | Punish | Loss when winning | Moves 8-25 | Moves 26-40 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const level of levels) {
    // Only the moves of players near the level (both are: the sample keeps games within 100).
    const m = measure(rows.filter((r) => r.type === type && r.level === level));
    out[`${type}:${level}`] = m;
    console.log(`| ${level} | ${m.games} | ${m.moves} | ${pct(m.loss, 2)} | ${pct(m.lossContested, 2)} | ${pct(m.top1)} | ${num(m.inaccuracies40)} | ${num(m.mistakes40)} | ${num(m.blunders40)} | ${pct(m.punish, 0)} (${m.punishN}) | ${pct(m.lossWinning, 2)} | ${pct(m.lossEarly, 2)} | ${pct(m.lossLate, 2)} |`);
  }
}
if (outJson) writeFileSync(outJson, JSON.stringify(out, null, 1));

// Castle Calibration: our FIDE players (bot-fingerprint.ts) next to the real players (fingerprint.mjs), level by
// level, and the real level each bot level plays like (the real level whose loss a move is nearest).
//   node scripts/calibration/fingerprint-report.mjs <bot dir> <bot.json>   (first, for the bot's measures)
//   node scripts/calibration/compare.mjs <real fingerprint.json> <bot.json>
import { readFileSync } from 'node:fs';

const [realPath, botPath] = process.argv.slice(2);
const real = JSON.parse(readFileSync(realPath, 'utf8'));
const bot = JSON.parse(readFileSync(botPath, 'utf8'));
const pct = (x, d = 1) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '');
const num = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '');

/** The real level whose measure `key` is `value` (a straight line fitted through every level), within 900-3000. */
function playsLike(type, key, value) {
  const pts = Object.entries(real)
    .filter(([k]) => k.startsWith(type + ':'))
    .map(([k, m]) => [Number(k.split(':')[1]), m[key]])
    .sort((a, b) => a[0] - b[0]);
  // Loss falls as the level rises, not always smoothly: fit a straight line through all levels.
  const n = pts.length, sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0);
  const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0), sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icept = (sy - slope * sx) / n;
  const level = Math.round((value - icept) / slope / 10) * 10;
  return level < 900 ? '<900' : level > 3000 ? '>3000' : String(level);
}

for (const type of ['blitz', 'rapid']) {
  console.log(`\n## ${type}: real players | our bot`);
  console.log('| Level | Loss/move | Best move | Blunders/40 | Mistakes/40 | Punish | Loss when winning | Plays like (loss · best · blunders) |');
  console.log('|---|---|---|---|---|---|---|---|');
  const levels = [...new Set(Object.keys(real).filter((k) => k.startsWith(type + ':')).map((k) => Number(k.split(':')[1])))].sort((a, b) => a - b);
  for (const level of levels) {
    const r = real[`${type}:${level}`], b = bot[`${type}:${level}`];
    if (!b) continue;
    console.log(
      `| ${level} | ${pct(r.loss, 2)} · ${pct(b.loss, 2)} | ${pct(r.top1)} · ${pct(b.top1)} | ${num(r.blunders40)} · ${num(b.blunders40)} | ${num(r.mistakes40)} · ${num(b.mistakes40)} | ${pct(r.punish, 0)} · ${pct(b.punish, 0)} | ${pct(r.lossWinning, 2)} · ${pct(b.lossWinning, 2)} | ${playsLike(type, 'loss', b.loss)} · ${playsLike(type, 'top1', b.top1)} · ${playsLike(type, 'blunders40', b.blunders40)} |`,
    );
  }
}

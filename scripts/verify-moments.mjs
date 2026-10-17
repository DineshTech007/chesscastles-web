// Keeps the mined moments that make fair lessons, checked with Stockfish:
// - tactics: the legend's move is the engine's choice, wins clearly, and no other move comes close;
// - mates: it is the only mate in the stated number of moves;
// - strategy (outposts, open files, the 7th rank): the move is as good as the engine's best.
// Run: node scripts/verify-moments.mjs in.json out.json [perMotif] [onlyMotif]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const [inPath, outPath, perMotif = '160', only] = process.argv.slice(2);
const PRIORITY = [
  'gukesh', 'anand', 'pragg', 'divya', 'humpy', 'arjun', 'vaishali', 'harika', 'vidit', 'harikrishna', 'nihal', 'carlsen', 'kasparov',
  'fischer', 'tal', 'capablanca', 'morphy', 'alekhine', 'karpov', 'kramnik', 'spassky', 'petrosian', 'botvinnik', 'lasker', 'polgar',
  'houyifan', 'dingliren', 'firouzja', 'caruana', 'nakamura', 'smyslov', 'steinitz',
];
const rank = (legend) => {
  const i = PRIORITY.indexOf(legend);
  return i < 0 ? PRIORITY.length : i;
};
const MATE_IN = { backrank: 1, smothered: 1, mate2: 2, mate3: 3 };
const STRATEGY = new Set(['outpost', 'seventh', 'openfile']);

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

/** Score for the side to move, in centipawns (mate in n = 100000 - n). */
const score = (t) => {
  const i = t.indexOf('score');
  const v = Number(t[i + 2]);
  return t[i + 1] === 'mate' ? (v > 0 ? 100000 - v : -100000 - v) : v;
};
function lastByPv(got) {
  const best = {};
  for (const l of got) {
    const t = l.split(' ');
    if (t[0] !== 'info' || !t.includes('pv')) continue;
    const k = t.includes('multipv') ? t[t.indexOf('multipv') + 1] : '1';
    best[k] = { move: t[t.indexOf('pv') + 1], score: score(t) };
  }
  return best;
}

const all = JSON.parse(readFileSync(inPath, 'utf-8'));
const motifs = [...new Set(all.map((m) => m.motif))].filter((m) => !only || m === only);
const out = [];
for (const motif of motifs) {
  // Legends take turns (fewest pieces first for each), so many legends appear.
  const byLegend = new Map();
  for (const m of all.filter((x) => x.motif === motif).sort((a, b) => rank(a.legend) - rank(b.legend) || a.pieces - b.pieces)) {
    if (!byLegend.has(m.legend)) byLegend.set(m.legend, []);
    byLegend.get(m.legend).push(m);
  }
  const list = [];
  for (let i = 0; list.length < Number(perMotif) && [...byLegend.values()].some((l) => l.length > i); i++)
    for (const l of byLegend.values()) if (l[i] && list.length < Number(perMotif)) list.push(l[i]);

  let kept = 0;
  for (const m of list) {
    let ok = false;
    let extra = {};
    if (STRATEGY.has(motif)) {
      sf.processCommand('setoption name MultiPV value 1');
      const best = lastByPv(await ask([`position fen ${m.fen}`, 'go depth 14']))['1'];
      const mine = lastByPv(await ask([`position fen ${m.fen}`, `go depth 14 searchmoves ${m.move}`]))['1'];
      ok = !!best && !!mine && best.score - mine.score <= 30 && mine.score >= -30 && mine.score <= 300;
      extra = { eval: mine?.score, best: best?.score };
    } else {
      sf.processCommand('setoption name MultiPV value 2');
      const got = lastByPv(await ask([`position fen ${m.fen}`, `go depth ${MATE_IN[motif] ? 18 : 16}`]));
      const first = got['1'];
      const second = got['2'];
      const n = MATE_IN[motif];
      if (n) {
        const mates = (s) => s && s.score >= 100000 - n;
        ok = !!first && first.move === m.move && mates(first) && !mates(second);
      } else {
        ok = !!first && first.move === m.move && first.score >= 200 && (!second || first.score - second.score >= 150);
      }
      extra = { eval: first?.score, second: second?.score ?? null };
    }
    if (ok) {
      out.push({ ...m, ...extra });
      kept++;
    }
  }
  console.log(motif, 'checked', list.length, 'kept', kept);
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
sf.terminate?.();
process.exit(0);

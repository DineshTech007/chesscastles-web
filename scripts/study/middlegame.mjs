// Checks the opening study's middlegame lessons (middlegame.py) with Stockfish,
// the way scripts/masters/check.mjs checks the endgame lessons: each move of
// the strong player is scored (so a student's own move can be judged); where
// the game left the right path the lesson stops before it; moves that were the
// only way to keep the advantage are marked critical.
//
//   node scripts/study/middlegame.mjs check <middlegame.json> <out.json> <shard> <shards>
//   node scripts/study/middlegame.mjs build <work dir> <static/data/study>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const [phase, ...args] = process.argv.slice(2);
const MATE = 100000;
const cap = (s) => Math.max(-2000, Math.min(2000, s));
const band = (s) => (s >= 150 ? 1 : s <= -150 ? -1 : 0);

function engine() {
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
  const ask = (cmds) =>
    new Promise((resolve) => {
      lines.length = 0;
      waiting = resolve;
      for (const c of cmds) sf.processCommand(c);
    });
  const init = new Promise((r) => {
    ready = r;
    sf.processCommand('uci');
  }).then(() => {
    ready = undefined;
    sf.processCommand('setoption name Hash value 64');
  });
  async function search(fen, moves, depth, multipv = 1) {
    await init;
    const got = await ask([`setoption name MultiPV value ${multipv}`, `position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`, `go depth ${depth}`]);
    const out = new Map();
    for (const l of got) {
      const t = l.split(' ');
      if (t[0] !== 'info' || !t.includes('score') || !t.includes('pv')) continue;
      const k = t.includes('multipv') ? Number(t[t.indexOf('multipv') + 1]) : 1;
      const i = t.indexOf('score');
      const v = Number(t[i + 2]);
      out.set(k, { move: t[t.indexOf('pv') + 1], score: t[i + 1] === 'mate' ? (v > 0 ? MATE - v : -MATE - v) : v });
    }
    return [...out.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }
  return { search };
}

if (phase === 'check') {
  const [inPath, outPath, shard, shards] = args;
  const all = JSON.parse(readFileSync(inPath, 'utf8')).filter((_, i) => i % Number(shards) === Number(shard));
  const { search } = engine();
  const out = [];
  let n = 0;
  for (const c of all) {
    n++;
    if (n % 10 === 0) console.log(`${n}/${all.length}, ${out.length} lessons`);
    const plies = [];
    let mine = 0;
    let critical = 0;
    let end = 'cut';
    let i = 0;
    for (i = 0; i < c.moves.length; i++) {
      const played = c.moves[i];
      if (i % 2 === 1) {
        plies.push({ u: played });
        continue;
      }
      const [best, second] = await search(c.fen, c.moves.slice(0, i), 13, 2);
      if (!best) break;
      let after;
      if (played === best.move) after = best.score;
      else if (second && played === second.move) after = second.score;
      else {
        const [reply] = await search(c.fen, c.moves.slice(0, i + 1), 12);
        after = reply ? -reply.score : 0;
      }
      if (band(cap(after)) < band(cap(best.score)) && cap(best.score) - cap(after) >= 150) {
        end = 'error';
        break;
      }
      const only = played === best.move && second && (band(cap(second.score)) < band(cap(best.score)) || cap(best.score) - cap(second.score) >= 250);
      if (only) critical++;
      plies.push({ u: played, e: cap(after), ...(only ? { c: 1 } : {}) });
      mine++;
      if (cap(after) >= 1500 && mine >= 4) {
        end = 'decisive';
        break;
      }
    }
    if (i >= c.moves.length && c.toEnd <= c.moves.length) end = 'end';
    while (plies.length && plies[plies.length - 1].e === undefined) plies.pop();
    if (mine >= 6) {
      const { moves: _m, toEnd: _t, ...rest } = c;
      void _m;
      void _t;
      out.push({ ...rest, plies, critical, end });
    }
  }
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`done ${out.length} lessons from ${all.length}`);
} else if (phase === 'build') {
  const [work, outDir] = args;
  const lessons = readdirSync(join(work, 'middlegame'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(work, 'middlegame', f), 'utf8')));
  mkdirSync(join(outDir, 'middlegame'), { recursive: true });
  const by = {};
  for (const l of lessons) {
    const { opening, ...rest } = l;
    (by[opening] ??= []).push(rest);
  }
  for (const [oid, list] of Object.entries(by)) {
    writeFileSync(join(outDir, 'middlegame', `${oid}.json`), JSON.stringify(list));
    console.log(oid, list.length, 'middlegame lessons');
  }
} else {
  console.log('phase: check | build');
}

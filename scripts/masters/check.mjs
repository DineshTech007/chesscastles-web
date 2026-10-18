// Checks the masters' endgame candidates (from extract.py) with Stockfish and
// turns the best ones into lessons for "Endgames with the masters".
//
//   node scripts/masters/check.mjs start  <candidates.json> <out.json> <shard> <shards>
//     scores every candidate's start position (the teacher to move).
//   node scripts/masters/check.mjs select <candidates.json> <scores dir> <selected.json>
//     keeps the promising ones per teacher, endgame type and goal.
//   node scripts/masters/check.mjs full   <selected.json> <out.json> <shard> <shards>
//     checks every move of the teacher: where the game left the right path the
//     lesson stops before it; moves that were the only way are marked critical;
//     each move keeps its score so the website can judge a student's own move.
//
// Goals: win (the teacher was better and won), squeeze (about level, the
// teacher won anyway) and hold (the teacher was worse and drew).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const [phase, ...args] = process.argv.slice(2);

const MATE = 100000;
const cap = (s) => Math.max(-2000, Math.min(2000, s));
/** -1 lost, 0 about level, 1 winning (centipawns for the side it is given for). */
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
  /** The best `multipv` moves with scores for the side to move (mate in n = 100000 - n). */
  async function search(fen, moves, depth, multipv = 1) {
    await init;
    const got = await ask([
      `setoption name MultiPV value ${multipv}`,
      `position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`,
      `go depth ${depth}`,
    ]);
    const lines = new Map();
    for (const l of got) {
      const t = l.split(' ');
      if (t[0] !== 'info' || !t.includes('score') || !t.includes('pv')) continue;
      const k = t.includes('multipv') ? Number(t[t.indexOf('multipv') + 1]) : 1;
      const i = t.indexOf('score');
      const v = Number(t[i + 2]);
      const score = t[i + 1] === 'mate' ? (v > 0 ? MATE - v : -MATE - v) : v;
      lines.set(k, { move: t[t.indexOf('pv') + 1], score });
    }
    return [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }
  return { search };
}

const shardOf = (list, shard, shards) => list.map((c, i) => [c, i]).filter(([, i]) => i % shards === shard);

if (phase === 'start') {
  const [inPath, outPath, shard, shards] = args;
  const all = JSON.parse(readFileSync(inPath, 'utf8'));
  const { search } = engine();
  const out = [];
  const mine = shardOf(all, Number(shard), Number(shards));
  for (const [c, i] of mine) {
    const [best] = await search(c.fen, [], 12);
    out.push({ i, s: best ? cap(best.score) : 0 });
    if (out.length % 200 === 0) console.log(`${out.length}/${mine.length}`);
  }
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`done ${out.length}`);
} else if (phase === 'select') {
  const [inPath, scoresDir, outPath] = args;
  const all = JSON.parse(readFileSync(inPath, 'utf8'));
  for (const f of readdirSync(scoresDir).filter((f) => f.endsWith('.json'))) {
    for (const { i, s } of JSON.parse(readFileSync(join(scoresDir, f), 'utf8'))) all[i].s0 = s;
  }
  const goalOf = (c) => {
    const won = c.result !== '1/2-1/2';
    if (c.s0 === undefined) return undefined;
    if (won && c.s0 >= 100 && c.s0 <= 700) return 'win';
    if (won && c.s0 > -40 && c.s0 < 100) return 'squeeze';
    if (!won && c.s0 <= -100 && c.s0 >= -500) return 'hold';
    return undefined;
  };
  const oppElo = (c) => (c.color === 'white' ? c.blackElo : c.whiteElo);
  /** Strong opponents, a game played to its end within the lesson, recent games. */
  const rank = (c) => oppElo(c) / 100 + (c.toEnd <= c.moves.length ? 6 : 0) + Math.min(c.year, 2024) / 200;
  const groups = new Map();
  for (const c of all) {
    const goal = goalOf(c);
    if (!goal) continue;
    c.goal = goal;
    const k = `${c.teacher}|${c.cat}|${goal}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const picked = [];
  for (const list of groups.values()) picked.push(...list.sort((a, b) => rank(b) - rank(a)).slice(0, 7));
  writeFileSync(outPath, JSON.stringify(picked));
  const per = {};
  for (const c of picked) per[c.teacher] = (per[c.teacher] ?? 0) + 1;
  console.log(`${picked.length} selected`, per);
} else if (phase === 'full') {
  const [inPath, outPath, shard, shards] = args;
  const all = JSON.parse(readFileSync(inPath, 'utf8'));
  const { search } = engine();
  const out = [];
  const mine = shardOf(all, Number(shard), Number(shards));
  for (const [c] of mine) {
    const plies = [];
    let teacherMoves = 0;
    let critical = 0;
    let end = 'cut';
    let n = 0;
    for (n = 0; n < c.moves.length; n++) {
      const played = c.moves[n];
      if (n % 2 === 1) {
        plies.push({ u: played });
        continue;
      }
      const lines = await search(c.fen, c.moves.slice(0, n), 13, 2);
      if (!lines.length) break;
      const [best, second] = lines;
      let after;
      if (played === best.move) after = best.score;
      else if (second && played === second.move) after = second.score;
      else {
        const [reply] = await search(c.fen, c.moves.slice(0, n + 1), 12);
        after = reply ? -reply.score : 0;
      }
      // The game leaves the right path here: the lesson stops before this move.
      if (band(cap(after)) < band(cap(best.score)) && cap(best.score) - cap(after) >= 150) {
        end = 'error';
        break;
      }
      const only = played === best.move && second && (band(cap(second.score)) < band(cap(best.score)) || cap(best.score) - cap(second.score) >= 250);
      if (only) critical++;
      plies.push({ u: played, e: cap(after), ...(only ? { c: 1 } : {}) });
      teacherMoves++;
      if (c.goal !== 'hold' && cap(after) >= 1500 && teacherMoves >= 4) {
        end = 'decisive';
        n++;
        break;
      }
    }
    if (n >= c.moves.length && c.toEnd <= c.moves.length) end = 'end';
    // Don't end on the opponent's move: the lesson ends with the teacher's.
    while (plies.length && plies[plies.length - 1].e === undefined) plies.pop();
    const enough = teacherMoves >= (c.goal === 'squeeze' ? 8 : 5);
    if (enough) {
      const { moves: _m, ...rest } = c;
      void _m;
      out.push({ ...rest, plies, critical, end });
    }
    if (out.length % 20 === 0) console.log(`${out.length} lessons from ${mine.indexOf(mine.find(([x]) => x === c)) + 1}/${mine.length}`);
  }
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`done ${out.length} of ${mine.length}`);
} else if (phase === 'build') {
  // node scripts/masters/check.mjs build <full dir> <static/data/masters>
  const [fullDir, outDir] = args;
  const { mkdirSync } = await import('node:fs');
  const all = readdirSync(fullDir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(fullDir, f), 'utf8')));
  const CATS = ['pawn', 'rook', 'minor', 'rook-minor', 'rook-vs-minor', 'queen'];
  const PER_CAT = 6;
  const PER_GOAL = 3;
  const teacherMoves = (l) => l.plies.filter((p) => p.e !== undefined).length;
  const oppElo = (l) => (l.color === 'white' ? l.blackElo : l.whiteElo);
  /** Lessons with only-moves to find, a clear ending, a good length and a strong opponent first. */
  const score = (l) => {
    const n = teacherMoves(l);
    return Math.min(l.critical, 4) * 3 + (l.end === 'end' || l.end === 'decisive' ? 4 : 0) + (n >= 6 && n <= 16 ? 3 : 0) + oppElo(l) / 400;
  };
  const difficulty = (l) => Math.min(3, (l.goal === 'win' ? 1 : 2) + (l.critical >= 3 || teacherMoves(l) >= 14 ? 1 : 0));
  const byTeacher = new Map();
  for (const l of all) {
    if (!byTeacher.has(l.teacher)) byTeacher.set(l.teacher, []);
    byTeacher.get(l.teacher).push(l);
  }
  mkdirSync(join(outDir, 'endgames'), { recursive: true });
  const index = { teachers: {} };
  for (const [teacher, list] of byTeacher) {
    const out = [];
    for (const cat of CATS) {
      const goals = {};
      const ranked = list.filter((l) => l.cat === cat).sort((a, b) => score(b) - score(a));
      const picked = [];
      for (const l of ranked) {
        if (picked.length >= PER_CAT) break;
        if ((goals[l.goal] ?? 0) >= PER_GOAL) continue;
        if (picked.some((p) => p.game === l.game)) continue;
        goals[l.goal] = (goals[l.goal] ?? 0) + 1;
        picked.push(l);
      }
      picked.sort((a, b) => difficulty(a) - difficulty(b) || teacherMoves(a) - teacherMoves(b));
      out.push(...picked);
    }
    const lessons = out.map((l) => ({
      game: l.game,
      white: l.white,
      black: l.black,
      whiteElo: l.whiteElo,
      blackElo: l.blackElo,
      event: l.event,
      year: l.year,
      result: l.result,
      color: l.color,
      cat: l.cat,
      ...(l.kind ? { kind: l.kind } : {}),
      goal: l.goal,
      fen: l.fen,
      plies: l.plies,
      critical: l.critical,
      end: l.end,
    }));
    writeFileSync(join(outDir, 'endgames', `${teacher}.json`), JSON.stringify(lessons));
    const cats = {};
    for (const l of lessons) cats[l.cat] = (cats[l.cat] ?? 0) + 1;
    index.teachers[teacher] = { count: lessons.length, cats };
    console.log(`${teacher}: ${lessons.length} lessons`, cats);
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index));
} else {
  console.log('phase: start | select | full | build');
}

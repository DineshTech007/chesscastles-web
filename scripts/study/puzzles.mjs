// Turns the study openings' puzzle candidates (build.py) into checked puzzles.
//
//   node scripts/study/puzzles.mjs check <candidates.json> <out.json> <shard> <shards>
//   node scripts/study/puzzles.mjs scan  <endgames.json> <out.json> <shard> <shards>
//     follows each game's endgame with the engine; where the opponent's move
//     turns a balanced position (+1 at most) into a win (+3 or more), the
//     winning reply becomes a puzzle (checked the same way as above, but the
//     solution is the engine's, so a chance the player missed counts too).
//   node scripts/study/puzzles.mjs build <work dir> <static/data/study>
//
// A puzzle starts with the opponent's move from the game (the mistake), then
// the solver finds the winning move, which must be the one the game's player
// found and the only move that wins (Stockfish, two best lines). The solution
// goes on while every move of the solver stays the only winning one. Levels:
// one move (beginner), two (intermediate), three or more (advanced); a quiet
// first move (not a capture) counts one level harder.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

const require = createRequire(import.meta.url);
const [phase, ...args] = process.argv.slice(2);
const MATE = 100000;
const isMate = (s) => Math.abs(s) > MATE - 1000;

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

/** The only winning move: winning by 2+ pawns, and the second best line is not. */
const unique = (best, second) => best && best.score >= 200 && (!second || (second.score <= 150 && best.score - second.score >= 200) || (isMate(best.score) && !isMate(second.score) && second.score < 400));
/**
 * For the engine's scan of real games: the best move wins (2+ pawns) and is
 * clearly the best: the second best doesn't win, or is 2.5+ pawns worse, or
 * only the best mates.
 */
const clearlyBest = (best, second) =>
  best && best.score >= 200 && (!second || second.score <= 150 || best.score - second.score >= 250 || (isMate(best.score) && !isMate(second.score)));

function boardOf(fen) {
  const rows = fen.split(' ')[0].split('/');
  const sq = {};
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else sq[`${'abcdefgh'[f++]}${8 - r}`] = ch;
    }
  });
  return sq;
}
/** Endgame: no queens and at most a rook and a minor piece each, or very few pieces in all. */
function phaseOf(fen) {
  const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
  const val = { n: 3, b: 3, r: 5, q: 9 };
  let w = 0;
  let k = 0;
  for (const c of pieces) {
    const v = val[c.toLowerCase()];
    if (!v) continue;
    if (c === c.toUpperCase()) w += v;
    else k += v;
  }
  const queens = /q/i.test(pieces);
  return (!queens && w <= 8 && k <= 8) || w + k <= 13 ? 'endgame' : 'middlegame';
}
/** The position after the opponent's first move, as FEN-less board for the capture test. */
function playOn(sq, uci) {
  const b = { ...sq };
  const piece = b[uci.slice(0, 2)];
  delete b[uci.slice(0, 2)];
  b[uci.slice(2, 4)] = uci[4] ? (piece === piece.toUpperCase() ? uci[4].toUpperCase() : uci[4]) : piece;
  return b;
}

if (phase === 'check') {
  const [inPath, outPath, shard, shards] = args;
  const all = JSON.parse(readFileSync(inPath, 'utf8')).filter((_, i) => i % Number(shards) === Number(shard));
  const { search } = engine();
  const out = [];
  let n = 0;
  for (const c of all) {
    n++;
    if (n % 100 === 0) console.log(`${n}/${all.length}, ${out.length} puzzles`);
    // The opponent wasn't already lost before the mistake.
    const [before] = await search(c.fen, [], 11);
    if (!before || before.score < -200) continue;
    const moves = [c.first];
    const [best, second] = await search(c.fen, moves, 14, 2);
    if (!unique(best, second) || best.move !== c.played[0]) continue;
    moves.push(best.move);
    let mine = 1;
    let mate = isMate(best.score) ? MATE - best.score : 0;
    while (mine < 4 && !(isMate(best.score) && MATE - best.score <= 1)) {
      const [reply] = await search(c.fen, moves, 12);
      if (!reply) break;
      const [b2, s2] = await search(c.fen, [...moves, reply.move], 13, 2);
      if (!b2 || !unique(b2, s2)) break;
      moves.push(reply.move, b2.move);
      mine++;
      if (isMate(b2.score) && MATE - b2.score <= 1) break;
    }
    const sq = playOn(boardOf(c.fen), c.first);
    const capture = !!sq[best.move.slice(2, 4)];
    const level = Math.min(3, mine + (capture || mate ? 0 : 1));
    const sideToSolve = c.fen.split(' ')[1] === 'w' ? 'black' : 'white';
    out.push({
      opening: c.opening, line: c.line, game: c.game, white: c.white, black: c.black, we: c.we, be: c.be, year: c.year, event: c.event,
      fen: c.fen, moves, side: sideToSolve, phase: phaseOf(c.fen), level, ...(mate ? { mate } : {}),
    });
  }
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`done ${out.length} puzzles from ${all.length}`);
} else if (phase === 'scan') {
  const [inPath, outPath, shard, shards] = args;
  const all = JSON.parse(readFileSync(inPath, 'utf8')).filter((_, i) => i % Number(shards) === Number(shard));
  const { search } = engine();
  const out = [];
  let n = 0;
  for (const g of all) {
    n++;
    if (n % 20 === 0) console.log(`${n}/${all.length}, ${out.length} puzzles`);
    // Every position of the endgame, and its score for the side to move.
    const fens = [g.fen];
    const pos = Chess.fromSetup(parseFen(g.fen).unwrap()).unwrap();
    for (const u of g.moves) {
      const m = parseUci(u);
      if (!m || !pos.isLegal(m)) break;
      pos.play(m);
      fens.push(makeFen(pos.toSetup()));
    }
    const score = [];
    for (let i = 0; i < fens.length; i++) {
      const [b] = await search(fens[i], [], 10);
      score.push(b ? b.score : undefined);
    }
    let found = 0;
    for (let i = 1; i < fens.length - 1 && found < 2; i++) {
      if (score[i] === undefined || score[i - 1] === undefined) continue;
      const before = -score[i - 1]; // for the side to move at i
      // A real swing: from about equal (+1.5 at most) to winning (+2.5 or more, and 2+ pawns better than before).
      if (before > 150 || score[i] < 250 || score[i] - before < 200) continue;
      const [best, second] = await search(fens[i], [], 14, 2);
      if (!clearlyBest(best, second)) continue;
      const moves = [g.moves[i - 1], best.move];
      let mine = 1;
      const mate = isMate(best.score) ? MATE - best.score : 0;
      while (mine < 4 && !(isMate(best.score) && MATE - best.score <= 1)) {
        const [reply] = await search(fens[i - 1], moves, 12);
        if (!reply) break;
        const [b2, s2] = await search(fens[i - 1], [...moves, reply.move], 13, 2);
        if (!b2 || !clearlyBest(b2, s2)) break;
        moves.push(reply.move, b2.move);
        mine++;
        if (isMate(b2.score) && MATE - b2.score <= 1) break;
      }
      const capture = !!playOn(boardOf(fens[i - 1]), g.moves[i - 1])[best.move.slice(2, 4)];
      out.push({
        opening: g.opening, line: g.line, game: g.game, white: g.white, black: g.black, we: g.we, be: g.be, year: g.year, event: g.event,
        fen: fens[i - 1], moves, side: fens[i].split(' ')[1] === 'w' ? 'white' : 'black', phase: phaseOf(fens[i - 1]),
        level: Math.min(3, mine + (capture || mate ? 0 : 1)), ...(mate ? { mate } : {}),
      });
      found++;
      i += 6;
    }
  }
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`done ${out.length} puzzles from ${all.length} games`);
} else if (phase === 'build') {
  const [work, outDir] = args;
  // Model games per chapter (repertoire.py: <opening>.models.json), or the older single models.json.
  const models = {};
  for (const f of readdirSync(work).filter((f) => f.endsWith('.models.json'))) models[f.replace('.models.json', '')] = JSON.parse(readFileSync(join(work, f), 'utf8'));
  if (!Object.keys(models).length) Object.assign(models, JSON.parse(readFileSync(join(work, 'models.json'), 'utf8')));
  let stats = {};
  try {
    stats = JSON.parse(readFileSync(join(work, 'stats.json'), 'utf8'));
  } catch {
    /* the chapters carry their own counts */
  }
  let lichess = {};
  try {
    lichess = JSON.parse(readFileSync(join(work, 'lichess.json'), 'utf8'));
  } catch {
    /* no Lichess puzzles built */
  }
  mkdirSync(join(work, 'puzzles'), { recursive: true });
  const puzzles = readdirSync(join(work, 'puzzles'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(work, 'puzzles', f), 'utf8')));
  mkdirSync(outDir, { recursive: true });
  const CAP = 40; // per line, phase and level
  const FILL = 8; // Lichess puzzles only fill a line's level that has fewer of our own than this
  for (const oid of Object.keys(models)) {
    const mine = puzzles.filter((p) => p.opening === oid);
    const kept = [];
    const count = {};
    // Stronger players' games first.
    for (const p of mine.sort((a, b) => b.we + b.be - (a.we + a.be))) {
      const k = `${p.line}|${p.phase}|${p.level}`;
      if ((count[k] ?? 0) >= CAP) continue;
      count[k] = (count[k] ?? 0) + 1;
      const { opening: _o, ...rest } = p;
      void _o;
      kept.push(rest);
    }
    // Our own puzzles (from the line's games, found by the engine) come first; Lichess's only fill the gaps.
    for (const p of lichess[oid] ?? []) {
      const k = `${p.line}|${p.phase}|${p.level}`;
      if ((count[k] ?? 0) >= FILL) continue;
      count[k] = (count[k] ?? 0) + 1;
      kept.push(p);
    }
    const games = {};
    for (const [line, list] of Object.entries(models[oid])) games[line] = list;
    let strategy = {};
    try {
      strategy = JSON.parse(readFileSync(join(work, `${oid}.strategy.json`), 'utf8'));
    } catch {
      /* no middlegame facts built */
    }
    writeFileSync(join(outDir, `${oid}.json`), JSON.stringify({ stats: stats[oid] ?? {}, models: games, puzzles: kept, strategy }));
    const by = (f) => kept.reduce((m, p) => ((m[f(p)] = (m[f(p)] ?? 0) + 1), m), {});
    console.log(oid, 'models', Object.values(games).flat().length, 'puzzles', kept.length, by((p) => p.phase), by((p) => p.level), by((p) => p.line));
  }
} else {
  console.log('phase: check | build');
}

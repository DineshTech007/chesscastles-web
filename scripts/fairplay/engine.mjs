// Fair play: a player's own moves after the opening compared with Stockfish's (accuracy.mjs by hand, watch.mjs on
// GitHub). For each own move from ply 14: whether it was Stockfish's choice, and the winning chance it gave away
// (Lichess's measure), as Castle Calibration measured real FIDE players (scripts/calibration/fingerprint.mjs).
import { spawn } from 'node:child_process';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

export const FIRST_PLY = 14;

/** A Stockfish process spoken to line by line. */
export async function stockfish(path, { threads = 1, hash = 64 } = {}) {
  const sf = spawn(path, [], { stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '', lines = [], wait;
  sf.stdout.on('data', (d) => {
    buf += d;
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
  const send = (s) => sf.stdin.write(s + '\n');
  const until = (done) => new Promise((resolve) => (wait = { done, resolve }));
  send('uci');
  await until((l) => l === 'uciok');
  send(`setoption name Threads value ${threads}`);
  send(`setoption name Hash value ${hash}`);
  send('isready');
  await until((l) => l === 'readyok');
  return {
    /** The score (centipawns, side to move; mate as ±(10000 − 10 × moves)) and best move. */
    async evaluate(fen, depth) {
      send(`position fen ${fen}`);
      send(`go depth ${depth}`);
      const ls = await until((l) => l.startsWith('bestmove'));
      let score = 0;
      for (const l of ls) {
        const m = / score (cp|mate) (-?\d+)/.exec(l);
        if (m && l.includes(' depth ')) score = m[1] === 'cp' ? Number(m[2]) : Math.sign(Number(m[2]) || -1) * (10000 - Math.abs(Number(m[2])) * 10);
      }
      return { score, best: ls[ls.length - 1].split(' ')[1] };
    },
    quit: () => send('quit'),
  };
}

const wc = (cp) => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));

/** A saved game (uci, startFen, userSide): the player's own moves after the opening against Stockfish's. */
export async function analyse(sf, g, depth = 12) {
  const pos = g.startFen ? Chess.fromSetup(parseFen(g.startFen).unwrap()).unwrap() : Chess.default();
  const mine = g.userSide === 'white' ? 0 : 1;
  const r = { moves: 0, top: 0, loss: 0, blunders: 0 };
  for (let ply = 0; ply < g.uci.length; ply++) {
    const move = parseUci(g.uci[ply]);
    if (!move || !pos.isLegal(move)) break;
    if (ply % 2 === mine && ply >= FIRST_PLY) {
      const before = await sf.evaluate(makeFen(pos.toSetup()), depth);
      const after = pos.clone();
      after.play(move);
      const lost = after.isCheckmate() ? 0 : Math.max(0, wc(before.score) - wc(-(await sf.evaluate(makeFen(after.toSetup()), depth)).score));
      r.moves++;
      r.top += before.best === g.uci[ply] ? 1 : 0;
      r.loss += lost;
      r.blunders += lost >= 0.2 ? 1 : 0;
    }
    pos.play(move);
  }
  return { moves: r.moves, top: r.moves ? r.top / r.moves : 0, loss: r.moves ? r.loss / r.moves : 0, blunders: r.blunders };
}

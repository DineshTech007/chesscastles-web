// Checks advanced endgame lesson positions against the Lichess tablebase
// (perfect play, up to 7 pieces) and records the perfect line.
// Run: node scripts/tablebase-lines.mjs src/lib/coach/data/endgames-advanced.json
import { writeFileSync } from 'node:fs';

const [outPath] = process.argv.slice(2);

/** id, position, the result the lesson claims for the side to move, line length in plies. */
const POSITIONS = [
  ['reti', '7K/8/k1P5/7p/8/8/8/8 w - - 0 1', 'draw', 12],
  ['key-squares', '8/8/8/2k5/8/8/4P3/4K3 w - - 0 1', 'win', 16],
  ['vancura', 'R7/6k1/P4r2/8/8/8/6K1/8 w - - 0 1', 'draw', 12],
  ['wrong-bishop', '7k/8/8/6KP/8/8/2B5/8 w - - 0 1', 'draw', 10],
  ['opposite-bishops', '8/8/5k2/2b5/2B2PP1/6K1/8/8 w - - 0 1', 'draw', 12],
  ['queen-vs-rook', '3k4/3r4/3K4/8/8/8/8/7Q w - - 0 1', 'win', 20],
  ['rook-vs-pawn', '8/8/8/8/K7/8/2kp4/7R w - - 0 1', 'any', 12],
];

const api = async (fen) => {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`);
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, 3000));
      continue;
    }
    return r.json();
  }
  throw new Error('tablebase busy');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = {};
for (const [id, fen, claim, plies] of POSITIONS) {
  const first = await api(fen);
  const ok = claim === 'any' || first.category === claim;
  // The perfect line: each side plays the tablebase's best move.
  const line = [];
  let cur = first;
  let curFen = fen;
  for (let i = 0; i < plies && cur.moves?.length; i++) {
    const best = cur.moves[0];
    line.push(best.uci);
    curFen = await nextFen(curFen, best.uci);
    if (!curFen) break;
    await sleep(400);
    cur = await api(curFen);
  }
  out[id] = { fen, result: first.category, ok, line };
  console.log(id.padEnd(17), claim.padEnd(6), '->', first.category.padEnd(8), ok ? 'OK' : 'WRONG', line.length, 'plies');
  await sleep(600);
}
writeFileSync(outPath, JSON.stringify(out));

/** The FEN after a move, via chessops (loaded lazily). */
async function nextFen(fen, uci) {
  const { Chess } = await import('chessops/chess');
  const { parseFen, makeFen } = await import('chessops/fen');
  const { parseUci } = await import('chessops/util');
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const m = parseUci(uci);
  if (!m || !pos.isLegal(m)) return undefined;
  pos.play(m);
  return makeFen(pos.toSetup());
}

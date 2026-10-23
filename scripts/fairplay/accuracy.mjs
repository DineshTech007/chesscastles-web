// Fair play by hand: how a player's own moves compare with Stockfish's, game by game, after the opening (engine.mjs).
// Real players (Castle Calibration, real FIDE games) find Stockfish's move about 38% of the time at 1400-1600 and
// about 50% at 2500, and give away 3-4.5% winning chance a move; much better than that over whole games against
// strong opponents is a sign of engine help. Input: the JSON of
//   npx wrangler d1 execute knight24-social --remote --json --command "SELECT data FROM user_games WHERE uid='…'"
//   node scripts/fairplay/accuracy.mjs <that.json> [depth=14]
import { readFileSync } from 'node:fs';
import { analyse, stockfish } from './engine.mjs';

const [path, depthArg] = process.argv.slice(2);
const depth = Number(depthArg ?? 14);
const raw = readFileSync(path, 'utf8');
const games = JSON.parse(raw.slice(raw.indexOf('[')))[0].results.map((r) => JSON.parse(r.data)).filter((g) => g.uci?.length);
const sf = await stockfish(process.env.STOCKFISH ?? 'C:/dev/tools/stockfish/stockfish/stockfish-windows-x86-64-avx2.exe', { threads: 2, hash: 128 });

const all = { moves: 0, top: 0, loss: 0, blunders: 0 };
for (const g of games) {
  const r = await analyse(sf, g, depth);
  all.moves += r.moves;
  all.top += r.top * r.moves;
  all.loss += r.loss * r.moves;
  all.blunders += r.blunders;
  const mine = g.userSide === 'white' ? 0 : 1;
  const won = (g.result === '1-0' && mine === 0) || (g.result === '0-1' && mine === 1);
  console.log(
    `${new Date(g.playedAt + 19_800_000).toISOString().slice(0, 16)} ${g.kind} ${g.timeControl} vs ${mine === 0 ? g.black : g.white} (${g.opponentRating}) ${won ? 'won' : g.result}: ` +
      `${r.moves} moves, Stockfish's move ${(100 * r.top).toFixed(0)}%, loss/move ${(100 * r.loss).toFixed(2)}%, blunders ${r.blunders}`,
  );
}
console.log(`all: ${all.moves} moves, Stockfish's move ${((100 * all.top) / all.moves).toFixed(0)}%, loss/move ${((100 * all.loss) / all.moves).toFixed(2)}%, blunders ${all.blunders}`);
sf.quit();

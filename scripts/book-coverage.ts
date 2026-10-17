// How deep the FIDE games book goes for a game: at each of the bot's moves, how many
// real games are in the ±25 / ±50 / ±100 windows (and in any rating), and how long
// each lookup took. Run: npx vite-node scripts/book-coverage.ts game.json [rating]
import { readFileSync } from 'node:fs';
import { parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { positionFromFen, sanOf } from '$lib/chess/position';
import { CloudBook, movesInWindow, movesInRange } from '$lib/book/book';

const [gamePath, ratingArg] = process.argv.slice(2);
const game = JSON.parse(readFileSync(gamePath, 'utf8'));
const rating = Number(ratingArg) || game.opponentRating;
const botSide = game.userSide === 'white' ? 'black' : 'white';
const book = new CloudBook(undefined, 30_000);
const pos = positionFromFen(game.startFen);
console.log(`Bot ${rating} (${botSide}). ply  move   ±25  ±50 ±100  all-ratings  lookup-ms`);
for (let i = 0; i < Math.min(game.uci.length, 40); i++) {
  const side = i % 2 === 0 ? 'white' : 'black';
  const m = parseUci(game.uci[i]) as NormalMove;
  if (side === botSide) {
    const t0 = Date.now();
    const entries = await book.entries(pos);
    const ms = Date.now() - t0;
    const n = (w: number) => movesInWindow(entries, rating, w).reduce((s, x) => s + x.games, 0);
    const all = movesInRange(entries, 0).reduce((s, x) => s + x.games, 0);
    console.log(`${String(i + 1).padStart(4)}  ${sanOf(pos, m).padEnd(6)} ${String(n(25)).padStart(4)} ${String(n(50)).padStart(4)} ${String(n(100)).padStart(4)}  ${String(all).padStart(8)}  ${String(ms).padStart(6)}`);
  }
  pos.play(m);
}

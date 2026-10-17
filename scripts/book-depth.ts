// How long a game stays in the FIDE games book: both sides play book moves (weighted
// like the bot) until no ±100 window has 2 games. Prints the median and spread of the
// last book move. Run: npx vite-node scripts/book-depth.ts [games-per-rating] [ratings…]
import { Chess } from 'chessops/chess';
import { CloudBook, movesInWindow } from '$lib/book/book';

const [nArg, ...ratingArgs] = process.argv.slice(2);
const N = Number(nArg) || 20;
const ratings = ratingArgs.length ? ratingArgs.map(Number) : [1500, 2000, 2500];
const book = new CloudBook(undefined, 30_000);
for (const rating of ratings) {
  const depths: number[] = [];
  for (let g = 0; g < N; g++) {
    const pos = Chess.default();
    let ply = 0;
    for (;;) {
      const entries = await book.entries(pos);
      const moves = [25, 50, 100].map((w) => movesInWindow(entries, rating, w).filter((x) => pos.isLegal(x.move))).find((m) => m.reduce((s, x) => s + x.games, 0) >= 2);
      if (!moves) break;
      let roll = Math.random() * moves.reduce((s, x) => s + x.games, 0);
      const pick = moves.find((x) => (roll -= x.games) < 0) ?? moves[0];
      pos.play(pick.move);
      ply++;
      if (ply > 80) break;
    }
    depths.push(ply);
  }
  depths.sort((a, b) => a - b);
  const q = (p: number) => depths[Math.floor(p * (depths.length - 1))];
  console.log(`rating ${rating}: book ends after ply  min ${depths[0]} · 25% ${q(0.25)} · median ${q(0.5)} (move ${Math.ceil(q(0.5) / 2)}) · 75% ${q(0.75)} · max ${depths[depths.length - 1]}`);
}

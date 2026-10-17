// Looks up games in CaissaBase by player names (SQL LIKE patterns) and year,
// and prints their id and moves in SAN, to check famous games used in lessons.
// Run: npx vite-node scripts/find-game.ts F:/dev/caissabase_2024.db3 "Fischer%" "Spassky%" 1972
import { DatabaseSync } from 'node:sqlite';
import { makeSan } from 'chessops/san';
import { positionFromFen, START_FEN } from '$lib/chess/position';
import { decodeMoves } from '$lib/games/caissa';

const [dbPath, white, black, year] = process.argv.slice(2);
const db = new DatabaseSync(dbPath, { readOnly: true });
const rows = db
  .prepare(
    `SELECT g.ID, g.Moves, g.Date, g.Result, w.Name AS W, b.Name AS B, e.Name AS E
     FROM Games g JOIN Players w ON w.ID = g.WhiteID JOIN Players b ON b.ID = g.BlackID JOIN Events e ON e.ID = g.EventID
     WHERE w.Name LIKE ? AND b.Name LIKE ? AND g.Date LIKE ? LIMIT 40`,
  )
  .all(white, black, `${year ?? ''}%`) as { ID: number; Moves: Uint8Array; Date: string; Result: string; W: string; B: string; E: string }[];
for (const r of rows) {
  const pos = positionFromFen(START_FEN);
  const sans: string[] = [];
  for (const m of decodeMoves(Buffer.from(r.Moves).toString("base64")).moves) {
    sans.push(makeSan(pos, m));
    pos.play(m);
  }
  const text = sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ');
  console.log(`#${r.ID} ${r.W} - ${r.B} | ${r.E} ${r.Date} ${r.Result} | ${sans.length} plies\n  ${text}\n`);
}

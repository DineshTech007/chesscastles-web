// Samples positions from real FIDE-rated games (both players near a rating)
// with the move the player chose, to calibrate the bot's strength against
// real players (scripts/calibrate-bot.mjs scores them).
// Run: npx vite-node scripts/calibrate-positions.ts F:/dev/caissabase_2024.db3 out.json [perBand]
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fenOf, moveToUci } from '$lib/chess/position';
import { decodeMoves } from '$lib/games/caissa';

const [dbPath, outPath, perBandArg] = process.argv.slice(2);
const perBand = Number(perBandArg ?? 120);
const BANDS = [1400, 1800, 2200];
const db = new DatabaseSync(dbPath, { readOnly: true });

// A fixed-seed random, so the sample can be rebuilt.
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const out: { band: number; fen: string; human: string; ply: number; game: number }[] = [];
for (const band of BANDS) {
  const rows = db
    .prepare(
      `SELECT ID, Moves, PlyCount FROM Games
       WHERE WhiteElo BETWEEN ? AND ? AND BlackElo BETWEEN ? AND ?
         AND PlyCount BETWEEN 50 AND 160 AND (FEN IS NULL OR FEN = '') AND Date >= '2005'
       LIMIT 4000`,
    )
    .all(band - 60, band + 60, band - 60, band + 60) as { ID: number; Moves: Uint8Array; PlyCount: number }[];
  // Spread the picks over the whole result list.
  const picks = new Set<number>();
  while (picks.size < Math.min(perBand, rows.length)) picks.add(Math.floor(rand() * rows.length));
  for (const i of picks) {
    const g = rows[i];
    let moves;
    try {
      moves = decodeMoves(Buffer.from(g.Moves).toString('base64')).moves;
    } catch {
      continue;
    }
    if (moves.length < 30) continue;
    const ply = 16 + Math.floor(rand() * (Math.min(moves.length - 4, 90) - 16));
    const pos = decodeMoves(Buffer.from(g.Moves).toString('base64')).start;
    for (let k = 0; k < ply; k++) pos.play(moves[k]);
    out.push({ band, fen: fenOf(pos), human: moveToUci(moves[ply]), ply, game: g.ID });
  }
  console.log(band, rows.length, 'games found,', out.filter((o) => o.band === band).length, 'positions');
}
writeFileSync(outPath, JSON.stringify(out));

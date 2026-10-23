// Automatic fair play, the checker (owner, 2026-10-23): every 2 hours on GitHub (.github/workflows/fairplay.yml) it
// asks the server for the games won lately, checks each player's own moves with Stockfish (engine.mjs), and sends what
// it found; the server applies the owner's rules (server/api-worker src/fairwatch.ts: warn, then ban). The logs of a
// public repository are public: only counts are printed, never a player.
//   FAIRPLAY_TOKEN=… STOCKFISH=/usr/games/stockfish node scripts/fairplay/watch.mjs
import { analyse, stockfish } from './engine.mjs';

const API = process.env.API ?? 'https://api.chesscastles.com';
const token = process.env.FAIRPLAY_TOKEN;
if (!token) throw new Error('FAIRPLAY_TOKEN is not set');
const headers = { 'X-Fairplay-Token': token, 'Content-Type': 'application/json' };
const DEPTH = Number(process.env.DEPTH ?? 12);
/** DRY=1 (on this PC only, never on GitHub): nothing is sent, and the engine-like games are listed with their players. */
const DRY = process.env.DRY === '1';
/** Stop in time for the next run. */
const BUDGET_MS = Number(process.env.BUDGET_MIN ?? 80) * 60_000;

const started = Date.now();
const sf = await stockfish(process.env.STOCKFISH ?? 'stockfish', { threads: 2, hash: 128 });
let checked = 0, engineLike = 0, warned = 0, banned = 0;
for (let round = 0; round < 10 && Date.now() - started < BUDGET_MS; round++) {
  const res = await fetch(`${API}/fairplay/queue`, { headers });
  if (!res.ok) throw new Error(`queue: ${res.status}`);
  const { games, limits } = await res.json();
  if (!games.length) break;
  const verdicts = [];
  for (const g of games) {
    if (Date.now() - started > BUDGET_MS) break;
    const r = await analyse(sf, g, DEPTH);
    verdicts.push({ uid: g.uid, id: g.id, played: g.playedAt, moves: r.moves, top: r.top, loss: r.loss });
    if (r.moves >= limits.minMoves && r.top >= limits.top && r.loss < limits.loss) {
      engineLike++;
      if (DRY) console.log(`engine-like: ${g.uid} ${g.id} ${g.kind} ${g.timeControl} vs ${g.opponentRating} (rated ${g.myRating}): ${r.moves} moves, ${Math.round(r.top * 100)}%, ${(r.loss * 100).toFixed(2)}%`);
    }
  }
  if (DRY) {
    checked += verdicts.length;
    break;
  }
  const post = await fetch(`${API}/fairplay/verdicts`, { method: 'POST', headers, body: JSON.stringify(verdicts) });
  if (!post.ok) throw new Error(`verdicts: ${post.status}`);
  const { actions } = await post.json();
  checked += verdicts.length;
  warned += actions.filter((a) => a.action === 'warned').length;
  banned += actions.filter((a) => a.action === 'banned').length;
}
sf.quit();
console.log(`Fair play: ${checked} games checked, ${engineLike} engine-like, ${warned} warned, ${banned} banned (${Math.round((Date.now() - started) / 1000)} s).`);

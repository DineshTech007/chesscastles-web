// Castle Calibration, step 1: a fair sample of real FIDE-rated games from Lumbra's GigaBase (over the board), by
// rating level (today's FIDE scale) and type (blitz, rapid, classical), to measure how real players of each level
// play after the opening (scripts/calibration/fingerprint.mjs). Stays local: Lumbra's data is licensed, not shipped.
//
// Same rules as knight24/tool/gamesdb/lumbra.dart: the type from the TimeControl tag by FIDE's rule (base minutes
// plus 60 × increment: up to 10 blitz, under 60 rapid), else from words in the event; ratings to today's scale
// (FIDE, 1 March 2024: under 2000, + 0.4 × (2000 − rating), for games before March 2024); left out: Source
// "LichessBroadcastDB" (not licensed), internet games ("chess.com INT"…), set-up positions.
//
// Kept: both players within 100 of each other, their average rounded to a level of 100 (1400…2500), 40 plies or
// more. Reservoir sampling per level and type over the whole file, so the sample isn't one era or one event.
//   node scripts/calibration/sample-lumbra.mjs <LumbrasGigabase.pgn> <out.jsonl> [perLevel=200]
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const [pgn, out, perArg] = process.argv.slice(2);
const PER = { blitz: Number(perArg ?? 200), rapid: Number(perArg ?? 200), classical: Math.round(Number(perArg ?? 200) / 2) };
const LEVELS = Array.from({ length: 12 }, (_, i) => 1400 + i * 100);

function minutesOf(tc) {
  const t = (tc ?? '').toLowerCase().trim();
  if (!t || t === '-' || t === '?') return null;
  if (t.includes('/') || t.includes(':')) return 120;
  const words = t.includes('min') || t.includes('sec') || t.includes('h');
  const nums = [...t.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (!nums.length) return null;
  const base = nums[0], inc = nums.length > 1 ? nums[1] : 0;
  const baseMin = words ? (t.includes('h') && !t.includes('min') ? base * 60 : /^\d+\s*s/.test(t) ? base / 60 : base) : base > 120 ? base / 60 : base;
  return baseMin + inc;
}
function typeOf(h) {
  const m = minutesOf(h.TimeControl);
  if (m != null && m > 0) return m <= 10 ? 'blitz' : m < 60 ? 'rapid' : 'classical';
  const e = `${h.Event ?? ''} ${h.Site ?? ''}`.toLowerCase();
  if (/blitz|bullet|lightning|blits|5 ?min|3 ?min/.test(e)) return 'blitz';
  if (/rapid|rápid|rapide|schnell|quick|active|semi-?rapid|15 ?min|25 ?min/.test(e)) return 'rapid';
  return 'classical';
}
const online = /(\.|\bFICS\b|\bICC\b|AuNix|KC-CB|Endgame|Tornelo|Playchess|chess24)[^"]*\bINT$|chess\.com|lichess\.org|playchess|tornelo/i;
function todaysScale(elo, date) {
  const p = (date ?? '').split('.');
  const y = Number.parseInt(p[0]), m = Number.parseInt(p[1]) || 1;
  const old = !Number.isFinite(y) || y < 2024 || (y === 2024 && m < 3);
  return old && elo < 2000 ? Math.round(elo + 0.4 * (2000 - elo)) : elo;
}
const eloOf = (v) => {
  const n = Number.parseInt(v ?? '');
  return n > 0 && n <= 4000 ? n : null;
};
/** The main line's SAN moves: no comments, variations, NAGs, numbers or result. */
function sanOf(text) {
  let t = text.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  // Variations (nested).
  let prev;
  do {
    prev = t;
    t = t.replace(/\([^()]*\)/g, ' ');
  } while (t !== prev);
  return t
    .replace(/\$\d+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^\d+\.(\.\.)?/, ''))
    .filter((w) => w && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(w) && !/^\d+\.+$/.test(w));
}

let seed = 20261023;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const keep = {};
const seen = {};
let games = 0, used = 0;
function offer(g) {
  const k = `${g.type}:${g.level}`;
  const box = (keep[k] ??= []);
  const n = (seen[k] = (seen[k] ?? 0) + 1);
  const cap = PER[g.type];
  if (box.length < cap) box.push(g);
  else {
    const j = Math.floor(rand() * n);
    if (j < cap) box[j] = g;
  }
}

let h = {};
let moves = [];
let inMoves = false;
function endGame() {
  games++;
  const white = eloOf(h.WhiteElo), black = eloOf(h.BlackElo);
  if (white && black && h.Source !== 'LichessBroadcastDB' && !online.test(h.Site ?? '') && !(h.SetUp === '1' && h.FEN)) {
    const w = todaysScale(white, h.Date), b = todaysScale(black, h.Date);
    const level = Math.round((w + b) / 2 / 100) * 100;
    if (Math.abs(w - b) <= 100 && LEVELS.includes(level)) {
      const san = sanOf(moves.join(' '));
      if (san.length >= 40) {
        used++;
        offer({ type: typeOf(h), level, w, b, date: h.Date ?? '', result: h.Result ?? '*', event: (h.Event ?? '').slice(0, 60), san });
      }
    }
  }
  h = {};
  moves = [];
  inMoves = false;
  if (games % 500_000 === 0) console.log(`${games} games read, ${used} at the levels`);
}

const rl = createInterface({ input: createReadStream(pgn, { encoding: 'utf8', highWaterMark: 1 << 20 }), crlfDelay: Infinity });
for await (const line of rl) {
  if (line.startsWith('[')) {
    if (inMoves) endGame();
    const m = /^\[(\w+)\s+"(.*)"\]\s*$/.exec(line);
    if (m) h[m[1]] = m[2];
  } else if (line.trim()) {
    inMoves = true;
    moves.push(line);
  } else if (inMoves) endGame();
}
if (inMoves) endGame();

const lines = Object.values(keep).flat().map((g) => JSON.stringify(g));
writeFileSync(out, lines.join('\n') + '\n');
console.log(`done: ${games} games read, ${used} at the levels, ${lines.length} kept`);
for (const t of ['blitz', 'rapid', 'classical']) console.log(t, LEVELS.map((l) => `${l}:${keep[`${t}:${l}`]?.length ?? 0}/${seen[`${t}:${l}`] ?? 0}`).join(' '));

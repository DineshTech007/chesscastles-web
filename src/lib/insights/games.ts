import { makeUci } from 'chessops/util';
import { readPgn } from '$lib/chess/pgn';

/**
 * Importing a player's own public games for Guru's analysis (a port of the
 * app's lib/insights/chesscom_api.dart and chesscom_game.dart, plus Lichess).
 * chess.com's Published-Data API and Lichess's game export both allow
 * browsers to read them directly.
 */

export type Site = 'chesscom' | 'lichess';

/** A game reduced to what the analysis needs. */
export interface ImportedGame {
  /** The game's address; it stops duplicates. */
  url: string;
  site: Site;
  username: string;
  endTime: number;
  /** bullet, blitz, rapid, classical or daily. */
  timeClass: string;
  baseSeconds: number;
  increment: number;
  white: string;
  black: string;
  whiteRating?: number;
  blackRating?: number;
  result: '1-0' | '0-1' | '1/2-1/2';
  userColor: 'white' | 'black';
  opening?: string;
  uci: string[];
  san: string[];
  /** Clock after each move, ms. */
  clocks: (number | null)[];
}

export const userScore = (g: ImportedGame) => (g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.userColor === 'white') ? 1 : 0);
export const userRating = (g: ImportedGame) => (g.userColor === 'white' ? g.whiteRating : g.blackRating);
export const opponentOf = (g: ImportedGame) => (g.userColor === 'white' ? g.black : g.white);

const FAMILY_ENDS = new Set(['Defense', 'Defence', 'Opening', 'Game', 'Gambit', 'Attack', 'System']);
/** "Sicilian Defense" from "Sicilian Defense Najdorf Variation". */
export function openingFamily(name: string): string {
  const words = name.split(' ');
  for (let i = 0; i < words.length; i++) if (FAMILY_ENDS.has(words[i])) return words.slice(0, i + 1).join(' ');
  return words.slice(0, 3).join(' ');
}

/** chess.com links openings as ".../openings/Sicilian-Defense-Najdorf-Variation-6.Be3": the words before the moves. */
export function openingFromUrl(url?: string): string | undefined {
  const last = url?.split('/').filter(Boolean).pop();
  if (!last) return undefined;
  const words: string[] = [];
  for (const w of last.split('-')) {
    if (/^\d/.test(w)) break;
    if (w) words.push(w);
  }
  return words.length ? words.join(' ') : undefined;
}

/** "600" -> [600, 0]; "180+2" -> [180, 2]; daily "1/86400" -> [86400, 0]. */
export function parseTimeControl(tc: string): [number, number] {
  if (tc.includes('/')) return [Number(tc.split('/').pop()) || 0, 0];
  const [b, i] = tc.split('+');
  return [Number(b) || 0, Number(i) || 0];
}

function movesOf(pgn: string): { uci: string[]; san: string[]; clocks: (number | null)[] } | undefined {
  const [g] = readPgn(pgn);
  if (!g || !g.plies.length) return undefined;
  return { uci: g.plies.map((p) => makeUci(p.move)), san: g.plies.map((p) => p.san), clocks: g.plies.map((p) => p.clock ?? null) };
}

const CHESSCOM = 'https://api.chess.com';

/** One game from a chess.com monthly archive, or undefined (variants and custom starts are skipped). */
export function parseChessCom(j: any, username: string): ImportedGame | undefined {
  const user = username.toLowerCase();
  if (j?.rules !== 'chess' || typeof j.url !== 'string' || typeof j.pgn !== 'string') return undefined;
  if (typeof j.initial_setup === 'string' && j.initial_setup && !j.initial_setup.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')) return undefined;
  const w = j.white ?? {};
  const b = j.black ?? {};
  const color = String(w.username ?? '').toLowerCase() === user ? 'white' : String(b.username ?? '').toLowerCase() === user ? 'black' : undefined;
  if (!color) return undefined;
  const result = w.result === 'win' ? '1-0' : b.result === 'win' ? '0-1' : '1/2-1/2';
  const moves = movesOf(j.pgn);
  if (!moves) return undefined;
  const [base, inc] = parseTimeControl(String(j.time_control ?? ''));
  return {
    url: j.url,
    site: 'chesscom',
    username: user,
    endTime: (Number(j.end_time) || 0) * 1000,
    timeClass: String(j.time_class ?? 'unknown'),
    baseSeconds: base,
    increment: inc,
    white: String(w.username ?? 'White'),
    black: String(b.username ?? 'Black'),
    whiteRating: typeof w.rating === 'number' ? w.rating : undefined,
    blackRating: typeof b.rating === 'number' ? b.rating : undefined,
    result,
    userColor: color,
    opening: openingFromUrl(typeof j.eco === 'string' ? j.eco : undefined),
    ...moves,
  };
}

async function getJson(url: string): Promise<any> {
  let wait = 2000;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) return res.json();
    if (res.status === 404) throw new Error('No chess.com player with that name.');
    if (res.status === 410) throw new Error('That chess.com account is closed.');
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
      continue;
    }
    throw new Error(`chess.com had a problem (${res.status}). Try again later.`);
  }
  throw new Error('chess.com asks us to slow down. Try again in a few minutes.');
}

/**
 * The player's newest `count` standard games from chess.com, newest first
 * (`keep`: only these games, daily ones too; `months`: how far back to look
 * once some are found, a year by default).
 */
export async function chessComGames(
  username: string,
  count: number,
  onProgress?: (found: number) => void,
  o: { keep?: (g: ImportedGame) => boolean; months?: number } = {},
): Promise<ImportedGame[]> {
  const user = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,25}$/.test(user)) throw new Error('chess.com usernames have 3 to 25 letters, digits, "_" or "-".');
  const archives: string[] = ((await getJson(`${CHESSCOM}/pub/player/${user}/games/archives`)).archives ?? []).filter((u: unknown) => typeof u === 'string' && u.startsWith(`${CHESSCOM}/pub/player/`));
  const out: ImportedGame[] = [];
  for (const url of [...archives].reverse()) {
    const games: any[] = (await getJson(url)).games ?? [];
    for (const j of [...games].reverse()) {
      const g = parseChessCom(j, user);
      if (g && (o.keep ? o.keep(g) : g.timeClass !== 'daily') && g.uci.length >= 10) out.push(g);
      if (out.length >= count) break;
    }
    onProgress?.(out.length);
    // Enough games, or a year back with some found already.
    if (out.length >= count || (out.length > 0 && archives.indexOf(url) < archives.length - (o.months ?? 12))) break;
  }
  return out.slice(0, count);
}

/** Lichess now shares game archives only with signed-in apps: thrown when there is no Lichess login. */
export class NeedsLichessLogin extends Error {}

/**
 * The player's newest `count` standard games from Lichess (with clocks),
 * newest first. `token`: the visitor's Lichess login (Lichess's game export
 * no longer answers apps without one). `speeds`: Lichess's speeds to read,
 * bullet to classical by default.
 */
export async function lichessGames(username: string, count: number, token?: string, speeds = 'bullet,blitz,rapid,classical'): Promise<ImportedGame[]> {
  const user = username.trim();
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(user)) throw new Error('That is not a Lichess username.');
  if (!token) throw new NeedsLichessLogin('Connect your Lichess account to analyse Lichess games.');
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${count + 10}&clocks=true&opening=true&perfType=${speeds}`, {
    headers: { Accept: 'application/x-ndjson', Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    // Tell a missing player apart from a refused export.
    const exists = await fetch(`https://lichess.org/api/user/${encodeURIComponent(user)}`).then((r) => r.ok).catch(() => true);
    throw new Error(exists ? 'Lichess did not share these games right now. Try again in a minute.' : 'No Lichess player with that name.');
  }
  if (!res.ok) throw new Error(`Lichess had a problem (${res.status}). Try again later.`);
  const lines = (await res.text()).split('\n').filter(Boolean);
  const out: ImportedGame[] = [];
  for (const line of lines) {
    const j = JSON.parse(line);
    if (j.variant !== 'standard' || !j.moves || j.initialFen) continue;
    const color = j.players?.white?.user?.id === user.toLowerCase() ? 'white' : j.players?.black?.user?.id === user.toLowerCase() ? 'black' : undefined;
    if (!color) continue;
    const moves = movesOf(j.moves);
    if (!moves || moves.uci.length < 10) continue;
    // Lichess clocks: centiseconds after each move, starting with both initial clocks.
    const cs: number[] = Array.isArray(j.clocks) ? j.clocks : [];
    out.push({
      url: `https://lichess.org/${j.id}`,
      site: 'lichess',
      username: user.toLowerCase(),
      endTime: Number(j.lastMoveAt ?? j.createdAt) || 0,
      timeClass: j.speed ?? 'unknown',
      baseSeconds: Math.round((j.clock?.initial ?? 0)),
      increment: j.clock?.increment ?? 0,
      white: j.players?.white?.user?.name ?? 'White',
      black: j.players?.black?.user?.name ?? 'Black',
      whiteRating: j.players?.white?.rating,
      blackRating: j.players?.black?.rating,
      result: j.winner === 'white' ? '1-0' : j.winner === 'black' ? '0-1' : '1/2-1/2',
      userColor: color,
      opening: j.opening?.name,
      ...moves,
      clocks: moves.uci.map((_, i) => (cs[i] !== undefined ? cs[i] * 10 : null)),
    });
    if (out.length >= count) break;
  }
  return out;
}

/** The game as PGN, to open in Analyse. */
export function pgnOf(g: ImportedGame): string {
  const tag = (k: string, v: string | number | undefined) => (v === undefined || v === '' ? '' : `[${k} "${String(v).replace(/"/g, "'")}"]\n`);
  const d = new Date(g.endTime);
  const date = g.endTime ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` : '';
  const moves = g.san.map((s, i) => (i % 2 ? s : `${i / 2 + 1}. ${s}`)).join(' ');
  return (
    tag('Event', `${g.site === 'chesscom' ? 'chess.com' : 'Lichess'} ${g.timeClass} game`) +
    tag('Site', g.url) +
    tag('Date', date) +
    tag('White', g.white) +
    tag('Black', g.black) +
    tag('Result', g.result) +
    tag('WhiteElo', g.whiteRating) +
    tag('BlackElo', g.blackRating) +
    tag('Opening', g.opening) +
    `\n${moves} ${g.result}\n`
  );
}

import { Chess } from 'chessops/chess';
import { parseSan } from 'chessops/san';
import { parseUci } from 'chessops/util';

/** Lichess's public API (CORS is open for these endpoints; no login). */
const API = 'https://lichess.org/api';

export interface DailyPuzzle {
  id: string;
  rating: number;
  themes: string[];
  /** The position the solver plays from. */
  start: Chess;
  /** The opponent's move that led to it, for the last-move highlight. */
  lastMove?: [number, number];
  /** Moves in UCI: the solver's, the reply, the solver's… */
  solution: string[];
  url: string;
}

export async function dailyPuzzle(): Promise<DailyPuzzle> {
  const res = await fetch(`${API}/puzzle/daily`);
  if (!res.ok) throw new Error(`Lichess answered ${res.status}`);
  const j = await res.json();
  const sans: string[] = String(j.game.pgn).split(' ').filter(Boolean);
  const solution: string[] = j.puzzle.solution;
  // The daily PGN normally stops at the puzzle position; fall back to initialPly.
  for (const upto of [sans.length, Number(j.puzzle.initialPly) + 1]) {
    const pos = Chess.default();
    let last: [number, number] | undefined;
    let ok = true;
    for (const san of sans.slice(0, upto)) {
      const m = parseSan(pos, san);
      if (!m || !('from' in m)) {
        ok = false;
        break;
      }
      last = [m.from, m.to];
      pos.play(m);
    }
    const first = parseUci(solution[0]);
    if (ok && first && pos.isLegal(first)) {
      return {
        id: j.puzzle.id,
        rating: j.puzzle.rating,
        themes: j.puzzle.themes ?? [],
        start: pos,
        lastMove: last,
        solution,
        url: `https://lichess.org/training/${j.puzzle.id}`,
      };
    }
  }
  throw new Error('This puzzle could not be read.');
}

export interface Broadcast {
  id: string;
  name: string;
  round: string;
  /** On Lichess (kept for "open on Lichess"). */
  url: string;
  image?: string;
  location?: string;
  timeControl?: string;
  live: boolean;
}

/** The top broadcasts on Lichess right now (live and soon). */
export async function topBroadcasts(): Promise<Broadcast[]> {
  const res = await fetch(`${API}/broadcast/top?page=1`);
  if (!res.ok) throw new Error(`Lichess answered ${res.status}`);
  const j = await res.json();
  const now = Date.now();
  return ((j.active ?? []) as any[]).map((b) => ({
    id: b.tour.id,
    name: b.tour.name,
    round: b.round?.name ?? '',
    url: b.round?.url ?? b.tour.url,
    image: b.tour.image,
    location: b.tour.info?.location,
    timeControl: b.tour.info?.tc,
    live: !!b.round?.startsAt && b.round.startsAt <= now && !b.round.finished,
  }));
}

export interface BroadcastPlayer {
  name: string;
  title?: string;
  rating?: number;
  fed?: string;
  /** Centiseconds left, as Lichess sends it. */
  clock?: number;
}

export interface BroadcastGame {
  id: string;
  fen: string;
  lastMove?: string;
  /** "*" while playing, else "1-0", "0-1" or "½-½". */
  status: string;
  white: BroadcastPlayer;
  black: BroadcastPlayer;
}

export interface BroadcastRound {
  id: string;
  name: string;
  slug: string;
  startsAt?: number;
  finished: boolean;
  ongoing: boolean;
}

export interface BroadcastTour {
  id: string;
  name: string;
  slug: string;
  image?: string;
  location?: string;
  timeControl?: string;
  format?: string;
  url: string;
  rounds: BroadcastRound[];
  defaultRoundId?: string;
}

const get = async (path: string) => {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Lichess answered ${res.status}`);
  return res;
};

export async function broadcastTour(tourId: string): Promise<BroadcastTour> {
  const j = await (await get(`/broadcast/${tourId}`)).json();
  return {
    id: j.tour.id,
    name: j.tour.name,
    slug: j.tour.slug,
    image: j.tour.image,
    location: j.tour.info?.location,
    timeControl: j.tour.info?.tc,
    format: j.tour.info?.format,
    url: j.tour.url,
    defaultRoundId: j.defaultRoundId,
    rounds: (j.rounds ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      startsAt: r.startsAt,
      finished: !!r.finished,
      ongoing: !!r.ongoing,
    })),
  };
}

/** Every board of a round: position, last move, players, clocks, result. */
export async function broadcastRound(tour: BroadcastTour, round: BroadcastRound): Promise<BroadcastGame[]> {
  const j = await (await get(`/broadcast/${tour.slug}/${round.slug}/${round.id}`)).json();
  return (j.games ?? []).map((g: any) => {
    const p = (x: any): BroadcastPlayer => ({ name: x?.name ?? '?', title: x?.title, rating: x?.rating, fed: x?.fed, clock: x?.clock });
    return { id: g.id, fen: g.fen, lastMove: g.lastMove, status: g.status ?? '*', white: p(g.players?.[0]), black: p(g.players?.[1]) };
  });
}

/** One broadcast game as PGN (a round is a Lichess study; a game is a chapter). */
export async function broadcastGamePgn(roundId: string, gameId: string): Promise<string> {
  return (await get(`/study/${roundId}/${gameId}.pgn`)).text();
}

// ---------- players: search, live status, profile ----------

export interface LichessPlayer {
  id: string;
  name: string;
  title?: string;
  online?: boolean;
}

/** Lichess players whose name starts with `term` (at least 3 letters). */
export async function searchLichess(term: string): Promise<LichessPlayer[]> {
  const t = term.trim();
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(t)) return [];
  const res = await fetch(`${API}/player/autocomplete?term=${encodeURIComponent(t)}&object=true`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.result ?? []).map((p: LichessPlayer) => ({ id: p.id, name: p.name, title: p.title, online: p.online }));
}

export interface LichessStatus {
  id: string;
  online: boolean;
  /** The game being played now, if any (with its id, to watch it). */
  playingId?: string;
}

/** Who is online and who is playing right now (up to 100 players). */
export async function lichessStatus(ids: string[]): Promise<Map<string, LichessStatus>> {
  const out = new Map<string, LichessStatus>();
  if (!ids.length) return out;
  const res = await fetch(`${API}/users/status?ids=${ids.slice(0, 100).map(encodeURIComponent).join(',')}&withGameIds=true`);
  if (!res.ok) return out;
  for (const s of await res.json()) out.set(s.id, { id: s.id, online: !!s.online, playingId: s.playing ? s.playingId : undefined });
  return out;
}

export interface LichessProfile {
  id: string;
  username: string;
  title?: string;
  /** Ratings by speed: bullet, blitz, rapid, classical, puzzle… */
  perfs: { key: string; rating: number; games: number; provisional: boolean }[];
  seenAt?: number;
  createdAt?: number;
  playing?: string;
  url: string;
}

const PERF_ORDER = ['classical', 'rapid', 'blitz', 'bullet', 'correspondence', 'puzzle'];
export async function lichessProfile(id: string): Promise<LichessProfile | undefined> {
  const res = await fetch(`${API}/user/${encodeURIComponent(id)}`);
  if (!res.ok) return undefined;
  const j = await res.json();
  if (j.disabled || j.closed) return undefined;
  const perfs = PERF_ORDER.filter((k) => j.perfs?.[k]?.games || (k === 'puzzle' && j.perfs?.puzzle))
    .map((k) => ({ key: k, rating: j.perfs[k].rating, games: j.perfs[k].games ?? 0, provisional: !!j.perfs[k].prov }));
  return { id: j.id, username: j.username, title: j.title, perfs, seenAt: j.seenAt, createdAt: j.createdAt, playing: j.playing, url: j.url ?? `https://lichess.org/@/${j.id}` };
}

export interface LiveFrame {
  fen: string;
  /** The last move, UCI. */
  lm?: string;
  /** Seconds left. */
  wc?: number;
  bc?: number;
}
export interface LiveGameInfo {
  id: string;
  white: { name: string; title?: string; rating?: number };
  black: { name: string; title?: string; rating?: number };
  speed: string;
  status: string;
  winner?: 'white' | 'black';
  /** "5+3" */
  clock?: string;
}

/**
 * Follows a Lichess game live: `oninfo` with the players first (and again
 * when it ends), then `onframe` with every new position. Returns a stop function.
 */
export function followGame(id: string, oninfo: (g: LiveGameInfo) => void, onframe: (f: LiveFrame) => void, onend: () => void): () => void {
  const ctrl = new AbortController();
  const side = (p: { user?: { name: string; title?: string }; rating?: number; name?: string } | undefined) => ({ name: p?.user?.name ?? p?.name ?? 'Anonymous', title: p?.user?.title, rating: p?.rating });
  void (async () => {
    try {
      const res = await fetch(`${API}/stream/game/${encodeURIComponent(id)}`, { signal: ctrl.signal });
      if (!res.ok || !res.body) return onend();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const j = JSON.parse(line);
          if (j.id) {
            oninfo({
              id: j.id,
              white: side(j.players?.white),
              black: side(j.players?.black),
              speed: j.speed ?? '',
              status: typeof j.status === 'object' ? (j.status?.name ?? '') : (j.status ?? ''),
              winner: j.winner,
              clock: j.clock ? `${Math.round(j.clock.initial / 60)}+${j.clock.increment}` : undefined,
            });
          }
          if (j.fen) onframe({ fen: j.fen.split(' ').length > 1 ? j.fen : `${j.fen} ${j.turns % 2 ? 'b' : 'w'} - - 0 1`, lm: j.lm || j.lastMove, wc: j.wc, bc: j.bc });
        }
      }
      onend();
    } catch {
      if (!ctrl.signal.aborted) onend();
    }
  })();
  return () => ctrl.abort();
}

// ---------- arena tournaments ----------

export interface Arena {
  id: string;
  name: string;
  /** Minutes + seconds a move. */
  minutes: number;
  increment: number;
  speed: string;
  players: number;
  startsAt: number;
  finishesAt: number;
  status: 'created' | 'started' | 'finished';
  rated: boolean;
  /** Rapid or classical: Lichess lets apps play these. */
  playable: boolean;
  maxRating?: number;
}

const arenaOf = (t: any, status: Arena['status']): Arena => ({
  id: t.id,
  name: t.fullName,
  minutes: (t.clock?.limit ?? 0) / 60,
  increment: t.clock?.increment ?? 0,
  speed: t.perf?.key ?? '',
  players: t.nbPlayers ?? 0,
  startsAt: typeof t.startsAt === 'string' ? Date.parse(t.startsAt) : t.startsAt,
  finishesAt: typeof t.finishesAt === 'string' ? Date.parse(t.finishesAt) : (t.finishesAt ?? (t.secondsToFinish ? Date.now() + t.secondsToFinish * 1000 : 0)),
  status,
  rated: !!t.rated,
  playable: t.perf?.key === 'rapid' || t.perf?.key === 'classical',
  maxRating: t.maxRating?.rating,
});

/** Lichess's current and upcoming arenas (standard chess only). */
export async function arenas(): Promise<Arena[]> {
  const res = await fetch(`${API}/tournament`);
  if (!res.ok) throw new Error('Lichess tournaments could not be loaded.');
  const j = await res.json();
  const std = (t: any) => (t.variant?.key ?? 'standard') === 'standard';
  return [...(j.started ?? []).filter(std).map((t: any) => arenaOf(t, 'started')), ...(j.created ?? []).filter(std).map((t: any) => arenaOf(t, 'created'))];
}

export interface ArenaInfo extends Arena {
  standings: { rank: number; name: string; title?: string; rating: number; score: number; fire?: boolean }[];
  featured?: { id: string; white: string; black: string };
  secondsToStart?: number;
  secondsToFinish?: number;
}

export async function arena(id: string): Promise<ArenaInfo> {
  const res = await fetch(`${API}/tournament/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('This tournament could not be loaded.');
  const t = await res.json();
  const status: Arena['status'] = t.isFinished ? 'finished' : t.isStarted ? 'started' : 'created';
  const base = arenaOf({ ...t, fullName: t.fullName, perf: t.perf, clock: t.clock, nbPlayers: t.nbPlayers }, status);
  return {
    ...base,
    standings: (t.standing?.players ?? []).map((p: any) => ({ rank: p.rank, name: p.name, title: p.title, rating: p.rating, score: p.score, fire: !!p.sheet?.fire })),
    featured: t.featured ? { id: t.featured.id, white: t.featured.white?.name ?? '', black: t.featured.black?.name ?? '' } : undefined,
    secondsToStart: t.secondsToStart,
    secondsToFinish: t.secondsToFinish,
  };
}

/** Ratings of up to 300 Lichess players at once (closed accounts are left out). */
export async function lichessRatings(ids: string[]): Promise<Map<string, { username: string; title?: string; perfs: Record<string, { rating: number; games: number; prov?: boolean }> }>> {
  const out = new Map();
  if (!ids.length) return out;
  const res = await fetch(`${API}/users`, { method: 'POST', body: ids.slice(0, 300).join(','), headers: { 'Content-Type': 'text/plain' } });
  if (!res.ok) return out;
  for (const u of await res.json()) if (!u.disabled && !u.closed) out.set(u.id, { username: u.username, title: u.title, perfs: u.perfs ?? {} });
  return out;
}

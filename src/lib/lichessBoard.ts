/**
 * Lichess Board API for playing real people (needs the player's Lichess
 * token, scope board:play). Streams are newline-delimited JSON over fetch.
 * Lichess rules: apps may seek random opponents at rapid and classical only,
 * play blitz only by direct challenge (or against its computer), and never bullet.
 */
import { reportError } from '$lib/analytics';

const LICHESS = 'https://lichess.org';

export class LichessError extends Error {}

async function call(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(LICHESS + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error ?? (res.status === 429 ? 'Lichess asks to wait a minute before trying again.' : `Lichess answered ${res.status}`);
    // For the admin dashboard: which Lichess call failed and why (the route only: ids become ":id").
    reportError('lichess', `${res.status} ${path.split('?')[0].replace(/\/[A-Za-z0-9]{8,}(?=\/|$)/g, '/:id').replace(/\/challenge\/[^/]+$/, '/challenge/:user')}: ${String(message).slice(0, 120)}`);
    throw new LichessError(message);
  }
  return res;
}

const form = (o: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined) p.set(k, String(v));
  return { method: 'POST', body: p, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
};

/** Reads an NDJSON stream until it ends or is aborted; blank keep-alive lines are skipped. */
export async function readNdjson(res: Response, onItem: (o: any) => void): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onItem(JSON.parse(line));
    }
  }
}

export interface GameStart {
  gameId: string;
  color: 'white' | 'black';
  opponent?: { username?: string; rating?: number; ai?: number };
}

/** The player's event stream: gameStart, gameFinish, challenge… (runs until aborted). */
export async function streamEvents(token: string, onEvent: (e: any) => void, signal: AbortSignal): Promise<void> {
  const res = await call(token, '/api/stream/event', { signal });
  await readNdjson(res, onEvent);
}

/** Looks for a random opponent; resolves when Lichess stops the seek (paired or cancelled). */
export async function seek(
  token: string,
  o: { minutes: number; increment: number; rated: boolean },
  signal: AbortSignal,
): Promise<void> {
  const res = await call(token, '/api/board/seek', { ...form({ time: o.minutes, increment: o.increment, rated: o.rated, variant: 'standard' }), signal });
  await readNdjson(res, () => {});
}

export async function challengeAi(token: string, o: { level: number; minutes: number; increment: number; color: string }): Promise<string> {
  const res = await call(token, '/api/challenge/ai', form({ level: o.level, 'clock.limit': o.minutes * 60, 'clock.increment': o.increment, color: o.color }));
  return (await res.json()).id;
}

export async function challengeUser(
  token: string,
  username: string,
  o: { minutes: number; increment: number; rated: boolean; color: string },
): Promise<string> {
  const res = await call(token, `/api/challenge/${encodeURIComponent(username)}`, form({ rated: o.rated, 'clock.limit': o.minutes * 60, 'clock.increment': o.increment, color: o.color }));
  return (await res.json()).id;
}

/**
 * A game only `white` and `black` may join (a Lichess open challenge locked to
 * the two of them): nobody is challenged, so no player's Lichess challenge
 * settings can refuse it. Each player joins with acceptChallenge; the game
 * starts when both have.
 */
export async function openChallenge(token: string, o: { white?: string; black?: string; minutes: number; increment: number; rated: boolean }): Promise<string> {
  // Both names: only those two can join (white first). None: a friend whose Lichess name we don't know (a Google
  // account on Chess Castles) joins from the private link in their message.
  const users = o.white && o.black ? { users: `${o.white},${o.black}` } : {};
  const res = await call(
    token,
    '/api/challenge/open',
    form({ rated: o.rated, 'clock.limit': o.minutes * 60, 'clock.increment': o.increment, ...users, name: 'Chess Castles friends', expiresAt: Date.now() + 3600_000 }),
  );
  return (await res.json()).id;
}

/** Lichess refused a challenge because of the other player's settings (or a block): "You cannot challenge X", "X only accepts challenges from friends"… */
export const refusedByLichess = (e: unknown) => e instanceof LichessError && /cannot challenge|does not accept|only accepts challenges|too far from|provisional/i.test(e.message);

export const cancelChallenge = (token: string, id: string) => call(token, `/api/challenge/${id}/cancel`, { method: 'POST' });
export const acceptChallenge = (token: string, id: string) => call(token, `/api/challenge/${id}/accept`, { method: 'POST' });
export const declineChallenge = (token: string, id: string) => call(token, `/api/challenge/${id}/decline`, form({ reason: 'later' }));
/** The challenges waiting now: received (`in`) and sent (`out`). */
export async function listChallenges(token: string): Promise<{ in: any[]; out: any[] }> {
  const res = await call(token, '/api/challenge');
  const j = await res.json().catch(() => ({}));
  return { in: Array.isArray(j.in) ? j.in : [], out: Array.isArray(j.out) ? j.out : [] };
}

/** The game's stream: gameFull first, then gameState, chatLine, opponentGone… */
export async function streamGame(token: string, gameId: string, onLine: (o: any) => void, signal: AbortSignal): Promise<void> {
  const res = await call(token, `/api/board/game/stream/${gameId}`, { signal });
  await readNdjson(res, onLine);
}

export const sendMove = (token: string, gameId: string, uci: string) => call(token, `/api/board/game/${gameId}/move/${uci}`, { method: 'POST' });
export const resign = (token: string, gameId: string) => call(token, `/api/board/game/${gameId}/resign`, { method: 'POST' });
export const abort = (token: string, gameId: string) => call(token, `/api/board/game/${gameId}/abort`, { method: 'POST' });
export const draw = (token: string, gameId: string, accept: boolean) => call(token, `/api/board/game/${gameId}/draw/${accept ? 'yes' : 'no'}`, { method: 'POST' });
export const claimVictory = (token: string, gameId: string) => call(token, `/api/board/game/${gameId}/claim-victory`, { method: 'POST' });

/**
 * Joins a Lichess arena tournament (needs the tournament:write permission), or says "still here" when already in.
 * Lichess pairs only players it knows are present: people on its own tournament page, and app players who asked
 * with `pairMeAsap`. That request lasts 70 seconds, so the arena page sends it again every 50 seconds while the
 * player waits (Lichess allows 30 joins in 10 minutes).
 */
export const joinTournament = (token: string, id: string) => call(token, `/api/tournament/${encodeURIComponent(id)}/join`, form({ pairMeAsap: true }));
/** Leaves (pauses in) an arena tournament. */
export const withdrawTournament = (token: string, id: string) => call(token, `/api/tournament/${encodeURIComponent(id)}/withdraw`, { method: 'POST' });

/** Lichess players whose name starts with `term` (the ones you follow first, when signed in). */
export async function autocompletePlayers(term: string, token?: string): Promise<{ id: string; name: string; title?: string; online?: boolean }[]> {
  const res = await fetch(`${LICHESS}/api/player/autocomplete?term=${encodeURIComponent(term)}&object=true&friend=1`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) return [];
  const j = await res.json().catch(() => ({}));
  return Array.isArray(j.result) ? j.result.slice(0, 8) : [];
}

/**
 * Who may challenge the player on Lichess (their privacy setting):
 * 1 nobody, 2 players near their rating, 3 their Lichess friends, 4 registered players, 5 everyone.
 */
export async function challengeSetting(token: string): Promise<number | undefined> {
  const res = await call(token, '/api/account/preferences').catch(() => undefined);
  const j = res ? await res.json().catch(() => undefined) : undefined;
  return typeof j?.prefs?.challenge === 'number' ? j.prefs.challenge : undefined;
}

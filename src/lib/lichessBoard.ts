/**
 * Lichess Board API for playing real people (needs the player's Lichess
 * token, scope board:play). Streams are newline-delimited JSON over fetch.
 * Lichess rules: apps may seek random opponents at rapid and classical only,
 * play blitz only by direct challenge (or against its computer), and never bullet.
 */
const LICHESS = 'https://lichess.org';

export class LichessError extends Error {}

async function call(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(LICHESS + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new LichessError(body.error ?? (res.status === 429 ? 'Lichess asks to wait a minute before trying again.' : `Lichess answered ${res.status}`));
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

export const cancelChallenge = (token: string, id: string) => call(token, `/api/challenge/${id}/cancel`, { method: 'POST' });
export const acceptChallenge = (token: string, id: string) => call(token, `/api/challenge/${id}/accept`, { method: 'POST' });

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

/** Joins a Lichess arena tournament (needs the tournament:write permission). */
export const joinTournament = (token: string, id: string) => call(token, `/api/tournament/${encodeURIComponent(id)}/join`, { method: 'POST' });
/** Leaves (pauses in) an arena tournament. */
export const withdrawTournament = (token: string, id: string) => call(token, `/api/tournament/${encodeURIComponent(id)}/withdraw`, { method: 'POST' });

/**
 * Who may challenge the player on Lichess (their privacy setting):
 * 1 nobody, 2 players near their rating, 3 their Lichess friends, 4 registered players, 5 everyone.
 */
export async function challengeSetting(token: string): Promise<number | undefined> {
  const res = await call(token, '/api/account/preferences').catch(() => undefined);
  const j = res ? await res.json().catch(() => undefined) : undefined;
  return typeof j?.prefs?.challenge === 'number' ? j.prefs.challenge : undefined;
}

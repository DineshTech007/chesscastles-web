import { writable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { lichessToken } from '$lib/auth';
import { listChallenges, streamEvents } from '$lib/lichessBoard';

/**
 * The player's Lichess event stream, once for the whole site (Lichess sends challenges, games starting and
 * ending on it). Every page sees incoming challenges through `incomingChallenges` (the popup in the layout), and
 * the Online panel listens to the same stream through `onLichessEvent` instead of opening a second one.
 * It reconnects by itself (a phone that slept, a dropped connection), and when it starts it also asks Lichess
 * for challenges that arrived before the page was open.
 */
export interface IncomingChallenge {
  id: string;
  from: string;
  fromTitle?: string;
  fromRating?: number;
  minutes: number;
  increment: number;
  rated: boolean;
  /** The colour you would play, when it is decided. */
  myColor?: 'white' | 'black';
  speed?: string;
  at: number;
}

export const incomingChallenges = writable<IncomingChallenge[]>([]);

/** A Lichess game of the player's still being played (Lichess tells every game in progress when the stream opens). */
export interface OngoingGame {
  id: string;
  color?: 'white' | 'black';
  opponent: string;
  /** Playable on a Chess Castles board (Lichess's Board API); bullet is played on lichess.org only. */
  board: boolean;
}
/**
 * The player's games in progress (owner, 2026-10-21: a game left by a stray tap was lost on time, with no way back):
 * the layout shows a bar back to them on every other page.
 */
export const ongoingGames = writable<OngoingGame[]>([]);
/** Where a game in progress is played: its Chess Castles board, or lichess.org for bullet. */
export const ongoingHref = (g: OngoingGame) => (g.board ? `/play/online/${g.id}${g.color ? `?c=${g.color}` : ''}` : `https://lichess.org/${g.id}`);

/** A game from Lichess's gameStart event, as the bar shows it; undefined for a correspondence game (no clock to lose). */
export function readOngoing(g: any): OngoingGame | undefined {
  if (!g?.gameId || g.speed === 'correspondence' || g.perf === 'correspondence') return undefined;
  return {
    id: g.gameId,
    color: g.color === 'white' || g.color === 'black' ? g.color : undefined,
    opponent: g.opponent?.ai ? `Lichess level ${g.opponent.ai}` : (g.opponent?.username ?? 'your opponent'),
    board: g.compat?.board !== false,
  };
}

type Listener = (e: any) => void;
const listeners = new Set<Listener>();
/** Games that should open by themselves when they start: challenges you sent or accepted here. */
const openOnStart = new Set<string>();

let running: { token: string; ctl: AbortController } | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let backoff = 2000;

export function onLichessEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A challenge sent from this page: its game opens here when it is accepted. */
export const openWhenStarted = (gameId: string) => openOnStart.add(gameId);

/** The Lichess arena the player joined here: its games open by themselves, wherever on the site they are. */
let arenaId: string | undefined;
export const followArena = (id: string | undefined) => (arenaId = id);

const me = () => lichessToken()?.username.toLowerCase();

function toIncoming(c: any): IncomingChallenge | undefined {
  return readChallenge(c, me());
}

/** A Lichess challenge sent to `mine` (lower-case Lichess id), as the popup shows it; undefined for any other. */
export function readChallenge(c: any, mine: string | undefined): IncomingChallenge | undefined {
  if (!c?.id || !c.challenger || (c.status && c.status !== 'created')) return undefined;
  if (!mine || c.destUser?.id?.toLowerCase() !== mine || c.challenger.id?.toLowerCase() === mine) return undefined;
  // `finalColor` and `color` are the challenger's; you play the other colour.
  const theirs = c.finalColor ?? (c.color === 'white' || c.color === 'black' ? c.color : undefined);
  return {
    id: c.id,
    from: c.challenger.name ?? c.challenger.id,
    fromTitle: c.challenger.title ?? undefined,
    fromRating: typeof c.challenger.rating === 'number' ? c.challenger.rating : undefined,
    minutes: Math.round((c.timeControl?.limit ?? 0) / 60),
    increment: c.timeControl?.increment ?? 0,
    rated: !!c.rated,
    myColor: theirs ? (theirs === 'white' ? 'black' : 'white') : undefined,
    speed: c.speed,
    at: Date.now(),
  };
}

const drop = (id: string) => incomingChallenges.update((l) => l.filter((c) => c.id !== id));

function handle(e: any) {
  if (e?.type === 'challenge') {
    const c = toIncoming(e.challenge);
    if (c) incomingChallenges.update((l) => (l.some((x) => x.id === c.id) ? l : [...l, c]));
  } else if (e?.type === 'challengeCanceled' || e?.type === 'challengeDeclined') {
    if (e.challenge?.id) drop(e.challenge.id);
  } else if (e?.type === 'gameFinish' && e.game?.gameId) {
    ongoingGames.update((l) => l.filter((g) => g.id !== e.game.gameId));
  } else if (e?.type === 'gameStart' && e.game?.gameId) {
    const id = e.game.gameId;
    drop(id);
    const g = readOngoing(e.game);
    if (g) ongoingGames.update((l) => [...l.filter((x) => x.id !== id), g]);
    if (arenaId && e.game.tournamentId === arenaId) {
      const path = `/play/online/${id}`;
      if (typeof location !== 'undefined' && location.pathname !== path) void goto(`${path}?c=${e.game.color ?? ''}&t=${arenaId}`);
    } else if (openOnStart.has(id)) {
      openOnStart.delete(id);
      const path = `/play/online/${id}`;
      if (typeof location !== 'undefined' && location.pathname !== path) void goto(`${path}?c=${e.game.color ?? ''}`);
    }
  }
  for (const fn of listeners) {
    try {
      fn(e);
    } catch {
      /* one listener's error must not stop the others */
    }
  }
}

async function loadWaiting(token: string) {
  try {
    const { in: received } = await listChallenges(token);
    const list = received.map(toIncoming).filter((c): c is IncomingChallenge => !!c);
    incomingChallenges.update((l) => [...l, ...list.filter((c) => !l.some((x) => x.id === c.id))]);
  } catch {
    /* the stream still brings new ones */
  }
}

/** Starts (or keeps) the stream for the signed-in Lichess account; stops it when there is none. */
export function syncLichessEvents(): void {
  const token = lichessToken()?.token;
  if (running && running.token === token) return;
  stopLichessEvents();
  if (!token) return;
  const ctl = new AbortController();
  running = { token, ctl };
  void loadWaiting(token);
  const connect = async () => {
    const opened = Date.now();
    // The stream tells every game still in progress again as it opens: the old list goes (games may have ended).
    ongoingGames.set([]);
    try {
      await streamEvents(token, handle, ctl.signal);
    } catch {
      /* dropped: try again below */
    }
    if (ctl.signal.aborted || running?.ctl !== ctl) return;
    // A stream that stayed up a while reconnects quickly; one failing at once waits longer each time.
    backoff = Date.now() - opened > 60_000 ? 2000 : Math.min(60_000, backoff * 2);
    retry = setTimeout(() => {
      if (running?.ctl === ctl) {
        void loadWaiting(token);
        void connect();
      }
    }, backoff);
  };
  void connect();
}

export function stopLichessEvents(): void {
  clearTimeout(retry);
  running?.ctl.abort();
  running = undefined;
  incomingChallenges.set([]);
  ongoingGames.set([]);
}

/** A phone woke up or the tab came back: the stream may have died while asleep. */
export function wakeLichessEvents(): void {
  if (!running) return syncLichessEvents();
  const { token } = running;
  stopLichessEvents();
  if (lichessToken()?.token === token) syncLichessEvents();
}

export const hasIncoming = () => get(incomingChallenges).length > 0;

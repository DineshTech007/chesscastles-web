import type { Plan } from '$lib/plans';
import { writable } from 'svelte/store';
import { API } from '$lib/api';
import { auth } from '$lib/auth';
import type { KfideSpeed } from '$lib/kfide';
import type { SavedGame } from '$lib/stores/myGames';

/**
 * Players, friends and messages (the API worker, server/api-worker/src/social.ts). Only
 * friends can message each other or see each other's photo and details.
 */

export interface Player {
  uid: string;
  /** Their plan (Pawn, Bishop, Rook or Queen): the badge beside the name. */
  plan?: Plan;
  username: string;
  name: string;
  country: string;
  status: string;
  fideId: string;
  fideRating?: number;
  /** The headline CC Rating (the speed played most). */
  kfide?: number;
  kfideGames: number;
  /** CC Rating at each speed played. */
  kfideTc?: Partial<Record<KfideSpeed, { rating: number; games: number }>>;
  studyWeek?: string;
  studyPoints?: number;
  booksRead?: number;
  joined: number;
  /** False for a Lichess player who was sent a request but has not joined Chess Castles yet. */
  member?: boolean;
  online: boolean;
  /** Playing a game on Chess Castles right now (anyone signed in can watch it). */
  playing?: boolean;
  // Friends and the player only:
  photo?: string;
  first?: string;
  last?: string;
  location?: string;
  language?: string;
  timezone?: string;
  about?: string;
}

export type Relation = 'self' | 'friends' | 'incoming' | 'outgoing' | 'blocked' | 'none';

export interface Conversation {
  player: Player;
  last: string;
  at: number;
  mine: boolean;
  unread: number;
}

export interface Message {
  id: number;
  mine: boolean;
  body: string;
  at: number;
}

/** Unread messages and friend requests, for the menu badge. */
export const socialBadge = writable(0);

/** A signed-in call to the API worker's /social/… (throws the server's error message). */
export async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  if (!token) throw new Error('Sign in to use friends and messages.');
  const res = await fetch(`${API}/social/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Something went wrong. Try again.');
  return j as T;
}

export const myProfile = () => call<Player>('GET', 'me');
export const saveProfile = (p: Partial<Omit<Player, 'photo' | 'studyWeek'>> & { photo?: string | null; studyWeek?: { week: string; points: number } }) => call<Player>('PUT', 'me', p);
export const findPlayers = (q: string) => call<{ players: Player[] }>('GET', `players?q=${encodeURIComponent(q)}`).then((r) => r.players);
export const getPlayer = (uid: string) => call<{ player: Player; relation: Relation }>('GET', `player/${encodeURIComponent(uid)}`);
export const friendsList = () => call<{ friends: Player[]; incoming: Player[]; outgoing: Player[] }>('GET', 'friends');
/** `username`: a Lichess player's name as written (for one not on Chess Castles yet). */
export const friendAction = (uid: string, action: 'request' | 'accept' | 'remove' | 'block', username?: string) =>
  call<{ relation: Relation }>('POST', 'friends', { uid, action, username }).then((r) => r.relation);
export const inbox = () => call<{ conversations: Conversation[]; unread: number }>('GET', 'inbox');
export const messagesWith = (uid: string, after = 0) => call<{ messages: Message[] }>('GET', `messages/${encodeURIComponent(uid)}?after=${after}`).then((r) => r.messages);
export const sendMessage = (to: string, body: string) => call<{ id: number }>('POST', 'messages', { to, body });

/** Refreshes the menu badge: unread messages plus friend requests waiting. */
export async function refreshBadge() {
  try {
    const [i, f] = await Promise.all([inbox(), friendsList()]);
    socialBadge.set(i.unread + f.incoming.length);
  } catch {
    socialBadge.set(0);
  }
}

export const playerPhoto = (p: Pick<Player, 'photo'>) => (p.photo ? `data:image/jpeg;base64,${p.photo}` : undefined);
export const initialsOf = (name: string) => name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

/** A small copy of a photo (96 px) for friends to see. */
export async function smallPhoto(b64: string): Promise<string | undefined> {
  try {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const side = Math.min(img.width, img.height);
    c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 160, 160);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  } catch {
    return undefined;
  }
}

export interface KfideLeader {
  uid: string;
  /** Their plan (Pawn, Bishop, Rook or Queen): the badge beside the name. */
  plan?: Plan;
  name: string;
  username: string;
  country: string;
  rating: number;
  games: number;
  me: boolean;
}
/** Chess Castles' CC Rating leaderboard (signed-in players), overall ('main') or at one speed. */
export const kfideLeaders = (speed: 'main' | KfideSpeed) => call<{ players: KfideLeader[] }>('GET', `leaders?speed=${speed}`).then((r) => r.players);
/** Study points this week, book chapters read, or (members) everyone, for the Lichess boards. `rating` holds the number. */
export const boardOf = (kind: 'study' | 'books' | 'members', week = '') =>
  call<{ players: KfideLeader[] }>('GET', `leaders?speed=${kind}&week=${encodeURIComponent(week)}`).then((r) => r.players);

export type ReportReason = 'cheating' | 'abuse' | 'profile' | 'sandbagging' | 'other';
/** Reports a player for review (fair play, abuse, an inappropriate name or photo…). */
export const reportPlayer = (uid: string, reason: ReportReason, details: string, game = '') => call<{ ok: true }>('POST', 'report', { uid, reason, details, game });
/** A message to Chess Castles' support. */
export const contactSupport = (reason: 'help' | 'bug' | 'idea' | 'account' | 'refund', details: string) => call<{ ok: true }>('POST', 'support', { reason, details });

/** A game in progress on Chess Castles, as shared with friends who watch it. */
export interface LiveGame {
  opponent: string;
  opponentRating?: number;
  /** The player's colour. */
  human: 'white' | 'black';
  minutes: number;
  increment: number;
  start: string;
  uci: string[];
  /** Clocks (ms) when shared; the side to move's runs on from `at`. */
  white: number;
  black: number;
  at: number;
  result?: string;
  reason?: string;
}
export const shareLive = (g: LiveGame) => call<{ ok: true }>('PUT', 'live', { data: JSON.stringify(g) });
export const endLive = () => call<{ ok: true }>('DELETE', 'live');
/** Friends with a Chess Castles game going. */
export const liveFriends = () => call<{ games: { uid: string; name: string; opponent: string; over: boolean; updated: number }[] }>('GET', 'live').then((r) => r.games);
/** A friend's game in progress. */
export const watchLive = (uid: string) =>
  call<{ data: string; updated: number; now: number }>('GET', `live/${encodeURIComponent(uid)}`).then((r) => ({ game: JSON.parse(r.data) as LiveGame, updated: r.updated, now: r.now }));

/** Keeps up to 100 finished games in the account at once (your history on every device). */
export const uploadGames = (list: SavedGame[]) =>
  call<{ saved: number }>('PUT', 'games', { games: list.slice(0, 100).map((g) => ({ id: g.id, played: g.playedAt, data: JSON.stringify(g) })) });
/** Keeps a finished Chess Castles game in the account, for friends to see and review. */
export const uploadGame = (g: SavedGame) => call<{ ok: true }>('PUT', 'games', { id: g.id, played: g.playedAt, data: JSON.stringify(g) });
/** A friend's latest Chess Castles games (or your own). */
export const friendGames = (uid: string) =>
  call<{ games: string[] }>('GET', `games/${encodeURIComponent(uid)}`).then((r) => r.games.flatMap((d) => {
    try {
      return [JSON.parse(d) as SavedGame];
    } catch {
      return [];
    }
  }));

/** A Chess Castles player waiting in the Lichess lobby. */
export interface LobbySeek {
  uid: string;
  plan?: Plan;
  lichess: string;
  name: string;
  rating: number;
  /** "5+3". */
  tc: string;
  rated: boolean;
  since: number;
}
export type LobbyRole = 'challenge' | 'accept';
export interface LobbyState {
  seeks: LobbySeek[];
  /** Your own seek; `partner` once paired (`role`: whether you send the Lichess challenge or accept it). */
  mine: { tc: string; rated: boolean; since: number; role?: LobbyRole; partner?: LobbySeek } | null;
}
export const lobbyState = () => call<LobbyState>('GET', 'lobby');
/** Seeks a game at `tc`, or takes the open seek of `join` (a player's uid). */
export const lobbySeek = (o: { tc: string; rated: boolean; rating: number; join?: string }) =>
  call<{ paired?: { role: LobbyRole; partner: LobbySeek; tc: string; rated: boolean }; waiting?: { tc: string; rated: boolean } }>('POST', 'lobby', o);
/** Leaves the lobby (`started`: the game began, so the partner's seek goes too). */
export const lobbyLeave = (started = false) => call<{ ok: true }>('DELETE', `lobby${started ? '?started=1' : ''}`);

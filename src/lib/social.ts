import { reportError } from '$lib/analytics';
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
  /** Their plan (Free, Premium or Elite): the badge beside the name. */
  plan?: Plan;
  username: string;
  name: string;
  /** A Chess Castles title the owner gave (CGM, CIM…). */
  title?: string;
  country: string;
  status: string;
  fideId: string;
  fideRating?: number;
  /** The headline CC Rating (the speed played most). */
  kfide?: number;
  kfideGames: number;
  /** CC Rating at each speed played. */
  kfideTc?: Partial<Record<KfideSpeed, { rating: number; games: number }>>;
  /** CC Ratings the owner set (the player's own profile only). */
  ratingSet?: Partial<Record<KfideSpeed, { rating: number; at: number }>>;
  studyWeek?: string;
  studyPoints?: number;
  booksRead?: number;
  /** Study progress friends can see (friends and the player only). */
  progress?: FriendProgress;
  /** Awards won, for everyone signed in: the ids, and the puzzle rating and Rush best their top badges show. */
  awards?: { ids: string[]; puzzleRating: number; rushBest: number };
  /** The picture everyone sees (src/lib/look/avatars.ts) and the award worn beside the name. */
  avatar?: string;
  flair?: string;
  /** The Chess Castles team (owner, admins): messages from them show as the team's. */
  team?: boolean;
  /** An admin suspended the account: banned from playing (shown to them and on their profile). */
  banned?: boolean;
  /** Their own profile only: a fair-play decision about them. */
  fairPlay?: 'warned' | 'cheater';
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

/** What a player's friends see of their study: puzzles, streak, and days studied this week. */
export interface FriendProgress {
  puzzleRating: number;
  puzzlesWeek: number;
  puzzlesSolved: number;
  streak: number;
  /** Days studied this week, 0 to 7. */
  studyDays: number;
  /** Puzzle Rush: the best score and how many rushes (for the Puzzle Rush leaderboard). */
  rushBest?: number;
  rushRuns?: number;
  /** Awards won (src/lib/awards/awards.ts ids): the server keeps them once won. */
  awards?: string[];
  /** Puzzle Racer: best score, races, wins (the Puzzle Racer leaderboard). */
  racerBest?: number;
  racerRaces?: number;
  racerWins?: number;
}

export type Relation = 'self' | 'friends' | 'incoming' | 'outgoing' | 'blocked' | 'none';

export interface Conversation {
  player: Player;
  last: string;
  at: number;
  mine: boolean;
  unread: number;
  /** With the Chess Castles team. */
  team?: boolean;
}

export interface Message {
  id: number;
  mine: boolean;
  body: string;
  at: number;
}

/** Unread messages and friend requests, for the menu badge. */
export const socialBadge = writable(0);

/**
 * When the server keeps failing or says "too many requests" (a busy day), the pages that ask it again and
 * again by themselves (the friends badge, the lobby, who is playing) pause for five minutes instead of
 * piling on. What a person taps still goes through.
 */
let failures = 0;
let restUntil = 0;
export const serverResting = () => Date.now() < restUntil;
function noteReply(good: boolean) {
  if (good) failures = 0;
  else if (++failures >= 3) {
    restUntil = Date.now() + 5 * 60_000;
    failures = 0;
  }
}

/** A signed-in call to the API worker's /social/… (throws the server's error message). */
/** "player/lichess%3Aabc?x=1" -> "player/:id": the route only, never a name. */
const routeOf = (path: string) =>
  path
    .split('?')[0]
    .split('/')
    .slice(0, 3)
    .map((p, i) => (i && (p.includes('%') || p.includes(':') || p.length > 14 || /\d/.test(p)) ? ':id' : p))
    .join('/');

export async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const dev = import.meta.env.DEV && typeof localStorage !== 'undefined' ? localStorage.getItem('cc.devUid') : null;
  const token = dev ?? (await auth.currentUser?.getIdToken().catch(() => undefined));
  if (!token) throw new Error('Sign in to use friends and messages.');
  let res: Response;
  try {
    res = await fetch(`${API}/social/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    noteReply(false);
    // Offline is not our error; a failure while online is worth knowing about.
    if (typeof navigator !== 'undefined' && navigator.onLine) reportError('api', `network ${method} /${routeOf(path)}`);
    throw e;
  }
  noteReply(res.status < 500 && res.status !== 429);
  if (res.status >= 500 || res.status === 429) reportError('api', `${res.status} ${method} /${routeOf(path)}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? (res.status === 429 || res.status >= 500 ? 'Chess Castles is very busy right now. Please try again in a few minutes.' : 'Something went wrong. Try again.'));
  return j as T;
}

export const myProfile = () => call<Player>('GET', 'me');
export const saveProfile = (p: Partial<Omit<Player, 'photo' | 'studyWeek'>> & { photo?: string | null; studyWeek?: { week: string; points: number }; consent?: { version: string; age: string } }) => call<Player>('PUT', 'me', p);
export const findPlayers = (q: string) => call<{ players: Player[] }>('GET', `players?q=${encodeURIComponent(q)}`).then((r) => r.players);
export const getPlayer = (uid: string) => call<{ player: Player; relation: Relation }>('GET', `player/${encodeURIComponent(uid)}`);
export const friendsList = () => call<{ friends: Player[]; incoming: Player[]; outgoing: Player[] }>('GET', 'friends');
/** `username`: a Lichess player's name as written (for one not on Chess Castles yet). */
export const friendAction = (uid: string, action: 'request' | 'accept' | 'remove' | 'block', username?: string) =>
  call<{ relation: Relation }>('POST', 'friends', { uid, action, username }).then((r) => r.relation);
export const inbox = () => call<{ conversations: Conversation[]; unread: number }>('GET', 'inbox');
export const messagesWith = (uid: string, after = 0) => call<{ messages: Message[] }>('GET', `messages/${encodeURIComponent(uid)}?after=${after}`).then((r) => r.messages);
export const sendMessage = (to: string, body: string) => call<{ id: number }>('POST', 'messages', { to, body });

/** Friend requests waiting for an answer, and the friends, as last loaded (the home page and the popup show them). */
export const incomingRequests = writable<Player[]>([]);
export const friendsCache = writable<Player[]>([]);

/** Refreshes the menu badge: unread messages plus friend requests waiting (and the lists behind them). */
/** Unread messages and friend requests for the badge; false if the server could not be reached. */
export async function refreshBadge(): Promise<boolean> {
  if (serverResting()) return false;
  try {
    const [i, f] = await Promise.all([inbox(), friendsList()]);
    incomingRequests.set(f.incoming);
    friendsCache.set(f.friends);
    socialBadge.set(i.unread + f.incoming.length);
    return true;
  } catch {
    incomingRequests.set([]);
    socialBadge.set(0);
    return false;
  }
}

/** A player's picture: their own photo (friends only), else the avatar they chose (everyone). */
export const playerPhoto = (p: Pick<Player, 'photo' | 'avatar'>) => (p.photo ? `data:image/jpeg;base64,${p.photo}` : p.avatar ? `/avatars/${p.avatar}.webp` : undefined);
/** My look: the picture and flair everyone sees, the name, and when the name may change again (0: now). */
export const getLook = () => call<{ avatar?: string; flair?: string; name: string; nextNameAt: number }>('GET', 'look');
export const saveLook = (l: { avatar?: string; flair?: string; name?: string }) => call<{ avatar?: string; flair?: string; name: string }>('PUT', 'look', l);
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
  /** Their plan (Free, Premium or Elite): the badge beside the name. */
  plan?: Plan;
  name: string;
  username: string;
  country: string;
  title?: string;
  rating: number;
  games: number;
  me: boolean;
}
/** Chess Castles' CC Rating leaderboard (signed-in players), overall ('main') or at one speed. */
export const kfideLeaders = (speed: 'main' | KfideSpeed) => call<{ players: KfideLeader[] }>('GET', `leaders?speed=${speed}`).then((r) => r.players);
/** Study points this week, book chapters read, or (members) everyone, for the Lichess boards. `rating` holds the number. */
export const boardOf = (kind: 'study' | 'books' | 'members' | 'puzzles' | 'puzzles_solved' | 'rush' | 'racer', week = '') =>
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
  /** The player's CC Rating when the game began, and after it (once it is over): shown by the player's name to those watching. */
  myRating?: number;
  myAfter?: number;
  /** An online game against another player: its Lichess id (it is watched there). */
  lichess?: string;
  /** Each move's mover clock after it (ms): the clocks and each move's time for those stepping through the game. */
  clocks?: number[];
}
export const shareLive = (g: LiveGame) => call<{ ok: true }>('PUT', 'live', { data: JSON.stringify(g) });
export const endLive = () => call<{ ok: true }>('DELETE', 'live');
/** Friends with a Chess Castles game going. */
export const liveFriends = () => call<{ games: { uid: string; name: string; opponent: string; over: boolean; updated: number }[] }>('GET', 'live').then((r) => r.games);
/** A game being played on Chess Castles right now (the "Live on Chess Castles" page). */
export interface PlayingGame {
  uid: string;
  name: string;
  photo?: string;
  country?: string;
  title?: string;
  rating?: number;
  opponent: string;
  opponentRating?: number;
  color: 'white' | 'black';
  minutes: number;
  increment: number;
  moves: number;
  over: boolean;
  result?: string;
  lichess?: string;
  updated: number;
}
/** Every game being played on Chess Castles right now (signed in). */
/** Games being played on Chess Castles; `recent`: also the last 24 hours' games (the home page's game of the day). */
export const playingNow = (recent = false) => call<{ games: PlayingGame[]; now: number }>('GET', recent ? 'playing?recent=1' : 'playing');
/** A player signed in on Chess Castles in the last minutes (the home page's "Online now"). */
export type OnlinePlayer = Player & { relation: Relation; playing: boolean };
export const onlinePlayers = () => call<{ players: OnlinePlayer[] }>('GET', 'online').then((r) => r.players);
/** Where a game being played is watched (with the engine and the games database): on Lichess's stream, or shared. */
export const watchHref = (g: Pick<PlayingGame, 'uid' | 'lichess'>) => (g.lichess ? `/watch/live/${g.lichess}` : `/watch/friend/${encodeURIComponent(g.uid)}`);
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
  /** A Chess Castles title (CGM…). */
  title?: string;
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

// ---- WhatsApp reports (server/api-worker/src/whatsapp.ts): a number given with consent after signing in, for the
// player's Guru report with the link to their study plan.

/** The words agreed to by the box (the server checks this version). */
export const WA_CONSENT = 'wa-1';
export interface MyWhatsapp {
  phone?: string;
  whose?: 'self' | 'parent';
  consentAt?: number;
}
/** The short Guru summary a WhatsApp message is written from (made in the browser by Insights). */
export interface GuruSummary {
  site: 'lichess' | 'chesscom';
  user: string;
  games: number;
  score: number;
  accuracy: number;
  blunders: number;
  weak: { title: string; evidence: string }[];
  strong: string;
}
export const myWhatsapp = () => call<MyWhatsapp>('GET', 'whatsapp');
export const saveWhatsapp = (phone: string, whose: 'self' | 'parent') => call<MyWhatsapp>('PUT', 'whatsapp', { phone, whose, consent: WA_CONSENT });
export const stopWhatsapp = () => call<{ ok: true }>('DELETE', 'whatsapp');
/** Saved only for a player who gave a number (else `saved: false`). */
export const saveGuruSummary = (report: GuruSummary) => call<{ saved: boolean }>('PUT', 'whatsapp/report', { report });

/** A number as typed ("98765 43210", "+91-98765-43210", "0 98765 43210") as +91…; undefined if it can't be one. */
export function normalizePhone(typed: string, country = '91'): string | undefined {
  const digits = typed.replace(/[^\d+]/g, '');
  const n = digits.startsWith('+') ? digits : digits.startsWith('00') ? `+${digits.slice(2)}` : `+${country}${digits.replace(/^0+/, '')}`;
  return /^\+[1-9]\d{9,14}$/.test(n) && !(n.startsWith(`+${country}`) && country === '91' && n.length !== 13) ? n : undefined;
}

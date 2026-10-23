import { API } from '$lib/api';
import { token, type Game } from '$lib/classroom/api';

/**
 * Castle Cups (server/api-worker src/cup.ts): Chess Castles' own Swiss tournaments, every evening (India time), one
 * per time control, every game on our server. Computer players fill a thin field; a child's page plays their moves.
 */

export type CupStatus = 'open' | 'running' | 'over' | 'cancelled' | 'skipped';
export type GroupId = 'u1200' | 'u1400' | 'u1600' | 'open';
export const GROUPS: GroupId[] = ['u1200', 'u1400', 'u1600', 'open'];
export const GROUP_NAME: Record<GroupId, string> = { u1200: 'U1200', u1400: 'U1400', u1600: 'U1600', open: 'Open' };
/** Rated games at the cup's speed needed for a group prize (as the server). */
export const MIN_GAMES = 10;

/** The day's cups (as the server's CUP_SLOTS): India time. */
export const SLOTS: Record<string, { name: string; minutes: number; inc: number; speed: 'bullet' | 'blitz'; at: string }> = {
  b5: { name: 'Blitz 5+0', minutes: 5, inc: 0, speed: 'blitz', at: '18:30' },
  u1: { name: 'Bullet 1+1', minutes: 1, inc: 1, speed: 'bullet', at: '19:30' },
  b3: { name: 'Blitz 3+0', minutes: 3, inc: 0, speed: 'blitz', at: '20:15' },
  u0: { name: 'Bullet 2+1', minutes: 2, inc: 1, speed: 'bullet', at: '21:15' },
};
/** A cup's day and slot from its id ("2026-10-23-u1"). */
export function parseCup(id: string) {
  // A test cup (admins): "t3p2-ab12cd" is 3+2; an on-demand cup for everyone: "f3p2-ab12cd". Their start comes from the room.
  const t = /^([tf])(\d{1,2})p(\d{1,2})-[a-z0-9]{6}$/.exec(id);
  if (t) {
    const minutes = Number(t[2]), inc = Number(t[3]);
    const total = minutes * 60 + inc * 40;
    const kind = total < 180 ? 'Bullet' : total < 480 ? 'Blitz' : 'Rapid';
    const speed = (total < 180 ? 'bullet' : 'blitz') as 'bullet' | 'blitz';
    if (t[1] === 'f') return { day: 'flash', slot: 'flash', name: `${kind} ${minutes}+${inc}`, minutes, inc, speed, at: '', startAt: 0, flash: true as const };
    return { day: 'test', slot: 'test', name: `Test cup · ${kind} ${minutes}+${inc}`, minutes, inc, speed, at: '', startAt: 0, test: true as const };
  }
  const m = /^(\d{4}-\d{2}-\d{2})-(b5|u1|b3|u0)$/.exec(id);
  if (!m) return undefined;
  const slot = SLOTS[m[2]];
  return { day: m[1], slot: m[2], ...slot, startAt: Date.parse(`${m[1]}T${slot.at}:00+05:30`) };
}

/** A cup in Home's list. */
export interface CupSummary {
  id: string;
  slot: string;
  name: string;
  speed: 'bullet' | 'blitz';
  minutes: number;
  inc: number;
  startAt: number;
  status: CupStatus;
  entries: number;
  uids: string[];
  round: number;
  rounds: number;
  /** An on-demand cup (an admin added it for the kids online). */
  flash?: boolean;
  /** The top board while it's on. */
  top?: { white: string; black: string; whiteName: string; blackName: string; root: string; moves: string[]; clock?: Game['clock']; result: string };
  podium?: { name: string; score: number }[];
}
export interface Champion {
  id: string;
  name: string;
  at: number;
  podium: { name: string; score: number }[];
}
export interface Today {
  now: number;
  off: boolean;
  cups: CupSummary[];
  champions: Champion[];
}

export interface CupPlayer {
  uid: string;
  name: string;
  rating: number;
  group: GroupId;
  provisional?: true;
  bot?: true;
  out?: true;
  online: boolean;
}
export type CupGame = Game & { round: number; bot?: 'white' | 'black' };
export interface Standing {
  uid: string;
  name: string;
  rating: number;
  group: GroupId;
  provisional?: true;
  bot?: true;
  out?: true;
  score: number;
  buch: number;
  wins: number;
  played: number;
  rank: number;
  /** The rating the player played like in this cup. */
  perf?: number;
}
/** The cup as its room sends it. */
export interface CupView {
  id: string;
  status: CupStatus;
  startAt: number;
  rounds: number;
  round: number;
  /** When the next round starts (during a break), else 0. */
  nextAt: number;
  players: CupPlayer[];
  games: CupGame[];
  standings: Standing[];
  /** A friendly game's time control. */
  match?: { minutes: number; inc: number };
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const t = await token();
  const res = await fetch(`${API}/cup${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Something went wrong. Try again.');
  return j as T;
}

/** Today's cups (once they're all over, tomorrow's), cached a few seconds by the server: anyone may ask. */
export async function todayCups(): Promise<Today> {
  const res = await fetch(`${API}/cup/today`);
  if (!res.ok) throw new Error('Could not load the cups.');
  return res.json();
}
export const joinCup = (id: string) => call<{ ok: true; cup: CupView }>('POST', `/${id}/join`);
export const leaveCup = (id: string) => call<{ ok: true }>('POST', `/${id}/leave`);
/** Admins: call a cup off, or start it now. */
export const cancelCup = (id: string) => call<{ ok: true }>('POST', `/${id}/cancel`);
export const startCup = (id: string) => call<{ ok: true }>('POST', `/${id}/start`);
/** Admins: a private test cup (any time control, starting in `startIn` minutes): its link to share. */
export const testCup = (minutes: number, inc: number, startIn: number) => call<{ id: string; startAt: number }>('POST', '/test', { minutes, inc, startIn });
/** Admins: an on-demand cup for everyone (many kids online): on Home with the day's cups, starting in `startIn` minutes. */
export const flashCup = (minutes: number, inc: number, startIn: number) => call<{ id: string; startAt: number }>('POST', '/flash', { minutes, inc, startIn });
/**
 * A friendly game with another player, on our server (owner, 2026-10-23: bullet no longer opens Lichess). The inviter
 * makes the room (white is drawn); the invited player accepts from their popup; either may call it off before it starts.
 */
export const createMatch = (to: string, minutes: number, inc: number) => call<{ id: string; white: string }>('POST', '/match', { to, minutes, inc });
export const acceptMatch = (id: string) => call<{ ok: true }>('POST', `/${id}/accept`);
export const cancelMatch = (id: string) => call<{ ok: true }>('POST', `/${id}/cancel`);
/** A friendly game's room id ("mt" and six letters or digits). */
export const isMatchId = (id: string) => /^mt[a-km-np-z2-9]{6}$/.test(id);

/** The owner: every cup's data wiped. */
export const resetCups = () => call<{ ok: true; wiped: string[] }>('POST', '/reset');

/** "6:30 pm" in India time (the cups' times; the site is for India). */
export function cupTime(t: number, lang = 'en'): string {
  // 0-9 in every language, as on the rest of the site.
  return new Date(t).toLocaleTimeString(`${lang === 'en' ? 'en' : lang}-IN-u-nu-latn`, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}
/** "1:05:09" or "4:59" until a moment. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
/** The cup a summary is about: the first still to come or being played. */
export const nextCup = (t: Today | undefined) => t?.cups.find((c) => c.status === 'running') ?? t?.cups.find((c) => c.status === 'open' && c.startAt > t.now - 60_000);

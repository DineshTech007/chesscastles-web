import { get, writable } from 'svelte/store';
import { lichessToken } from '$lib/auth';
import * as api from '$lib/lichessBoard';
import { incomingChallenges, openWhenStarted, onLichessEvent, type IncomingChallenge } from '$lib/lichessEvents';
import { call } from '$lib/social';
import { goto } from '$app/navigation';
import { cancelMatch, createMatch, isMatchId } from '$lib/cups/api';
import { isBullet, roomGame } from '$lib/playWhere';

/**
 * Game invites between Chess Castles players (owner, 2026-10-21: "our own lobby… they should get a proper popup";
 * kids were refused with "Cannot challenge due to provisional Blitz rating"). The inviter's browser makes a Lichess
 * game only the two of them can join (no Lichess challenge, so no one's Lichess settings can refuse it) and joins it;
 * the invite goes through Chess Castles (server/api-worker src/social.ts) and the other player's site shows it as a
 * popup (ChallengePopup), wherever they are. Blitz and slower between two Lichess accounts are played here on Lichess's
 * servers; bullet, which Lichess plays only on its own site, and any game where either player has no Lichess account,
 * are played on Chess Castles' own server instead (owner, 2026-10-23: "never redirect to Lichess"; 2026-10-24: friends
 * play each other at any time control): a friendly game in a room of ours (server/api-worker src/cup.ts, "match"), no
 * ratings, nothing opens elsewhere. See src/lib/playWhere.ts.
 */
export interface ServerInvite {
  id: string;
  from: string;
  name: string;
  title?: string;
  rating?: number;
  tc: string;
  rated: boolean;
  color: 'white' | 'black';
  join?: string;
  /** A Puzzle Battle (tc "battle"): `id` is the race on Chess Castles (src/lib/racer). */
  battle?: boolean;
  at: number;
}

export { isBullet };

/** Whether a game with `them` at this clock is played in a room of ours (see playWhere.ts). */
export const playsHere = (them: string, minutes: number, increment: number) => roomGame(!!lichessToken(), them, minutes, increment);

/** The invite this player sent, while it waits for an answer. */
export const sentInvite = writable<{ id: string; to: string; name: string; tc: string; bullet: boolean; state: 'waiting' | 'declined' | 'gone' } | undefined>();

export const myInvites = () => call<{ invites: ServerInvite[] }>('GET', 'invites').then((r) => r.invites);
export const answerInvite = (id: string, answer: 'accepted' | 'declined') => call<{ status: string }>('POST', 'invites/answer', { id, answer }).catch(() => undefined);
const sentStatus = (to: string, id: string) => call<{ status: string }>('GET', `invites/sent?to=${encodeURIComponent(to)}&id=${id}`).then((r) => r.status);

/**
 * Invites a Chess Castles player to a game. Bullet, and any game where one of the two has no Lichess account, is a
 * friendly game on our own server (the inviter's page goes to the game's room to wait there); the rest are games on
 * Lichess for two Lichess accounts.
 */
export async function invitePlayer(p: { uid: string; name: string }, minutes: number, increment: number, rated: boolean): Promise<void> {
  if (playsHere(p.uid, minutes, increment)) return inviteMatch(p, minutes, increment);
  const me = lichessToken();
  if (!me) throw new Error('Connect your Lichess account to play online.');
  const theirs = p.uid.startsWith('lichess:') ? p.uid.slice(8) : undefined;
  if (!theirs) throw new Error(`${p.name} hasn't connected a Lichess account yet, so you can't play online together.`);
  const bullet = false;
  try {
    const meWhite = Math.random() < 0.5;
    const g = await api.openGame(me.token, { white: meWhite ? me.username : theirs, black: meWhite ? theirs : me.username, minutes, increment, rated });
    await api.acceptChallenge(me.token, g.id);
    openWhenStarted(g.id);
    const tc = `${minutes}+${increment}`;
    await call('POST', 'invites', { to: p.uid, game: g.id, tc, rated, color: meWhite ? 'black' : 'white' });
    sentInvite.set({ id: g.id, to: p.uid, name: p.name, tc, bullet, state: 'waiting' });
    void watchSent(me.token, g.id, p.uid);
  } catch (e) {
    throw e instanceof Error ? e : new Error('The invite could not be sent. Try again.');
  }
}

/** A friendly game: the room is made, the invite sent, and this page goes to the room to wait for the answer. */
async function inviteMatch(p: { uid: string; name: string }, minutes: number, inc: number): Promise<void> {
  const m = await createMatch(p.uid, minutes, inc);
  const tc = `${minutes}+${inc}`;
  try {
    await call('POST', 'invites', { to: p.uid, game: m.id, tc, rated: false, color: m.white === p.uid ? 'white' : 'black' });
  } catch (e) {
    void cancelMatch(m.id).catch(() => {});
    throw e instanceof Error ? e : new Error('The invite could not be sent. Try again.');
  }
  sentInvite.set({ id: m.id, to: p.uid, name: p.name, tc, bullet: true, state: 'waiting' });
  void watchMatch(m.id, p.uid);
  await goto(`/play/match/${m.id}`);
}

/** Waits for the answer to a friendly game's invite: "no" (or nothing) calls the room off. The room itself tells the page when it starts. */
async function watchMatch(id: string, to: string) {
  const until = Date.now() + 125_000;
  while (Date.now() < until && get(sentInvite)?.id === id) {
    await new Promise((r) => setTimeout(r, 4000));
    if (get(sentInvite)?.id !== id) return;
    const status = await sentStatus(to, id).catch(() => 'open');
    if (status === 'accepted') return sentInvite.update((s) => (s?.id === id ? undefined : s));
    if (status === 'declined' || status === 'gone') {
      void cancelMatch(id).catch(() => {});
      sentInvite.update((s) => (s?.id === id ? undefined : s));
      return;
    }
  }
}

/** Takes back the invite this player sent (its game too, before it starts). */
export function cancelSent() {
  const s = get(sentInvite);
  const t = lichessToken()?.token;
  if (s?.bullet && s.state === 'waiting') void cancelMatch(s.id).catch(() => {});
  if (s && s.state === 'waiting') {
    if (t && !s.bullet) void api.cancelChallenge(t, s.id).catch(() => {});
    void call('POST', 'invites/withdraw', { to: s.to, id: s.id }).catch(() => {});
  }
  sentInvite.set(undefined);
}

/** Waits for the answer to the invite sent: the game starting (Lichess's stream), or "no" from the other player. */
async function watchSent(token: string, id: string, to: string) {
  let started = false;
  const off = onLichessEvent((e) => {
    if (e?.type === 'gameStart' && e.game?.gameId === id) started = true;
  });
  const until = Date.now() + 125_000;
  try {
    while (Date.now() < until && !started && get(sentInvite)?.id === id) {
      await new Promise((r) => setTimeout(r, 4000));
      if (started || get(sentInvite)?.id !== id) break;
      const status = await sentStatus(to, id).catch(() => 'open');
      if (status === 'declined' || status === 'gone') {
        void api.cancelChallenge(token, id).catch(() => {});
        sentInvite.update((s) => (s?.id === id ? { ...s, state: status === 'declined' ? 'declined' : 'gone' } : s));
        return;
      }
    }
    if (started) sentInvite.update((s) => (s?.id === id ? undefined : s));
    else if (get(sentInvite)?.id === id && get(sentInvite)?.state === 'waiting') {
      // No answer in two minutes: the invite and its game go.
      void api.cancelChallenge(token, id).catch(() => {});
      sentInvite.update((s) => (s?.id === id ? { ...s, state: 'gone' } : s));
    }
  } finally {
    off();
  }
}

// ---- invites to this player: a popup on every page (ChallengePopup), from a look every 15 seconds

/** Answered here already (the server's list catches up a moment later). */
const answered = new Set<string>();
/** By invite and when it was sent: the same battle sent again is a new invite. */
export const markAnswered = (id: string, at = 0) => answered.add(`${id}:${at}`);

const toChallenge = (i: ServerInvite): IncomingChallenge => {
  if (i.battle) return { id: i.id, from: i.name, fromTitle: i.title, fromRating: i.rating, minutes: 0, increment: 0, rated: false, at: i.at, cc: { from: i.from, battle: true } };
  const [m, inc] = i.tc.split('+').map(Number);
  return { id: i.id, from: i.name, fromTitle: i.title, fromRating: i.rating, minutes: m, increment: inc, rated: i.rated, myColor: i.color, speed: isBullet(m, inc) ? 'bullet' : undefined, at: i.at, cc: { from: i.from, join: i.join } };
};

/** A Puzzle Battle invite: the friend's site shows it as a popup and Accept takes them into the race. */
export const inviteToBattle = (to: string, raceId: string) => call<{ sent: true }>('POST', 'invites', { to, game: raceId, tc: 'battle' });

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let onGame: () => boolean = () => false;
async function look() {
  if (!running) return;
  clearTimeout(timer);
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !onGame()) {
    const list = await myInvites().catch(() => undefined);
    if (list && running) {
      // Without a Lichess account: only the games that need none (a Puzzle Battle, a game in a room of our own).
      const canLichess = !!lichessToken();
      const fresh = list
        .filter((i) => !answered.has(`${i.id}:${i.at}`) && !answered.has(`${i.id}:0`))
        .filter((i) => canLichess || i.battle || isMatchId(i.id))
        .map(toChallenge);
      incomingChallenges.update((l) => [...l.filter((c) => !c.cc), ...fresh]);
    }
  }
  if (running) timer = setTimeout(look, 15_000);
}
/** Looks for invites every 15 seconds while the page is in front and isn't a game (`onGamePage`: no popup over a game). */
export function watchInvites(onGamePage: () => boolean) {
  onGame = onGamePage;
  if (running) return;
  running = true;
  void look();
}
export function stopInvites() {
  running = false;
  clearTimeout(timer);
  incomingChallenges.update((l) => l.filter((c) => !c.cc));
}
/** Back on the page after a while: a look now. */
export function lookForInvitesNow() {
  if (running) void look();
}

import { get, writable } from 'svelte/store';
import { lichessToken } from '$lib/auth';
import * as api from '$lib/lichessBoard';
import { incomingChallenges, openWhenStarted, onLichessEvent, type IncomingChallenge } from '$lib/lichessEvents';
import { call } from '$lib/social';

/**
 * Game invites between Chess Castles players (owner, 2026-10-21: "our own lobby… they should get a proper popup";
 * kids were refused with "Cannot challenge due to provisional Blitz rating"). The inviter's browser makes a Lichess
 * game only the two of them can join (no Lichess challenge, so no one's Lichess settings can refuse it) and joins it;
 * the invite goes through Chess Castles (server/api-worker src/social.ts) and the other player's site shows it as a
 * popup (ChallengePopup), wherever they are. Blitz and slower are played here; bullet, which Lichess plays only on its
 * own site, opens there for both.
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

/** Bullet by Lichess's count (minutes + 40 × increment under 3 minutes): played on lichess.org. */
export const isBullet = (minutes: number, increment: number) => minutes * 60 + increment * 40 < 180;

/** The invite this player sent, while it waits for an answer. */
export const sentInvite = writable<{ id: string; to: string; name: string; tc: string; bullet: boolean; state: 'waiting' | 'declined' | 'gone' } | undefined>();

export const myInvites = () => call<{ invites: ServerInvite[] }>('GET', 'invites').then((r) => r.invites);
export const answerInvite = (id: string, answer: 'accepted' | 'declined') => call<{ status: string }>('POST', 'invites/answer', { id, answer }).catch(() => undefined);
const sentStatus = (to: string, id: string) => call<{ status: string }>('GET', `invites/sent?to=${encodeURIComponent(to)}&id=${id}`).then((r) => r.status);

/**
 * Invites a Chess Castles player with a Lichess account to a game. Call it straight from the tap: for bullet a tab
 * is opened at once (a browser lets a page open one only from a tap) and goes to the game on lichess.org.
 */
export async function invitePlayer(p: { uid: string; name: string }, minutes: number, increment: number, rated: boolean): Promise<void> {
  const me = lichessToken();
  if (!me) throw new Error('Connect your Lichess account to play online.');
  const theirs = p.uid.startsWith('lichess:') ? p.uid.slice(8) : undefined;
  if (!theirs) throw new Error(`${p.name} hasn't connected a Lichess account yet, so you can't play online together.`);
  const bullet = isBullet(minutes, increment);
  const tab = bullet ? window.open('', '_blank') : null;
  try {
    const meWhite = Math.random() < 0.5;
    const g = await api.openGame(me.token, { white: meWhite ? me.username : theirs, black: meWhite ? theirs : me.username, minutes, increment, rated });
    if (bullet) {
      const mine = meWhite ? g.urlWhite : g.urlBlack;
      if (tab) tab.location.href = mine;
      else window.open(mine, '_blank');
    } else {
      await api.acceptChallenge(me.token, g.id);
      openWhenStarted(g.id);
    }
    const tc = `${minutes}+${increment}`;
    await call('POST', 'invites', { to: p.uid, game: g.id, tc, rated, color: meWhite ? 'black' : 'white', join: bullet ? (meWhite ? g.urlBlack : g.urlWhite) : undefined });
    sentInvite.set({ id: g.id, to: p.uid, name: p.name, tc, bullet, state: 'waiting' });
    void watchSent(me.token, g.id, p.uid);
  } catch (e) {
    tab?.close();
    throw e instanceof Error ? e : new Error('The invite could not be sent. Try again.');
  }
}

/** Takes back the invite this player sent (its game too, before it starts). */
export function cancelSent() {
  const s = get(sentInvite);
  const t = lichessToken()?.token;
  if (s && t && s.state === 'waiting') {
    void api.cancelChallenge(t, s.id).catch(() => {});
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
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !onGame() && lichessToken()) {
    const list = await myInvites().catch(() => undefined);
    if (list && running) {
      const fresh = list.filter((i) => !answered.has(`${i.id}:${i.at}`) && !answered.has(`${i.id}:0`)).map(toChallenge);
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

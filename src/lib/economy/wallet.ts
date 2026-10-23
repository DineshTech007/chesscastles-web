/**
 * The player's Treasury in the browser: gold, gems, level, items and what they wear (the rules: ./core.ts).
 * - Signed in: the API worker keeps the treasury (/social/wallet…), the same on every device. The browser runs the
 *   same rules at once (a reward shows the moment it is won) and then takes the server's answer as the truth.
 * - A visitor (signed out): a treasury in this browser, carried into the account at sign-in (gold and gems, once).
 * - A server without the Treasury yet (before it is deployed) or offline: the account's treasury lives in this
 *   browser and is carried in the same way once the server has it.
 * Never in a URL, never sent anywhere but Chess Castles' own API.
 */
import { get, writable } from 'svelte/store';
import { session } from '$lib/auth';
import { call } from '$lib/social';
import {
  ITEM,
  STARTER_BOARDS,
  WELCOME,
  buy,
  carry,
  claimDaily,
  claimQuest,
  cleanWallet,
  earn,
  equip,
  newWallet,
  owns,
  type EarnEvent,
  type Grant,
  type Wallet,
  type WearSlot,
} from './core';

export type Mode = 'loading' | 'guest' | 'local' | 'server';

/** "2026-10-23" in the player's own time zone (the day the daily reward and quests count). */
export function today(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const blank = () => newWallet(Date.now()).wallet;
export const wallet = writable<Wallet>(blank());
export const walletMode = writable<Mode>('loading');
/** Whose treasury is shown: a uid, or 'guest'. */
let who = '';
/** Where this browser keeps it: 'guest', the account's copy of the server's (its uid), or 'local:<uid>' (no server). */
let storeKey = '';

/** Rewards to show (RewardToasts.svelte), newest last. */
export interface Toast extends Grant {
  id: number;
}
export const toasts = writable<Toast[]>([]);
let toastId = 0;
/** Rewards wait while a game is being played (no pop-ups over the board); they show when it ends. */
let holdToasts = false;
let held: Grant[] = [];
export function setToastHold(on: boolean) {
  holdToasts = on;
  if (!on && held.length) {
    const g = held;
    held = [];
    show(g);
  }
}
function show(grants: Grant[]) {
  if (!grants.length) return;
  if (holdToasts) return void held.push(...grants);
  // Many small rewards at once (several puzzles synced): one toast with the sum.
  const merged = grants.length > 3 ? [{ why: 'many', gold: grants.reduce((s, g) => s + g.gold, 0), gems: grants.reduce((s, g) => s + g.gems, 0) }] : grants;
  toasts.update((list) => [...list, ...merged.map((g) => ({ ...g, id: ++toastId }))].slice(-5));
}
export const dismissToast = (id: number) => toasts.update((l) => l.filter((t) => t.id !== id));

// ---- this browser's copy

const keyOf = (id: string) => `cc.wallet.${id}`;
function readLocal(id: string): Wallet | undefined {
  try {
    const raw = localStorage.getItem(keyOf(id));
    return raw ? cleanWallet(JSON.parse(raw), Date.now()) : undefined;
  } catch {
    return undefined;
  }
}
function writeLocal(id: string, w: Wallet) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify(w));
  } catch {
    /* storage full or blocked: for this visit only */
  }
}
function set(w: Wallet) {
  wallet.set(w);
  if (storeKey) writeLocal(storeKey, w);
}

// ---- the server

type Reply = { wallet: unknown; grants?: Grant[] };
/** The server's treasury calls run one at a time, in order. */
let chain: Promise<unknown> = Promise.resolve();
/** Rewards already shown here and not yet confirmed by the server: shown again on top of its answer. */
let pending: EarnEvent[] = [];
const serial = <T>(f: () => Promise<T>): Promise<T> => {
  const p = chain.then(f, f);
  chain = p.catch(() => undefined);
  return p;
};
function adopt(r: Reply) {
  let w = cleanWallet(r.wallet, Date.now());
  for (const ev of pending) {
    const x = earn(w, ev, today(), Date.now());
    if (x.ok) w = x.wallet;
  }
  set(w);
}
/** True when the server has no Treasury (yet): its 404, or an "unknown route" reply. */
const missing = (e: unknown) => e instanceof Error && /no such|not found|unknown|404/i.test(e.message);

async function loadServer(uid: string) {
  try {
    const r = await call<Reply>('GET', 'wallet');
    if (who !== uid) return;
    walletMode.set('server');
    storeKey = uid;
    adopt(r);
    show(r.grants ?? []);
    await carryIn(uid);
    applyLooks();
  } catch (e) {
    if (who !== uid) return;
    // No Treasury on the server yet, or offline: this browser keeps it for now.
    walletMode.set('local');
    storeKey = `local:${uid}`;
    set(readLocal(storeKey) ?? blank());
    applyLooks();
    if (!missing(e)) console.warn('treasury: server not reached', e);
  }
}

/** A visitor's (or a server-less) treasury carried into the account: its earnings only (not the welcome gift), once. */
async function carryIn(uid: string) {
  const parts = ['guest', `local:${uid}`].map((k) => ({ k, w: readLocal(k) })).filter((x) => x.w);
  if (!parts.length) return;
  const gold = parts.reduce((s, x) => s + Math.max(0, Math.min(x.w!.gold, x.w!.xp)), 0);
  const gems = parts.reduce((s, x) => s + Math.max(0, x.w!.gems - WELCOME.gems), 0);
  const done = () => {
    for (const x of parts)
      try {
        localStorage.removeItem(keyOf(x.k));
      } catch {
        /* blocked */
      }
  };
  if (!gold && !gems) return done();
  const r = await call<Reply>('POST', 'wallet/carry', { gold, gems }).catch(() => undefined);
  if (r) {
    adopt(r);
    show(r.grants ?? []);
  }
  done();
}

// ---- what the pages call

/** Starts the Treasury for whoever is signed in (or the visitor); once, from +layout.svelte. */
export function startWallet(): () => void {
  // For the local browser tests (as window.__race on the Racer page): rewards can be sent by hand.
  if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __treasury: unknown }).__treasury = { record, wallet, walletMode, claimDailyReward, purchase, wear };
  return session.subscribe((s) => {
    if (s.status === 'loading') return;
    const id = s.status === 'in' ? s.uid : 'guest';
    if (id === who) return;
    who = id;
    pending = [];
    if (s.status === 'out') {
      walletMode.set('guest');
      storeKey = 'guest';
      let w = readLocal('guest');
      if (!w) {
        const n = newWallet(Date.now());
        w = n.wallet;
      }
      set(w);
      applyLooks();
      return;
    }
    // Signed in: this browser's copy at once (or a fresh one), then the server's.
    walletMode.set('loading');
    storeKey = '';
    wallet.set(readLocal(id) ?? readLocal(`local:${id}`) ?? blank());
    applyLooks();
    void loadServer(id);
  });
}

/** Things done (games, puzzles, lessons…): rewards shown now, the server told a moment later. */
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let outbox: EarnEvent[] = [];
export function record(events: EarnEvent[]) {
  if (!events.length || !who) return;
  // The account's treasury is still on its way: these wait a moment for it.
  if (get(walletMode) === 'loading') return void setTimeout(() => record(events), 1500);
  let w = get(wallet);
  const grants: Grant[] = [];
  const day = today();
  for (const ev of events) {
    const r = earn(w, ev, day, Date.now());
    if (r.ok) {
      w = r.wallet;
      grants.push(...r.grants);
    }
  }
  set(w);
  show(grants);
  if (get(walletMode) !== 'server') return;
  pending.push(...events);
  outbox.push(...events);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 1500);
}
function flush() {
  const batch = outbox.splice(0, 50);
  if (!batch.length) return;
  const uid = who;
  void serial(async () => {
    const r = await call<Reply>('POST', 'wallet/earn', { day: today(), events: batch }).catch(() => undefined);
    // Sent (or refused): no longer pending. A failure (offline) keeps the reward on this device until the next load.
    pending = pending.filter((e) => !batch.includes(e));
    if (r && who === uid) adopt(r);
  });
  if (outbox.length) flushTimer = setTimeout(flush, 500);
}

type Outcome = { ok: true; grants: Grant[] } | { ok: false; error: string };
/** One server change (claim, buy, wear): done here first, then confirmed (or undone) by the server. */
async function act(local: (w: Wallet) => ReturnType<typeof buy>, path: string, body: Record<string, unknown>, quiet = false): Promise<Outcome> {
  const before = get(wallet);
  const r = local(before);
  if (!r.ok) return { ok: false, error: r.error };
  set(r.wallet);
  if (!quiet) show(r.grants);
  if (get(walletMode) !== 'server') return { ok: true, grants: r.grants };
  const uid = who;
  try {
    const reply = await serial(() => call<Reply>('POST', `wallet/${path}`, body));
    if (who === uid) adopt(reply);
    return { ok: true, grants: r.grants };
  } catch (e) {
    // The server said no (or could not be reached): back to how it was.
    if (who === uid) set(before);
    return { ok: false, error: e instanceof Error ? e.message : 'error' };
  }
}

export const claimDailyReward = () => {
  const day = today();
  return act((w) => claimDaily(w, day, Date.now()), 'daily', { day });
};
export const claimQuestReward = (id: string) => {
  const day = today();
  return act((w) => claimQuest(w, id, day, Date.now()), 'quest', { day, id });
};
/** Buying needs an account (so the item is never lost with a browser's data). */
export const purchase = (id: string) => {
  if (get(walletMode) === 'guest') return Promise.resolve<Outcome>({ ok: false, error: 'signin' });
  const day = today();
  return act((w) => buy(w, id, day, Date.now()), 'buy', { item: id, day }, true);
};
/** Wears an item (or takes it off with ''): the board, pieces and finish change at once on every board. */
export async function wear(slot: WearSlot, id: string): Promise<Outcome> {
  const r = await act((w) => equip(w, slot, id), 'equip', { slot, item: id }, true);
  if (r.ok) applyLooks(slot);
  return r;
}

// ---- the looks on this device

/**
 * Puts what the player wears on every board: the board (a Shop board only while owned), the piece set (the same),
 * the finish, and the sound theme. A board or piece set picked in the board picker (BoardThemeModal) wins on this
 * device; the Shop's "Wear it" sets it again.
 */
export function applyLooks(changed?: WearSlot) {
  if (typeof document === 'undefined') return;
  const w = get(wallet);
  const root = document.documentElement;
  const sure = get(walletMode) !== 'loading';
  // A Shop board, piece set or sound pack not owned by whoever is signed in now (another account, or signed out): the default.
  const board = root.dataset.board;
  if (board && ITEM[board] && !owns(w, board) && sure) void import('$lib/boardTheme').then((m) => m.applyBoardTheme('stone'));
  const pieces = root.dataset.pieces;
  if (pieces && ITEM[pieces] && !owns(w, pieces) && sure) void import('$lib/pieceSets').then((m) => m.applyPieceSet(m.DEFAULT_PIECES));
  if (sure)
    void import('$lib/sound').then((m) => {
      const t = get(m.soundTheme);
      if (ITEM[t] && !owns(w, t)) m.setSoundTheme('wood');
      if (changed === 'sound' && w.equipped.sound && owns(w, w.equipped.sound)) m.setSoundTheme(w.equipped.sound as import('$lib/sound').SoundTheme);
    });
  if (changed === 'board' && w.equipped.board) void import('$lib/boardTheme').then((m) => m.applyBoardTheme(w.equipped.board!));
  if (changed === 'pieces' && w.equipped.pieces) void import('$lib/pieceSets').then((m) => m.applyPieceSet(w.equipped.pieces!));
  const finish = w.equipped.finish && owns(w, w.equipped.finish) ? w.equipped.finish : '';
  if (finish) root.dataset.finish = finish;
  else delete root.dataset.finish;
}

/** Whether a board can be picked: everyone's boards, or a Shop board the player owns. */
export const boardAllowed = (id: string, w: Wallet) => STARTER_BOARDS.includes(id) || owns(w, id);

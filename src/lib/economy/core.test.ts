import { describe, expect, it } from 'vitest';
import { BOARD_THEMES } from '$lib/boardTheme';
import { PIECE_SETS } from '$lib/pieceSets';
import { SOUND_THEMES } from '$lib/sound';
import {
  CARRY_MAX,
  EARN,
  ITEMS,
  LADDER,
  MAX_SHIELDS,
  QUEST_BONUS,
  STARTER_BOARDS,
  STARTER_PIECES,
  STARTER_SOUNDS,
  WELCOME,
  buy,
  canClaim,
  carry,
  claimDaily,
  claimQuest,
  cleanWallet,
  cupSync,
  serverDay,
  historySync,
  GEMS_PER_DAY,
  OVER_CAP_TIMES,
  HISTORY_MAX,
  dealsFor,
  earn,
  equip,
  levelOf,
  liveStreak,
  newWallet,
  priceOf,
  publicLook,
  questsFor,
  xpFor,
  type Wallet,
} from './core';

const NOW = Date.UTC(2026, 9, 23, 6);
const fresh = () => newWallet(NOW).wallet;
const ok = (r: ReturnType<typeof earn>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('the treasury', () => {
  it('starts with the welcome gift and the Founder’s Crest', () => {
    const { wallet, grants } = newWallet(NOW);
    expect(wallet.gold).toBe(WELCOME.gold);
    expect(wallet.gems).toBe(WELCOME.gems);
    expect(wallet.xp).toBe(0);
    expect(wallet.owned).toContain('founder');
    expect(grants.map((g) => g.why)).toEqual(['welcome', 'unlock']);
    // After the launch year, no crest.
    expect(newWallet(Date.UTC(2027, 1, 1)).wallet.owned).not.toContain('founder');
  });

  it('keeps the starter boards and piece sets in step with the pickers', () => {
    expect(STARTER_BOARDS.sort()).toEqual(BOARD_THEMES.filter((b) => !b.shop).map((b) => b.id).sort());
    expect(STARTER_PIECES.sort()).toEqual(PIECE_SETS.filter((p) => !p.shop).map((p) => p.id).sort());
    // Every shop board and piece set has its look in the pickers' lists, and every sound pack its sounds.
    for (const i of ITEMS.filter((x) => x.slot === 'board')) expect(BOARD_THEMES.some((b) => b.id === i.id && b.shop)).toBe(true);
    for (const i of ITEMS.filter((x) => x.slot === 'pieces')) expect(PIECE_SETS.some((p) => p.id === i.id && p.shop)).toBe(true);
    for (const i of ITEMS.filter((x) => x.slot === 'sound')) expect(SOUND_THEMES).toContain(i.id);
    for (const id of STARTER_SOUNDS) expect(SOUND_THEMES).toContain(id);
  });

  it('has sensible items: unique ids, one price each, Royal items won not sold', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of ITEMS) {
      expect(i.id).toMatch(/^[a-z0-9-]{2,24}$/);
      if (i.rarity === 'royal') expect(i.unlock && !i.gold && !i.gems).toBeTruthy();
      else expect(!!i.gold !== !!i.gems).toBe(true);
      expect(STARTER_BOARDS).not.toContain(i.id);
    }
  });

  it('pays a game once, up to the day’s cap, and counts it for the quests', () => {
    let w = fresh();
    let r = ok(earn(w, { kind: 'win', ref: 'g1' }, '2026-10-23', NOW));
    expect(r.wallet.gold).toBe(WELCOME.gold + EARN.win.gold);
    expect(r.wallet.xp).toBe(EARN.win.gold);
    expect(r.grants[0]).toMatchObject({ why: 'win', gold: EARN.win.gold });
    // The same game again pays nothing.
    const again = ok(earn(r.wallet, { kind: 'win', ref: 'g1' }, '2026-10-23', NOW));
    expect(again.wallet).toBe(r.wallet);
    expect(again.grants).toEqual([]);
    // Past the cap: counted, unpaid.
    w = r.wallet;
    for (let i = 0; i < EARN.daily.cap + 2; i++) w = ok(earn(w, { kind: 'daily', ref: `d${i}` }, '2026-10-23', NOW)).wallet;
    expect(w.today.counts.daily).toBe(EARN.daily.cap + 2);
    expect(w.gold).toBe(WELCOME.gold + EARN.win.gold + EARN.daily.gold * EARN.daily.cap);
    // A new day starts the counts again.
    r = ok(earn(w, { kind: 'daily', ref: 'next' }, '2026-10-24', NOW));
    expect(r.wallet.today).toMatchObject({ day: '2026-10-24', counts: { daily: 1 } });
    expect(r.grants[0].gold).toBe(EARN.daily.gold);
  });

  it('gives Puzzle Rush a bonus for the score', () => {
    const r = ok(earn(fresh(), { kind: 'rush', score: 24 }, '2026-10-23', NOW));
    expect(r.grants[0].gold).toBe(EARN.rush.gold + 12);
    const big = ok(earn(fresh(), { kind: 'rush', score: 400 }, '2026-10-23', NOW));
    expect(big.grants[0].gold).toBe(EARN.rush.gold + 30);
  });

  it('pays levels in gems, once', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(xpFor(2))).toBe(2);
    expect(levelOf(xpFor(2) - 1)).toBe(1);
    expect(levelOf(xpFor(10))).toBe(10);
    let w = fresh();
    const gems = w.gems;
    // 7 awards: 350 XP, past level 2 (100) and 3 (300).
    for (let i = 0; i < 7; i++) w = ok(earn(w, { kind: 'award', ref: `a${i}` }, '2026-10-23', NOW)).wallet;
    expect(levelOf(w.xp)).toBe(3);
    expect(w.levelPaid).toBe(3);
    expect(w.gems).toBe(gems + 7 * EARN.award.gems + 3 + 3);
  });
});

describe('the server decides the day', () => {
  // 2026-10-24 20:00 UTC is already the 25th in India (UTC+5:30), still the 24th in London.
  const T = Date.UTC(2026, 9, 24, 20, 0);
  it('uses the server clock and the pinned zone, not the device date', () => {
    const a = serverDay(fresh(), 330, T);
    expect(a.day).toBe('2026-10-25');
    expect(a.wallet.tz).toEqual({ off: 330, at: T });
    // A browser claiming another zone the next hour (a kid flipping zones) gets the pinned one.
    expect(serverDay(a.wallet, -720, T + 3_600_000).day).toBe('2026-10-25');
    // A real move is accepted after a week.
    const b = serverDay(a.wallet, 0, T + 8 * 86_400_000);
    expect(b.wallet.tz?.off).toBe(0);
    expect(b.day).toBe('2026-11-01');
  });
  it('does not pin when the browser says nothing (India by default), and ignores nonsense', () => {
    expect(serverDay(fresh(), undefined, T)).toMatchObject({ day: '2026-10-25' });
    expect(serverDay(fresh(), undefined, T).wallet.tz).toBeUndefined();
    expect(serverDay(fresh(), 99999, T).wallet.tz).toBeUndefined();
    expect(serverDay(fresh(), '330', T).wallet.tz).toBeUndefined();
  });
  it('keeps the pinned zone through cleanWallet', () => {
    expect(cleanWallet(JSON.parse(JSON.stringify(serverDay(fresh(), 60, T).wallet)), T).tz).toEqual({ off: 60, at: T });
    expect(cleanWallet({ tz: { off: 5000, at: 1 } }, T).tz).toBeUndefined();
  });
});

describe('the daily visit', () => {
  it('climbs the 7-day calendar and keeps the streak', () => {
    let w = fresh();
    expect(canClaim(w, '2026-10-23')).toBe(true);
    let r = claimDaily(w, '2026-10-23', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.grants[0]).toMatchObject({ why: 'login', gold: LADDER[0].gold });
    w = r.wallet;
    expect(canClaim(w, '2026-10-23')).toBe(false);
    expect(claimDaily(w, '2026-10-23', NOW).ok).toBe(false);
    for (let d = 24; d <= 29; d++) {
      r = claimDaily(w, `2026-10-${d}`, NOW);
      if (!r.ok) throw new Error(r.error);
      w = r.wallet;
    }
    expect(w.login).toMatchObject({ streak: 7, best: 7, total: 7 });
    // Day 7: the big reward, the 3- and 7-day milestones, and the Squire's Pennant.
    expect(w.owned).toContain('bpennant');
    expect(w.milestones).toEqual([3, 7]);
  });

  it('pauses the calendar on a missed day, and a shield saves the streak', () => {
    let w = fresh();
    for (const d of ['2026-10-20', '2026-10-21', '2026-10-22']) {
      const r = claimDaily(w, d, NOW);
      if (!r.ok) throw new Error(r.error);
      w = r.wallet;
    }
    // Missed the 23rd: without a shield the streak starts again, the calendar goes on to day 4.
    expect(liveStreak(w, '2026-10-24')).toBe(0);
    let r = claimDaily(w, '2026-10-24', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.wallet.login).toMatchObject({ streak: 1, total: 4 });
    expect(r.grants[0].gold).toBe(LADDER[3].gold);
    // With a shield bought the day before: saved.
    const b = buy({ ...w, gold: 1000 }, 'shield', '2026-10-22', NOW);
    if (!b.ok) throw new Error(b.error);
    expect(liveStreak(b.wallet, '2026-10-24')).toBe(3);
    r = claimDaily(b.wallet, '2026-10-24', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.wallet.login).toMatchObject({ streak: 4, saved: 1 });
    expect(r.wallet.shields).toBe(0);
  });
});

describe('quests', () => {
  it('picks one quest of each kind a day, the same everywhere', () => {
    const q = questsFor('2026-10-23');
    expect(q.map((x) => x.group)).toEqual(['play', 'puzzles', 'learn']);
    expect(questsFor('2026-10-23')).toEqual(q);
  });

  it('pays a finished quest once, and the bonus for all three', () => {
    const day = '2026-10-23';
    let w = fresh();
    const qs = questsFor(day);
    expect(claimQuest(w, qs[0].id, day, NOW)).toMatchObject({ ok: false, error: 'not-done' });
    // Do everything the quests ask.
    let i = 0;
    for (const q of qs) for (let k = 0; k < q.need; k++) w = ok(earn(w, { kind: q.kinds[0], ref: `x${i++}` }, day, NOW)).wallet;
    let total = 0;
    for (const q of qs) {
      const r = claimQuest(w, q.id, day, NOW);
      if (!r.ok) throw new Error(r.error);
      w = r.wallet;
      total += r.grants.reduce((s, g) => s + g.gems, 0);
    }
    expect(w.today.bonus).toBe(true);
    expect(total).toBeGreaterThanOrEqual(QUEST_BONUS.gems);
    expect(claimQuest(w, qs[0].id, day, NOW)).toMatchObject({ ok: false, error: 'claimed' });
  });
});

describe('the shop', () => {
  it('sells for the right currency, once, and never Royal items', () => {
    const day = '2026-10-23';
    const w = fresh();
    const moat = ITEMS.find((i) => i.id === 'moat')!;
    const price = priceOf(moat, day)!;
    const r = buy(w, 'moat', day, NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.wallet.gold).toBe(w.gold - price.amount);
    expect(r.wallet.owned).toContain('moat');
    expect(buy(r.wallet, 'moat', day, NOW)).toMatchObject({ ok: false, error: 'owned' });
    expect(buy(w, 'coronation', day, NOW)).toMatchObject({ ok: false, error: 'royal' });
    expect(buy(w, 'lavakeep', day, NOW)).toMatchObject({ ok: false, error: 'short' });
    // Shields: at most two.
    let s: Wallet = { ...w, gold: 5000 };
    for (let i = 0; i < MAX_SHIELDS; i++) {
      const b = buy(s, 'shield', day, NOW);
      if (!b.ok) throw new Error(b.error);
      s = b.wallet;
    }
    expect(buy(s, 'shield', day, NOW)).toMatchObject({ ok: false, error: 'owned' });
  });

  it('has three deals a day from different slots, a quarter off', () => {
    const deals = dealsFor('2026-10-23');
    expect(deals).toHaveLength(3);
    const item = ITEMS.find((i) => i.id === deals[0])!;
    const p = priceOf(item, '2026-10-23')!;
    expect(p.was).toBe(item.gold ?? item.gems);
    expect(p.amount).toBeLessThan(p.was!);
  });

  it('wears only what is owned, in its own slot', () => {
    const w = fresh();
    expect(equip(w, 'frame', 'aurora')).toMatchObject({ ok: false });
    expect(equip(w, 'frame', 'founder').ok).toBe(true);
    expect(equip(w, 'board', 'classic').ok).toBe(true);
    expect(equip(w, 'board', 'founder').ok).toBe(false);
    const r = equip(w, 'frame', 'founder');
    if (!r.ok) throw new Error(r.error);
    expect(publicLook(r.wallet)).toEqual({ level: 1, frame: 'founder' });
    const off = equip(r.wallet, 'frame', '');
    expect(off.ok && off.wallet.equipped.frame).toBeFalsy();
  });
});

describe('the server’s extras', () => {
  it('carries a visitor’s treasury in once, up to the limit', () => {
    const r = carry(fresh(), 10_000, 5, NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.wallet.gold).toBe(WELCOME.gold + CARRY_MAX.gold);
    expect(r.wallet.gems).toBe(WELCOME.gems + 5);
    expect(r.wallet.xp).toBe(0);
    expect(carry(r.wallet, 10, 0, NOW).ok).toBe(false);
  });

  it('notes the Castle Cups at first, then pays new ones (a win unlocks the Cup Champion frame)', () => {
    let r = cupSync(fresh(), 4, 1, 0, '2026-10-23', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.grants).toEqual([]);
    r = cupSync(r.wallet, 5, 2, 1, '2026-10-23', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.grants.map((g) => g.why)).toEqual(expect.arrayContaining(['cup', 'cupPodium', 'cupWin', 'unlock']));
    expect(r.wallet.owned).toContain('champion');
  });

  it('mends a damaged treasury instead of losing it', () => {
    const w = cleanWallet({ gold: -5, gems: '7', owned: ['moat', 'nope', 3], equipped: { frame: 'aurora', bogus: 'x' }, today: { day: 'x', counts: { win: 2, hack: 9 } } }, NOW);
    expect(w.gold).toBe(0);
    expect(w.gems).toBe(7);
    expect(w.owned).toEqual(['moat']);
    expect(w.equipped).toEqual({ frame: 'aurora' });
    expect(w.today.counts).toEqual({ win: 2 });
    expect(cleanWallet(null, NOW).gold).toBe(WELCOME.gold);
  });

  it('pays the past once: what was done before the Treasury, up to the limit, awards already paid left out', () => {
    const w0 = newWallet(NOW).wallet;
    const h = { puzzles: 100, rushRuns: 10, races: 10, raceWins: 5, wins: 3, draws: 2, losses: 1, awards: ['a', 'b'] };
    const r = historySync(w0, h, NOW);
    if (!r.ok) throw new Error(r.error);
    // 100x5 + 10x10 + 10x10 + 5x20 + 3x15 + 2x8 + 1x4 + 2 awards x50
    expect(r.wallet.gold).toBe(WELCOME.gold + 500 + 100 + 100 + 100 + 45 + 16 + 4 + 100);
    expect(r.wallet.gems).toBeGreaterThanOrEqual(WELCOME.gems + 6);
    expect(r.wallet.history).toBe(true);
    const again = historySync(r.wallet, h, NOW);
    expect(again.ok && again.grants).toEqual([]);
    // An award paid since the Treasury began (its ref is in the treasury) is not paid again.
    const paid = { ...w0, refs: ['a:a'] };
    const r2 = historySync(paid, { ...h, puzzles: 0, rushRuns: 0, races: 0, raceWins: 0, wins: 0, draws: 0, losses: 0 }, NOW);
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.wallet.gold).toBe(WELCOME.gold + 50);
    // Never more than the limit, however much was done.
    const big = historySync(w0, { ...h, puzzles: 100_000 }, NOW);
    if (!big.ok) throw new Error(big.error);
    expect(big.grants.find((g) => g.why === 'history')?.gold).toBe(HISTORY_MAX.gold);
  });

  it('pays gems for steady work: every N-th one of the day, up to a daily limit; past the cap only a coin', () => {
    let w = newWallet(NOW).wallet;
    const day = '2026-10-23';
    // 10 clean puzzles: one gem, at the tenth.
    for (let i = 1; i <= 10; i++) {
      const g0 = w.gems;
      w = ok(earn(w, { kind: 'puzzleClean', ref: `p${i}` }, day, NOW)).wallet;
      expect(w.gems - g0).toBe(i === 10 ? 1 : 0);
    }
    // Past the cap (40 a day): a coin each, up to three times the cap, then nothing.
    for (let i = 11; i <= EARN.puzzleClean.cap; i++) w = ok(earn(w, { kind: 'puzzleClean', ref: `p${i}` }, day, NOW)).wallet;
    const before = w.gold;
    w = ok(earn(w, { kind: 'puzzleClean', ref: 'over1' }, day, NOW)).wallet;
    expect(w.gold - before).toBe(1);
    for (let i = EARN.puzzleClean.cap + 2; i <= EARN.puzzleClean.cap * OVER_CAP_TIMES + 1; i++) w = ok(earn(w, { kind: 'puzzleClean', ref: `over${i}` }, day, NOW)).wallet;
    const end = w.gold;
    w = ok(earn(w, { kind: 'puzzleClean', ref: 'far' }, day, NOW)).wallet;
    expect(w.gold).toBe(end);
    // The day's gems from steady work stop at the limit (and a new day starts again).
    let v = newWallet(NOW).wallet;
    for (let i = 0; i < 200; i++) v = ok(earn(v, { kind: i % 2 ? 'vision' : 'lesson', ref: `v${i}` }, day, NOW)).wallet;
    expect(v.today.gems).toBeLessThanOrEqual(GEMS_PER_DAY);
    const tomorrow = ok(earn(v, { kind: 'vision', ref: 'next' }, '2026-10-24', NOW)).wallet;
    expect(tomorrow.today.gems).toBe(0);
  });
});

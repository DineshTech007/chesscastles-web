/**
 * Chess Castles plans on the website: Free, Premium and Elite.
 *
 * The API worker (server/api-worker/src/plans.ts) is the judge: useFeature()
 * asks it before a limited feature starts, and it counts the use. Visitors
 * who are not signed in get Free's limits, counted in this browser, and are
 * asked to sign in (free, with the launch offer).
 *
 * DEFAULT_CONFIG matches the server's defaults; the live numbers (the admin
 * page can change them) come from GET /plans.
 */
import { derived, get, writable } from 'svelte/store';
import { API } from '$lib/api';
import { session } from '$lib/auth';
import { call } from '$lib/social';
import { track } from '$lib/analytics';

/**
 * Plans are switched off until they start (planned for 1 January 2027):
 * every feature is open to everyone with no limits, and the site shows no
 * plan names, badges, prices or offers. Coach tools stay with the accounts
 * that have them (the server checks those). Set to true to bring plans back.
 */
export const PLANS_ON = false;

export type Plan = 'free' | 'premium' | 'elite';
export const PLANS: Plan[] = ['free', 'premium', 'elite'];
export const RANK: Record<Plan, number> = { free: 0, premium: 1, elite: 2 };
export type Per = 'day' | 'week' | 'month' | 'ever';
export interface Limit {
  n: number | null;
  per: Per;
}
export type Feature = 'fide_game' | 'tournament' | 'review' | 'insights' | 'guru' | 'puzzle' | 'vision' | 'opening';
export const FEATURES: Feature[] = ['fide_game', 'tournament', 'review', 'insights', 'guru', 'puzzle', 'vision', 'opening'];
export type Gate = 'bot_opening' | 'themed_puzzles' | 'own_lines' | 'coach_tools';
/** review_depth: how deep a Game Review takes its second look at the key moves. */
export type Quota = 'insights_games' | 'history' | 'review_depth';
export interface PlanConfig {
  limits: Record<Feature, Record<Plan, Limit>>;
  gates: Record<Gate, Plan>;
  quotas: Record<Quota, Record<Plan, number>>;
  prices: Record<Exclude<Plan, 'free'>, { month: number; year: number }>;
}
export interface Launch {
  on: boolean;
  plan: Plan;
  days: number;
  until: string;
}
export interface Banner {
  on: boolean;
  text: string;
  link: string;
}

const L = (n: number | null, per: Per = 'day'): Limit => ({ n, per });
const UNLIMITED = L(null);
export const DEFAULT_CONFIG: PlanConfig = {
  limits: {
    fide_game: { free: L(3), premium: UNLIMITED, elite: UNLIMITED },
    tournament: { free: L(1, 'week'), premium: UNLIMITED, elite: UNLIMITED },
    review: { free: L(2), premium: UNLIMITED, elite: UNLIMITED },
    insights: { free: L(1, 'month'), premium: UNLIMITED, elite: UNLIMITED },
    guru: { free: L(5), premium: UNLIMITED, elite: UNLIMITED },
    puzzle: { free: L(15), premium: UNLIMITED, elite: UNLIMITED },
    vision: { free: L(3), premium: UNLIMITED, elite: UNLIMITED },
    opening: { free: L(3, 'ever'), premium: UNLIMITED, elite: UNLIMITED },
  },
  gates: { bot_opening: 'premium', themed_puzzles: 'premium', own_lines: 'premium', coach_tools: 'elite' },
  quotas: {
    insights_games: { free: 20, premium: 200, elite: 300 },
    history: { free: 50, premium: 2000, elite: 3000 },
    review_depth: { free: 18, premium: 18, elite: 22 },
  },
  prices: { premium: { month: 149, year: 1499 }, elite: { month: 249, year: 1999 } },
};
export const DEFAULT_LAUNCH: Launch = { on: true, plan: 'premium', days: 30, until: '2027-01-17' };

/** How each plan presents itself. */
export const PLAN_INFO: Record<Plan, { name: string; tag: string; blurb: string }> = {
  free: { name: 'Free', tag: 'Free forever', blurb: 'Everything to start: play, analyse, puzzles, books and friends.' },
  premium: { name: 'Premium', tag: 'For regular players', blurb: 'Unlimited FIDE-level opponents, Game Reviews, Guru lessons, Insights and tournaments, plus all 17 puzzle themes.' },
  elite: { name: 'Elite', tag: 'For coaches and academies', blurb: 'Everything in Premium, plus coach tools for up to 200 students, deeper Game Review and more games kept in Insights and history.' },
};

/** Each limited feature, for tables and messages. */
export const FEATURE_INFO: Record<Feature, { label: string; one: string; many: string }> = {
  fide_game: { label: 'Play FIDE-level opponents', one: 'game against a FIDE-level opponent', many: 'games against FIDE-level opponents' },
  tournament: { label: 'FIDE tournaments with trophies', one: 'FIDE tournament', many: 'FIDE tournaments' },
  review: { label: 'Game Review (accuracy, badges, mistakes)', one: 'Game Review', many: 'Game Reviews' },
  insights: { label: 'Chess.com & Lichess Insights reports', one: 'Insights report', many: 'Insights reports' },
  guru: { label: 'Chess Guru lessons (AI coach)', one: 'Guru lesson', many: 'Guru lessons' },
  puzzle: { label: 'Rated puzzles', one: 'puzzle', many: 'puzzles' },
  vision: { label: 'Blindfold Gym sessions', one: 'Blindfold Gym session', many: 'Blindfold Gym sessions' },
  opening: { label: 'Opening trainer courses', one: 'opening course', many: 'opening courses' },
};
export const GATE_INFO: Record<Gate, string> = {
  bot_opening: 'Choose the opening a FIDE-level opponent plays',
  themed_puzzles: 'All 17 puzzle themes (Free has 4)',
  own_lines: 'Your own opening lines in the trainer',
  coach_tools: 'Coach tools: students, progress, homework',
};
export const QUOTA_INFO: Record<Quota, string> = {
  insights_games: 'Games in each Insights report',
  history: 'Games kept in your account',
  review_depth: 'Game Review: depth of the second look at key moves',
};
const PER_TEXT: Record<Per, string> = { day: 'a day', week: 'a week', month: 'a month', ever: 'in all' };
/** "3 a day", "Unlimited", "1 a week". */
export const limitText = (l: Limit) => (l.n === null ? 'Unlimited' : l.n === 0 ? '—' : `${l.n} ${PER_TEXT[l.per]}`);

// ---------- live settings (GET /plans)

export const planSettings = writable<{ config: PlanConfig; launch: Launch; banner: Banner }>({ config: DEFAULT_CONFIG, launch: DEFAULT_LAUNCH, banner: { on: false, text: '', link: '' } });
let settingsLoaded = false;
export async function loadPlanSettings(force = false) {
  if (settingsLoaded && !force) return;
  settingsLoaded = true;
  try {
    const res = await fetch(`${API}/plans`);
    if (res.ok) {
      const v = await res.json();
      // Quotas added since the server's settings were saved keep their built-in values.
      if (v?.config) v.config.quotas = { ...DEFAULT_CONFIG.quotas, ...v.config.quotas };
      planSettings.set(v);
    }
  } catch {
    settingsLoaded = false;
  }
}
/** Whether the launch offer is on now. */
export const launchOn = (l: Launch) => l.on && new Date().toISOString().slice(0, 10) <= l.until;

// ---------- your plan

export interface MyPlan {
  plan: Plan;
  until?: number;
  source?: string;
  usage: Record<Feature, { used: number; limit: number | null; per: Per }>;
  grants: { plan: Plan; start: number; until: number; source: string }[];
  referral: { code: string; invited: number; days: number };
}
export const myPlan = writable<MyPlan | undefined>();
export async function refreshMyPlan() {
  if (get(session).status !== 'in') return myPlan.set(undefined);
  try {
    myPlan.set(await call<MyPlan>('GET', 'plan'));
  } catch {
    /* offline: keep what we had */
  }
}
/** Your plan now (Free when signed out). */
export const currentPlan = derived([session, myPlan], ([s, p]) => (s.status === 'in' ? (p?.plan ?? 'free') : 'free'));

// ---------- limits

/** What the limit popup shows (LimitModal.svelte). */
export interface LimitHit {
  feature?: Feature;
  gate?: Gate;
  plan: Plan;
  limit?: number;
  per?: Per;
  /** India day ("2026-10-18") when the next free use comes. */
  next?: string;
  signedOut: boolean;
}
export const limitHit = writable<LimitHit | undefined>();

const LOCAL = 'cc.usage';
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 5.5 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10);
type LocalUse = { day: string; ref?: string }[];
function localUses(): Record<string, LocalUse> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? '{}');
  } catch {
    return {};
  }
}

/**
 * Asks before a limited feature starts: true to go ahead (the use is
 * counted), false when the plan's limit is reached (the limit popup opens).
 * `ref`: the game, opening or puzzle, so the same one opened again is free.
 * If the server can't be reached the feature goes ahead.
 */
export async function useFeature(feature: Feature, ref?: string): Promise<boolean> {
  track('feature', feature);
  if (!PLANS_ON) return true;
  if (get(session).status === 'in') {
    try {
      const r = await call<{ ok: boolean; plan: Plan; used?: number; limit?: number | null; per?: Per; next?: string; again?: boolean }>('POST', 'plan/use', { feature, ref });
      if (!r.ok) {
        limitHit.set({ feature, plan: r.plan, limit: r.limit ?? undefined, per: r.per, next: r.next, signedOut: false });
        return false;
      }
      if (!r.again)
        myPlan.update((p) => (p ? { ...p, usage: { ...p.usage, [feature]: { ...p.usage[feature], used: r.used ?? p.usage[feature].used + 1 } } } : p));
      return true;
    } catch {
      return true;
    }
  }
  // Signed out: Free's limits, in this browser.
  const l = get(planSettings).config.limits[feature].free;
  if (l.n === null) return true;
  const all = localUses();
  const from = l.per === 'ever' ? '' : daysAgo({ day: 0, week: 6, month: 29 }[l.per]);
  const list = (all[feature] ?? []).filter((u) => u.day >= from);
  if (ref && list.some((u) => u.ref === ref)) return true;
  if (list.length >= l.n) {
    track('limit', feature);
    limitHit.set({ feature, plan: 'free', limit: l.n, per: l.per, signedOut: true });
    return false;
  }
  all[feature] = [...list, { day: today(), ref }].slice(-500);
  try {
    localStorage.setItem(LOCAL, JSON.stringify(all));
  } catch {
    /* storage full or blocked: let it go */
  }
  return true;
}

/** A short id for a line of moves, so reviewing the same moves again isn't counted twice. */
export function reviewKey(fen: string, ucis: string[]): string {
  let h = 2166136261;
  for (const c of fen + ' ' + ucis.join(' ')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `m${(h >>> 0).toString(36)}${ucis.length}`;
}

/** An id for something opened in this tab ("blind:k3x9"), so moving around in the same tab isn't counted again. */
export function tabRef(name: string): string {
  try {
    let id = sessionStorage.getItem('cc.tab');
    if (!id) sessionStorage.setItem('cc.tab', (id = Math.random().toString(36).slice(2, 10)));
    return `${name}:${id}`;
  } catch {
    return name;
  }
}

/** Whether your plan includes a feature (no popup). */
export const hasGate = (gate: Gate) => (!PLANS_ON && gate !== 'coach_tools') || RANK[get(currentPlan)] >= RANK[get(planSettings).config.gates[gate]];
/** Like hasGate, opening the popup when the plan doesn't include it. */
export function requireGate(gate: Gate): boolean {
  if (hasGate(gate)) return true;
  track('limit', gate);
  limitHit.set({ gate, plan: get(currentPlan), signedOut: get(session).status !== 'in' });
  return false;
}
/** A number your plan allows (games per Insights report…). */
/** A quota for the current plan (the built-in value when the server's settings predate it). */
export const quota = (q: Quota) => {
  // Without plans, everyone gets Premium's numbers.
  const plan = PLANS_ON ? get(currentPlan) : 'premium';
  return get(planSettings).config.quotas[q]?.[plan] ?? DEFAULT_CONFIG.quotas[q][plan];
};

/** The lowest plan that lifts a limit (or includes a gate). */
export function upgradeFor(hit: LimitHit, config: PlanConfig): Plan | undefined {
  if (hit.gate) return config.gates[hit.gate];
  if (!hit.feature) return undefined;
  const cur = config.limits[hit.feature][hit.plan];
  return PLANS.find((p) => {
    if (RANK[p] <= RANK[hit.plan]) return false;
    const l = config.limits[hit.feature!][p];
    return l.n === null || (cur.n !== null && l.n > cur.n);
  });
}

/** "Premium until 15 Jan 2027". */
export const untilText = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// ---------- invites

const REF_KEY = 'cc.ref';
/** Keeps ?ref=<username> from an invite link until the visitor signs in. */
export function keepReferral(url: URL) {
  const r = url.searchParams.get('ref');
  if (r && /^[A-Za-z0-9_-]{2,30}$/.test(r))
    try {
      localStorage.setItem(REF_KEY, r);
    } catch {
      /* blocked */
    }
}
/** After sign-in: tells the server who invited this player (once). */
export async function sendReferral(username: string) {
  let r: string | null = null;
  try {
    r = localStorage.getItem(REF_KEY);
  } catch {
    return;
  }
  if (!r) return;
  if (r.toLowerCase() === username.toLowerCase()) return localStorage.removeItem(REF_KEY);
  try {
    await call('POST', 'plan/referral', { by: r });
    localStorage.removeItem(REF_KEY);
  } catch {
    /* try again next time */
  }
}
export const inviteLink = (code: string) => `https://chesscastles.com/?ref=${encodeURIComponent(code)}`;

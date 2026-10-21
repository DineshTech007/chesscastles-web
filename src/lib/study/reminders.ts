import { get } from 'svelte/store';
import { API } from '$lib/api';
import { lichessToken } from '$lib/auth';
import { dayOf, streak, study, type Activity } from './progress';
import { loadPlan, savePlan, type StudyPlan } from './plan';

/**
 * Study reminders as browser notifications, also when Chess Castles is closed:
 * the browser gives us a push subscription, and the API worker
 * sends "time to study endgames" at the planned time and "don't lose your
 * streak" in the evening (server/api-worker/src/push.ts). The service
 * worker in static/sw.js shows them.
 */

/** The reminder service's public key (VAPID); the private half is a secret of the worker. */
export const VAPID_PUBLIC = 'BH8XPg5uuKmAgft_LIUCaQyrVT6iQbAZBiUrrAOxPJ2XmRGCCNIy-DGkbq7-r9Ed1Re3eAeaBEzuvKqdh_bYkyw';

export type ReminderResult = 'on' | 'off' | 'denied' | 'unsupported';

export function reminderSupport(): 'push' | 'none' {
  if (typeof window === 'undefined') return 'none';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'push' : 'none';
}

const b64urlToBytes = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Reminders: ${res.status}`);
}

async function subscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// ---- Guru in the reminders (server/api-worker/src/push.ts): free, personal notifications. The study reminder says
// what Guru found costs the most points; once a week "Guru has new games to check" opens Guru, starting at once.

const GURU = 'cc.guru';
export interface GuruNote {
  site: 'lichess' | 'chesscom';
  user: string;
  /** The latest report's weakness costing the most points, and when it was made. */
  weak?: string;
  at?: number;
}
/** Whose games Guru checks (the latest report's, else the Lichess login), for the reminders. */
function guruNote(): GuruNote | undefined {
  try {
    const g = JSON.parse(localStorage.getItem(GURU) ?? 'null');
    if (g && (g.site === 'lichess' || g.site === 'chesscom') && typeof g.user === 'string') return g;
  } catch {
    /* none kept */
  }
  const l = lichessToken();
  return l ? { site: 'lichess', user: l.username } : undefined;
}

const planBody = (p: StudyPlan) => ({ days: p.days, time: p.time, minutes: p.minutes, streakTime: p.streakTime, guru: guruNote() });

/** Turns reminders on (asking for permission) or off, or sends a changed plan. */
export async function setReminders(plan: StudyPlan, currentStreak: number, activities: Activity[] = []): Promise<ReminderResult> {
  if (reminderSupport() === 'none') return plan.remind ? 'unsupported' : 'off';
  if (!plan.remind) {
    const sub = await subscription();
    if (sub) {
      await post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    return 'off';
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(VAPID_PUBLIC) }));
  const last = activities.length ? dayOf(Math.max(...activities.map((a) => a.at))) : '';
  await post('/push/subscribe', { sub: sub.toJSON(), tz: -new Date().getTimezoneOffset(), plan: planBody(plan), streak: currentStreak, lastDay: last });
  return 'on';
}

/** Turns the reminders on with the study plan's times (asks for permission); the plan is saved when they are on. */
export async function turnOnReminders(): Promise<ReminderResult> {
  const plan = { ...loadPlan(), remind: true };
  const activities = get(study);
  const r = await setReminders(plan, streak(activities, Date.now()), activities).catch((): ReminderResult => 'unsupported');
  if (r === 'on') savePlan(plan);
  return r;
}
/** Reminders on, with permission given. */
export const remindersOn = () => reminderSupport() === 'push' && loadPlan().remind && Notification.permission === 'granted';

/** After a Guru report: kept for the reminders, and sent at once when they are on. */
export function noteGuruReport(g: GuruNote) {
  try {
    localStorage.setItem(GURU, JSON.stringify(g));
  } catch {
    /* the reminders stay general */
  }
  if (remindersOn()) void turnOnReminders();
}

const REPORTED = 'k24.reminders.reported';

/**
 * Tells the reminder service that the player studied today (once a day, and
 * when the streak changes), so it skips today's reminder and the streak
 * warning.
 */
export async function reportStudy(activities: Activity[]): Promise<void> {
  if (reminderSupport() === 'none' || !activities.length) return;
  const today = dayOf(Date.now());
  if (dayOf(Math.max(...activities.map((a) => a.at))) !== today) return;
  const s = streak(activities, Date.now());
  const key = `${today}:${s}`;
  try {
    if (localStorage.getItem(REPORTED) === key) return;
  } catch {
    return;
  }
  const sub = await subscription().catch(() => null);
  if (!sub) return;
  await post('/push/studied', { endpoint: sub.endpoint, day: today, streak: s }).catch(() => {});
  try {
    localStorage.setItem(REPORTED, key);
  } catch {
    /* fine */
  }
}

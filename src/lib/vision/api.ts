import { myName as displayName } from '$lib/stores/me';
import { get } from 'svelte/store';
import { API } from '$lib/api';
import { auth, session } from '$lib/auth';

/**
 * The Vision Gym leaderboards (the API worker, src/vision.ts): the server
 * checks every answer; only signed-in players appear.
 */

export interface Leader {
  id: string;
  name: string;
  value: number;
  games: number;
}
export type Board = 'rating' | 'sprint' | 'today';

async function token(): Promise<string | undefined> {
  try {
    return (await auth.currentUser?.getIdToken()) ?? undefined;
  } catch {
    return undefined;
  }
}

const myName = () => {
  const s = get(session);
  return s.status === 'in' ? (get(displayName) || s.username) : 'Player';
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'The leaderboard could not be reached.');
  return j as T;
}

export const signedIn = () => !!auth.currentUser;

/** Sends a blindfold puzzle's moves; the server's verdict and the new Vision rating. */
export async function sendPuzzle(id: string, moves: string[]): Promise<{ solved: boolean; rating: number; change: number; repeat?: boolean } | undefined> {
  const t = await token();
  if (!t) return undefined;
  return post('/vision/puzzle', { token: t, name: myName(), id, moves });
}

/** A seed for a counted sprint (or undefined when offline). */
export async function sprintTicket(): Promise<number | undefined> {
  try {
    return (await post<{ seed: number }>('/vision/sprint-ticket', {})).seed;
  } catch {
    return undefined;
  }
}

export async function sendSprint(seed: number, answers: string[]): Promise<{ score: number; best: number; today: number } | undefined> {
  const t = await token();
  if (!t) return undefined;
  return post('/vision/sprint', { token: t, name: myName(), seed, answers });
}

export async function leaders(board: Board): Promise<{ day: string; players: Leader[] }> {
  const res = await fetch(`${API}/vision/leaders?board=${board}`);
  if (!res.ok) throw new Error('The leaderboard could not be loaded.');
  return res.json();
}

export async function myVision(): Promise<{ rating: number; games: number; solved: number; bestSprint: number; today: number; id: string } | undefined> {
  const t = await token();
  if (!t) return undefined;
  const res = await fetch(`${API}/vision/me`, { headers: { Authorization: `Bearer ${t}` } });
  return res.ok ? res.json() : undefined;
}

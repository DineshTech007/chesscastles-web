import { API } from '$lib/api';
import { token } from '$lib/classroom/api';
import { band, type BandPuzzle } from '$lib/puzzles/bank';

/**
 * Puzzle Racer (server/api-worker src/racer.ts): races of up to 10 players through the same puzzles, and Puzzle
 * Battles (two friends). The race only names its puzzles ([band, number]); each browser takes them from the site's
 * band files, so everyone gets the same ones and nothing big travels.
 */

export type Phase = 'lobby' | 'lights' | 'racing' | 'over';
export interface CarView {
  uid: string;
  name: string;
  /** Which vehicle (0-9). */
  car: number;
  score: number;
  combo: number;
  solved: number;
  tried: number;
  /** The puzzle they are on (a page that comes back mid-race carries on from it). */
  at: number;
  online: boolean;
  /** A computer racer. */
  bot?: true;
}
export interface RaceInfo {
  id: string;
  open: boolean;
  duel: boolean;
  owner: string;
  phase: Phase;
  startAt: number;
  endAt: number;
  slots: [number, number][];
  seconds: number;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const t = await token();
  const res = await fetch(`${API}/race${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Something went wrong. Try again.');
  return j as T;
}
/** A race with friends (its maker starts it), or a battle (two players: it starts when the friend comes). */
export const newRace = (o: { seconds?: number; duel?: boolean } = {}) => call<{ id: string }>('POST', '', o);
/** The open race filling up now (everyone who asks gets the same one), or a new one. */
export const quickRace = () => call<{ id: string }>('POST', '/quick');
export const raceLink = (id: string) => `https://chesscastles.com/puzzles/racer/${id}`;

/** The race's puzzles, in order: puzzle `number % band size` of each band. */
export async function puzzleAt(slots: [number, number][], i: number): Promise<BandPuzzle | undefined> {
  const s = slots[i];
  if (!s) return undefined;
  const list = await band(s[0]);
  return list.length ? list[s[1] % list.length] : undefined;
}
/** The bands a race needs first, fetched while the lights are on (the rest come as the player gets there). */
export function preload(slots: [number, number][], from: number, count = 8) {
  for (const b of new Set(slots.slice(from, from + count).map((s) => s[0]))) void band(b);
}

/** The vehicles, in the order racers join: the name a child reads, and its colour. */
export const CARS = [
  { kind: 'sports', name: 'Sports car', color: '#ef4444' },
  { kind: 'bus', name: 'Bus', color: '#f59e0b' },
  { kind: 'jeep', name: 'Jeep', color: '#16a34a' },
  { kind: 'scooter', name: 'Scooter', color: '#6366f1' },
  { kind: 'f1', name: 'Racing car', color: '#0ea5e9' },
  { kind: 'truck', name: 'Truck', color: '#a855f7' },
  { kind: 'taxi', name: 'Taxi', color: '#facc15' },
  { kind: 'rocket', name: 'Rocket', color: '#f97316' },
  { kind: 'tractor', name: 'Tractor', color: '#22c55e' },
  { kind: 'police', name: 'Police car', color: '#3b82f6' },
] as const;
export type CarKind = (typeof CARS)[number]['kind'];

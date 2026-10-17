/** Chess Castles' data helper (FIDE ratings); see server/api-worker in the app. */
export const API = (import.meta.env.VITE_API as string | undefined) ?? 'https://api.chesscastles.com';

export interface TopPlayer {
  rank: number;
  fideId: string;
  name: string;
  federation: string;
  rating: number;
  birthYear?: number;
}

export interface FidePlayer {
  fideId: string;
  name: string;
  title?: string;
  federation?: string;
  standard?: number;
  rapid?: number;
  blitz?: number;
  birthYear?: number;
}

export interface RatingPoint {
  month: string;
  standard?: number;
  rapid?: number;
  blitz?: number;
  games: number;
}

export type TopList = 'open' | 'women' | 'juniors' | 'girls';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error("Can't reach FIDE right now.");
  return res.json();
}

export const fideTop = (list: TopList) => get<{ period: string; players: TopPlayer[] }>(`/fide/top/${list}`);
export const fideSearch = (q: string) => get<FidePlayer[]>(`/fide/search?q=${encodeURIComponent(q)}`);
export const fideHistory = (id: string) => get<RatingPoint[]>(`/fide/history/${id}`);

/**
 * Orders search results so the player meant comes first: every word of the
 * query in the name, then names starting with it, then players from India,
 * then by rating.
 */
export function rankResults(players: FidePlayer[], query: string): FidePlayer[] {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const score = (p: FidePlayer) => {
    const name = p.name.toLowerCase();
    const parts = name.split(/[\s,]+/).filter(Boolean);
    let s = 0;
    if (words.every((w) => parts.some((x) => x === w))) s += 8;
    else if (words.every((w) => parts.some((x) => x.startsWith(w)))) s += 4;
    else if (words.every((w) => name.includes(w))) s += 2;
    if (p.fideId === query.trim()) s += 16;
    if (p.federation === 'IND') s += 1;
    return s;
  };
  return players
    .map((p) => ({ p, s: score(p), r: Math.max(p.standard ?? 0, p.rapid ?? 0, p.blitz ?? 0) }))
    .sort((a, b) => b.s - a.s || b.r - a.r)
    .map((x) => x.p);
}

/** "Carlsen, Magnus" as "Magnus Carlsen". */
export function displayName(fideName: string): string {
  const i = fideName.indexOf(', ');
  return i < 0 ? fideName : `${fideName.slice(i + 2)} ${fideName.slice(0, i)}`;
}

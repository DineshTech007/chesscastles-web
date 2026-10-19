import { writable } from 'svelte/store';
import { API } from '$lib/api';

/**
 * The public counters of the blog stories (views, likes, dislikes, hearts), kept by the API worker
 * (src/blog.ts) so every reader sees the same numbers. A story nobody has opened yet has none (zero).
 */
export interface Counts {
  views: number;
  likes: number;
  dislikes: number;
  hearts: number;
}
export const ZERO: Counts = { views: 0, likes: 0, dislikes: 0, hearts: 0 };

export const blogStats = writable<Record<string, Counts>>({});
let loaded = 0;

/** Loads the counters (at most once every 30 seconds). */
export async function loadBlogStats(force = false): Promise<void> {
  if (!force && Date.now() - loaded < 30_000) return;
  loaded = Date.now();
  try {
    const res = await fetch(`${API}/blog/stats`);
    if (res.ok) blogStats.set((await res.json()).stats ?? {});
  } catch {
    /* the counts stay as they are */
  }
}

const post = (path: string, body: unknown) =>
  fetch(`${API}/blog/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});

/** One more view of a story, counted once a day for each reader in this browser. */
export function countView(slug: string): void {
  const day = new Date().toISOString().slice(0, 10);
  const key = `cc.viewed.${slug}`;
  try {
    if (localStorage.getItem(key) === day) return;
    localStorage.setItem(key, day);
  } catch {
    /* counted each time */
  }
  blogStats.update((s) => ({ ...s, [slug]: { ...(s[slug] ?? ZERO), views: (s[slug] ?? ZERO).views + 1 } }));
  void post('view', { slug });
}

/** A reader's choice changed: tells the server the difference, and shows it at once. */
export function sendReaction(slug: string, d: { likes: number; dislikes: number; hearts: number }): void {
  blogStats.update((s) => {
    const c = s[slug] ?? ZERO;
    return { ...s, [slug]: { ...c, likes: Math.max(0, c.likes + d.likes), dislikes: Math.max(0, c.dislikes + d.dislikes), hearts: Math.max(0, c.hearts + d.hearts) } };
  });
  void post('react', { slug, d });
}

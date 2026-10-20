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
    // The server's numbers (up to a minute old), never lower than what this reader just added.
    if (res.ok) {
      const server: Record<string, Counts> = (await res.json()).stats ?? {};
      blogStats.update((local) => {
        const out = { ...server };
        for (const [k, c] of Object.entries(local)) {
          const sv = out[k] ?? ZERO;
          out[k] = { views: Math.max(sv.views, c.views), likes: Math.max(sv.likes, c.likes), dislikes: Math.max(sv.dislikes, c.dislikes), hearts: Math.max(sv.hearts, c.hearts) };
        }
        return out;
      });
    }
  } catch {
    /* the counts stay as they are */
  }
}

// Sent as plain text: a JSON content type needs a CORS preflight, which Chrome refuses for keepalive requests
// (it failed silently, so most views and reactions were never counted). The server reads the JSON either way.
// Automated browsers (the site check runs on the live site every few hours) don't add to the public counts.
const post = (path: string, body: unknown) =>
  typeof navigator !== 'undefined' && navigator.webdriver ? undefined : fetch(`${API}/blog/${path}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});

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

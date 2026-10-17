import { myName } from '$lib/stores/me';
/**
 * Sharing a game by link: the link opens Chess Castles' game page (/g/<id>)
 * for anyone, without signing in. Signed in, the game gets a short link;
 * signed out, the game travels inside the link itself (/g#…).
 */
import { get } from 'svelte/store';
import { API } from '$lib/api';
import { session } from '$lib/auth';
import { auth } from '$lib/auth';
import type { SavedGame } from '$lib/stores/myGames';

/** "You" means nothing to whoever opens the link: the player's own name instead. */
export function forSharing(g: SavedGame): SavedGame {
  const s = get(session);
  const me = s.status === 'in' ? (get(myName) || s.username) : 'Chess Castles player';
  const name = (n: string) => (n === 'You' ? me : n);
  const { owner: _o, blurs: _b, ...rest } = g;
  return { ...rest, white: name(g.white), black: name(g.black) };
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** The link for a game. */
export async function shareLink(g: SavedGame): Promise<string> {
  const game = forSharing(g);
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  if (token) {
    const res = await fetch(`${API}/social/share`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: JSON.stringify(game) }),
    }).catch(() => undefined);
    const j = res?.ok ? await res.json().catch(() => undefined) : undefined;
    if (j?.id) return `${location.origin}/g/${j.id}`;
  }
  return `${location.origin}/g#${b64(JSON.stringify(game))}`;
}

/** Shares a game: the phone's share sheet where there is one, else the link is copied. */
export async function shareGame(g: SavedGame): Promise<'shared' | 'copied' | 'failed'> {
  try {
    const url = await shareLink(g);
    const title = `${forSharing(g).white} vs ${forSharing(g).black} · Chess Castles`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'shared';
      }
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** A shared game, from its short id (or from the link itself for #… links). */
export async function loadShared(idOrHash: string): Promise<SavedGame> {
  if (idOrHash.startsWith('#')) return JSON.parse(unb64(idOrHash.slice(1)));
  const res = await fetch(`${API}/share/${encodeURIComponent(idOrHash)}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'This game could not be opened.');
  return JSON.parse(j.data);
}

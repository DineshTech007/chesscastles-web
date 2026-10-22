import { writable } from 'svelte/store';

/**
 * Chat for children (server/api-worker src/chat.ts and src/moderation.ts): emojis, ready phrases and short typed
 * messages, which Castle Guard 🛡️ reads on the server before anyone sees them. Here: the lists (the same as the
 * server's), and two choices each child keeps on their device: chat off, and players whose messages they hide (the
 * chat, not the player: they still race and play).
 */
export interface ChatLine {
  id: string;
  uid: string;
  name: string;
  kind: 'emoji' | 'phrase' | 'text';
  text: string;
  /** The room's time. */
  at: number;
}
/** What Castle Guard told me: a warning, or my chat paused until `until`. */
export interface Guard {
  text: string;
  until: number;
  at: number;
  /** Which warning (the server's code), so it shows in the player's language. */
  code?: 'privacy' | 'rude' | 'unkind' | 'paused15' | 'pausedDay' | 'still';
  /** Minutes left (for 'still'). */
  minutes?: number;
}

export const EMOJIS = ['👍', '😂', '😮', '🔥', '👏', '😎', '🤝', '🏆', '💪', '😅', '🍀', '♟️'] as const;
export const PHRASES = ['Good luck! 🍀', 'Have fun! 😄', 'Nice one! 👏', 'So fast! ⚡', 'Oops 😅', 'Well played! 🤝', 'GG 🏆', 'Rematch? ⚔️', 'Thank you! 🙏', 'Wow! 😮'] as const;
export const MAX_TEXT = 80;

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'));
  } catch {
    return new Set();
  }
}
const HIDDEN = 'cc.chat.hidden';
const OFF = 'cc.chat.off';
/** Players whose messages I don't see. */
export const hiddenChat = writable<Set<string>>(typeof localStorage === 'undefined' ? new Set() : readSet(HIDDEN));
export function toggleHidden(uid: string) {
  hiddenChat.update((s) => {
    const n = new Set(s);
    if (n.has(uid)) n.delete(uid);
    else n.add(uid);
    try {
      localStorage.setItem(HIDDEN, JSON.stringify([...n].slice(-200)));
    } catch {
      /* private mode */
    }
    return n;
  });
}
/** All chat off for me. */
export const chatOff = writable<boolean>(typeof localStorage !== 'undefined' && localStorage.getItem(OFF) === '1');
export function setChatOff(off: boolean) {
  chatOff.set(off);
  try {
    localStorage.setItem(OFF, off ? '1' : '0');
  } catch {
    /* private mode */
  }
}

/** A colour for a player (the same everywhere), for their bubble's dot. */
export function colourOf(uid: string): string {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 55%)`;
}

import { writable } from 'svelte/store';

/**
 * Whether the game on the page has ended (GameView sets it): on phones the
 * bottom bar, hidden while a game is played, comes back once it is over.
 */
export const gameEnded = writable(false);

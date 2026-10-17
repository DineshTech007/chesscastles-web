/**
 * The board's square colours: a site-wide choice (like the light/dark theme),
 * saved in localStorage and applied as `data-board` on <html>. Every board on
 * the site reads the same CSS variables (see app.css), so picking a theme
 * once changes it everywhere: games, analysis, puzzles, lessons and practice.
 */
import { writable } from 'svelte/store';

/** Whether the board-colour picker (BoardThemeModal, mounted once in +layout.svelte) is open. */
export const boardThemeOpen = writable(false);

export interface BoardThemeDef {
  id: string;
  name: string;
  emoji: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: BoardThemeDef[] = [
  { id: 'classic', name: 'Classic', emoji: '♟️', light: '#f0d9b5', dark: '#b58863' },
  { id: 'walnut', name: 'Walnut wood', emoji: '🪵', light: '#e9c49a', dark: '#8b5a2b' },
  { id: 'forest', name: 'Forest', emoji: '🌲', light: '#eeeed2', dark: '#769656' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', light: '#dee9f2', dark: '#4b7fa6' },
  { id: 'coral', name: 'Coral', emoji: '🪸', light: '#ffe8d6', dark: '#ef8354' },
  { id: 'candy', name: 'Candy', emoji: '🍬', light: '#ffe1f0', dark: '#ff7eb6' },
  { id: 'lemon', name: 'Lemon', emoji: '🍋', light: '#fff6d6', dark: '#e8b923' },
  { id: 'midnight', name: 'Midnight', emoji: '🌙', light: '#4a5068', dark: '#2b2f42' },
  { id: 'space', name: 'Space', emoji: '🚀', light: '#cfd6e8', dark: '#2a2f5c' },
  { id: 'jungle', name: 'Jungle', emoji: '🦕', light: '#eaf4df', dark: '#3f6b3a' },
];

const KEY = 'k24.board';
const DEFAULT = 'classic';

export function loadBoardTheme(): string {
  try {
    const t = localStorage.getItem(KEY);
    if (t && BOARD_THEMES.some((b) => b.id === t)) return t;
  } catch {
    /* storage blocked */
  }
  return DEFAULT;
}

/** Sets `data-board` on <html> and saves the choice. */
export function applyBoardTheme(id: string) {
  document.documentElement.dataset.board = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked */
  }
}

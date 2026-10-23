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
  /** Premium boards: a real material, as a picture of the whole board (static/boards, scripts/boards). */
  image?: string;
  /** A Treasury board (src/lib/economy/core.ts ITEMS): bought in the Shop with gold or gems, or won; its texture and
   *  any glow are in src/lib/economy/cosmetics.css. */
  shop?: true;
}

export const BOARD_THEMES: BoardThemeDef[] = [
  { id: 'classic', name: 'Classic', emoji: '♟️', light: '#f0d9b5', dark: '#b58863' },
  { id: 'wood', name: 'Maple & walnut', emoji: '🪵', light: '#d9a865', dark: '#5a3a22', image: '/boards/wood.webp' },
  { id: 'marble', name: 'Marble', emoji: '🏛️', light: '#e9e9e6', dark: '#1f4a35', image: '/boards/marble.webp' },
  { id: 'ebony', name: 'Ebony & ivory', emoji: '🎹', light: '#efe6d2', dark: '#3d3530', image: '/boards/ebony.webp' },
  { id: 'stone', name: 'Sandstone & slate', emoji: '🪨', light: '#dccaa4', dark: '#4b5566', image: '/boards/stone.webp' },
  { id: 'walnut', name: 'Walnut wood', emoji: '🪵', light: '#e9c49a', dark: '#8b5a2b' },
  { id: 'forest', name: 'Forest', emoji: '🌲', light: '#eeeed2', dark: '#769656' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', light: '#dee9f2', dark: '#4b7fa6' },
  { id: 'coral', name: 'Coral', emoji: '🪸', light: '#ffe8d6', dark: '#ef8354' },
  { id: 'candy', name: 'Candy', emoji: '🍬', light: '#ffe1f0', dark: '#ff7eb6' },
  { id: 'lemon', name: 'Lemon', emoji: '🍋', light: '#fff6d6', dark: '#e8b923' },
  { id: 'midnight', name: 'Midnight', emoji: '🌙', light: '#4a5068', dark: '#2b2f42' },
  { id: 'space', name: 'Space', emoji: '🚀', light: '#cfd6e8', dark: '#2a2f5c' },
  { id: 'jungle', name: 'Jungle', emoji: '🦕', light: '#eaf4df', dark: '#3f6b3a' },
  // The Shop's boards (owner, 2026-10-23): won with gold and gems. Same names as the Shop (economy/core.ts).
  { id: 'tourney', name: 'Tournament Hall', emoji: '🏁', light: '#f3f0e2', dark: '#2f7d4f', shop: true },
  { id: 'moat', name: 'Moat Blue', emoji: '🏰', light: '#e3edf2', dark: '#4f7a96', shop: true },
  { id: 'rosewood', name: 'Rosewood', emoji: '🌹', light: '#f2d7c2', dark: '#94443a', shop: true },
  { id: 'amethyst', name: 'Royal Amethyst', emoji: '💜', light: '#efe6fb', dark: '#7b55b8', shop: true },
  { id: 'monsoon', name: 'Monsoon Courtyard', emoji: '🌧️', light: '#dbe7e2', dark: '#3e6b6a', shop: true },
  { id: 'sakura', name: 'Sakura Garden', emoji: '🌸', light: '#fff0f4', dark: '#e48aa4', shop: true },
  { id: 'sandfort', name: 'Sandstone Fort', emoji: '🏯', light: '#f3dfb4', dark: '#bf8640', shop: true },
  { id: 'icepalace', name: 'Ice Palace', emoji: '❄️', light: '#eef7ff', dark: '#79acd6', shop: true },
  { id: 'neon', name: 'Neon Joust', emoji: '⚡', light: '#6874a8', dark: '#262b55', shop: true },
  { id: 'hoard', name: 'Dragon’s Hoard', emoji: '🐉', light: '#e8cf8f', dark: '#2e241a', shop: true },
  { id: 'lavakeep', name: 'Dragonfire Keep', emoji: '🌋', light: '#cbb9a8', dark: '#3a1f19', shop: true },
  { id: 'coronation', name: 'Coronation Hall', emoji: '👑', light: '#f6e5c4', dark: '#8f1d2c', shop: true },
];

const KEY = 'k24.board';
/** The default board: Sandstone & slate (no data-board on <html>; see app.css). */
const DEFAULT = 'stone';

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

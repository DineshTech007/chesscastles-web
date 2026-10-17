/**
 * Chess Castles' move badges for game reviews: glossy round icons (a gradient
 * disc with a light shine, a white ring and a soft shadow) with a clear
 * symbol. Colour is never the only clue: every badge has its own symbol
 * and name. Icon paths are Material Icons (Apache 2.0).
 */
export type MoveClass = 'brilliant' | 'only' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder';

export interface Badge {
  label: string;
  /** One line for the legend: what earns it. */
  meaning: string;
  /** The main colour (text, counts) and the gradient's dark end. */
  color: string;
  dark: string;
  /** Symbol colour on the badge. */
  ink: string;
  /** SVG content in a 40 × 40 box. */
  glyph: string;
}

const text = (t: string, size = 15) =>
  `<text x="20" y="21" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="900" font-size="${size}" letter-spacing="-0.6">${t}</text>`;
/** A 24-unit Material icon, centred and scaled into the badge. */
const icon = (d: string, scale = 0.82) => `<path transform="translate(${20 - 12 * scale} ${20 - 12 * scale}) scale(${scale})" d="${d}"/>`;

const THUMB_UP = 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z';
const STAR = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';
const BOOK = 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z';
const KEY = 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z';
const CHECK = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

export const BADGES: Record<MoveClass, Badge> = {
  brilliant: { label: 'Brilliant', meaning: 'A sacrifice that works: the best move, and it gives up material', color: '#a855f7', dark: '#6d28d9', ink: '#fff', glyph: `${text('!!', 16)}<path d="M30.5 7.5l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#ffe27a"/>` },
  only: { label: 'Only move', meaning: 'The one move that holds: anything else loses a lot', color: '#3b82f6', dark: '#1d4ed8', ink: '#fff', glyph: icon(KEY, 0.8) },
  best: { label: 'Best', meaning: "The engine's first choice", color: '#22c55e', dark: '#15803d', ink: '#fff', glyph: icon(STAR, 0.86) },
  excellent: { label: 'Excellent', meaning: 'Almost as good as the best move', color: '#14b8a6', dark: '#0f766e', ink: '#fff', glyph: icon(THUMB_UP, 0.74) },
  good: { label: 'Good', meaning: 'A sound move that keeps the position', color: '#64748b', dark: '#475569', ink: '#fff', glyph: icon(CHECK, 0.86) },
  book: { label: 'Book', meaning: 'Known opening theory', color: '#b07d52', dark: '#7c5130', ink: '#fff', glyph: icon(BOOK, 0.78) },
  inaccuracy: { label: 'Inaccuracy', meaning: 'A small slip: there was something better', color: '#eab308', dark: '#b45309', ink: '#fff', glyph: text('?!', 15) },
  mistake: { label: 'Mistake', meaning: 'Gives away a real part of the advantage', color: '#f97316', dark: '#c2410c', ink: '#fff', glyph: text('?', 19) },
  blunder: { label: 'Blunder', meaning: 'Throws away the game or a lot of material', color: '#ef4444', dark: '#b91c1c', ink: '#fff', glyph: text('??', 15) },
};

/** The order badges are listed in. */
export const BADGE_ORDER: MoveClass[] = ['brilliant', 'only', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

/** The badge as SVG content in a 40 × 40 box: gradient disc, shine, ring, symbol with a soft shadow. */
export function badgeSvg(c: MoveClass): string {
  const b = BADGES[c];
  const id = `k24b-${c}`;
  return (
    `<defs><radialGradient id="${id}" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="${b.color}"/><stop offset="1" stop-color="${b.dark}"/></radialGradient></defs>` +
    `<circle cx="20" cy="21.2" r="17.5" fill="rgba(0,0,0,.28)"/>` +
    `<circle cx="20" cy="20" r="17.5" fill="url(#${id})" stroke="#fff" stroke-width="2.2"/>` +
    `<ellipse cx="17" cy="11.5" rx="10" ry="5" fill="#fff" opacity=".22"/>` +
    `<g fill="rgba(0,0,0,.28)" transform="translate(0 1.2)">${b.glyph}</g>` +
    `<g fill="${b.ink}">${b.glyph}</g>`
  );
}

/**
 * The badge for the board, on the top-right corner of the move's square
 * (chessground draws custom shapes 100 units per square, from its top-left corner).
 */
export function boardBadge(c: MoveClass): string {
  return `<g transform="translate(56 -10) scale(1.2)">${badgeSvg(c)}</g>`;
}

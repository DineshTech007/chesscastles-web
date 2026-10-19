import { speedOf, SPEED_LABEL, type KfideAll } from '$lib/kfide';
import type { SavedGame } from './myGames';

/**
 * The player's own rating in a saved game: what it was when the game began, and what it became.
 * Games against FIDE-level opponents read it from the CC Rating history (so old games show it too);
 * Lichess games use the Lichess rating saved with the game; games against the computer have none.
 */
export interface GameRating {
  /** Which rating this is: the CC Rating at the game's speed, or the player's Lichess rating. */
  kind?: 'cc' | 'lichess';
  label: string;
  before?: number;
  after?: number;
  opponent?: number;
}

export function gameRating(g: SavedGame, all: KfideAll): GameRating {
  if (g.kind === 'fide') {
    const speed = speedOf(g.timeControl);
    const entry = all[speed].history.find((h) => h.id === g.id);
    const before = entry?.before ?? g.myRating;
    return { kind: before === undefined ? undefined : 'cc', label: `CC ${SPEED_LABEL[speed]}`, before, after: entry?.after, opponent: g.opponentRating };
  }
  if (g.kind === 'lichess') return { kind: g.myRating ? 'lichess' : undefined, label: 'Lichess', before: g.myRating, opponent: g.opponentRating };
  return { label: '' };
}

/** "1520 (+14)", "1520", or "" when the rating is not known (old Lichess games, games against the computer). */
export function ratingText(r: GameRating): string {
  if (r.before === undefined) return '';
  if (r.after === undefined) return `${r.before}`;
  const d = r.after - r.before;
  return `${r.before} (${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)})`;
}

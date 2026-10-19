import type { Color } from 'chessops/types';
import type { GameReview } from '$lib/coach/review';
import { outcome, type SavedGame } from '$lib/stores/myGames';
import type { MoveClass } from './badges';
import { AREAS, areasOf, type Area } from './report';

/**
 * The profile's all-time numbers: results from the player's games kept on
 * this device, and how they play (accuracy, each part of the game, the
 * badges) from those of their games that were reviewed, with the change in
 * the latest games against the ones before.
 */
export type SideFilter = 'all' | Color;
const playedAs = (side: SideFilter) => (g: SavedGame) => side === 'all' || g.userSide === side;

export interface Results {
  games: number;
  won: number;
  drawn: number;
  lost: number;
}

/** Finished games only. */
export function results(games: SavedGame[], side: SideFilter): Results {
  const r: Results = { games: 0, won: 0, drawn: 0, lost: 0 };
  for (const g of games.filter(playedAs(side))) {
    const o = outcome(g);
    if (o === 'unfinished') continue;
    r.games++;
    if (o === 'won') r.won++;
    else if (o === 'lost') r.lost++;
    else r.drawn++;
  }
  return r;
}

export interface Reviewed {
  game: SavedGame;
  review: GameReview;
}

/** The games with a review on this device (one each), oldest first. */
export function reviewedGames(games: SavedGame[], kept: { moves: string; side: Color; review: GameReview }[]): Reviewed[] {
  const byMoves = new Map(games.map((g) => [`${g.uci.join(' ')}|${g.userSide}`, g]));
  const out = new Map<string, Reviewed>();
  for (const k of kept) {
    const game = byMoves.get(`${k.moves}|${k.side}`);
    if (game) out.set(game.id, { game, review: k.review });
  }
  return [...out.values()].sort((a, b) => a.game.playedAt - b.game.playedAt);
}

export interface AreaStat {
  accuracy: number;
  moves: number;
  /** The latest games against the ones before, in accuracy points. */
  change?: number;
}

export interface Style {
  games: number;
  accuracy: number;
  accuracyChange?: number;
  best: { accuracy: number; game: SavedGame };
  areas: Partial<Record<Area, AreaStat>>;
  /** Every badge the player earned, in all these games. */
  classes: Record<MoveClass, number>;
  /** How many of the latest games the changes compare (with the ones before); 0 when too few. */
  recent: number;
}

/** The latest games a change is measured over, and the fewest games before them to compare with. */
export const RECENT = 5;
const BEFORE = 3;
/** An area counts with this many moves of the player's in it. */
const AREA_MOVES = 4;

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function style(list: Reviewed[], side: SideFilter): Style | undefined {
  const mine = list.filter((r) => playedAs(side)(r.game));
  if (!mine.length) return undefined;
  const acc = mine.map((r) => r.review.sides[r.game.userSide].accuracy);
  const classes = {} as Record<MoveClass, number>;
  for (const r of mine) for (const [k, n] of Object.entries(r.review.sides[r.game.userSide].classes) as [MoveClass, number][]) classes[k] = (classes[k] ?? 0) + n;
  const per = mine.map((r) => areasOf(r.review, r.game.userSide));
  // An area's accuracy over many games: every move counts the same.
  const pool = (from: typeof per) => {
    const out: Partial<Record<Area, { accuracy: number; moves: number }>> = {};
    for (const a of AREAS) {
      let s = 0;
      let n = 0;
      for (const p of from) {
        const v = p[a.id];
        if (v) {
          s += v.accuracy * v.moves;
          n += v.moves;
        }
      }
      if (n >= AREA_MOVES) out[a.id] = { accuracy: s / n, moves: n };
    }
    return out;
  };
  const recent = mine.length >= RECENT + BEFORE ? RECENT : 0;
  const all = pool(per);
  const late = recent ? pool(per.slice(-recent)) : {};
  const early = recent ? pool(per.slice(0, -recent)) : {};
  const areas: Style['areas'] = {};
  for (const [k, v] of Object.entries(all) as [Area, { accuracy: number; moves: number }][]) {
    const l = late[k];
    const e = early[k];
    areas[k] = { accuracy: Math.round(v.accuracy), moves: v.moves, change: l && e ? Math.round(l.accuracy - e.accuracy) : undefined };
  }
  const top = acc.indexOf(Math.max(...acc));
  return {
    games: mine.length,
    accuracy: Math.round(mean(acc)),
    accuracyChange: recent ? Math.round(mean(acc.slice(-recent)) - mean(acc.slice(0, -recent))) : undefined,
    best: { accuracy: acc[top], game: mine[top].game },
    areas,
    classes,
    recent,
  };
}

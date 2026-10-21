/**
 * The computer opponents' levels: Starter (1000 to 1375) for beginners, below FIDE's lowest rating (1400 since
 * FIDE's 2024 change), and FIDE-level from 1400 to 2800. "Match my level" picks one about 100 under the player's
 * CC Rating at the speed: by the rating formula they then win about 64% of games, the range where people enjoy
 * playing on (owner's request, 2026-10-21: kids were winning a third of their games against a fixed 1400).
 */
export const MIN_LEVEL = 1000;
export const FIDE_FLOOR = 1400;
export const MAX_LEVEL = 2800;

/** "Starter 1200", "FIDE 1800". */
export const levelName = (r: number) => (r < FIDE_FLOOR ? `Starter ${r}` : `FIDE ${r}`);

/** A level kept on the 25-point grid, within MIN_LEVEL..MAX_LEVEL. */
export const clampLevel = (r: number) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(r / 25) * 25));

/** About 100 under the player's CC Rating (they win about 64% by the rating formula). */
export const matchLevel = (cc: number) => clampLevel(cc - 100);

/** A first game, before a CC Rating means much: a friendly level for a child. */
export const FIRST_LEVEL = 1200;

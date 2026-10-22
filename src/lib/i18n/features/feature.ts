/**
 * A feature's own words (owner, 2026-10-22: Marathi players still met English in the new features): English, and
 * Hindi and Marathi for every key (the types make a missing one an error). Chess words stay in English (Rating,
 * Puzzle, Race, Battle, Coach…), as in the rest of the site. Added to the site's words in ../index.ts.
 */
export function feature<const E extends Record<string, string>>(en: E, hi: Record<keyof E, string>, mr: Record<keyof E, string>) {
  return { en, hi, mr };
}

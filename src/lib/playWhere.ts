/**
 * Where a game between two Chess Castles players is played. Blitz and slower between two Lichess accounts: on
 * Lichess's servers, inside Chess Castles (rated if they like). Everything else, in a room of our own (server/api-worker
 * src/cup.ts "match": a friendly game, no ratings, no Lichess account needed): bullet, which Lichess plays only on its
 * own site; and any clock when either player has no Lichess account (owner, 2026-10-24: friends on Chess Castles
 * must be able to play each other at any time control, whatever Lichess allows).
 */

/** Bullet by Lichess's count (minutes + 40 × increment under 3 minutes). */
export const isBullet = (minutes: number, increment: number) => minutes * 60 + increment * 40 < 180;

/** Whether this game is played in a room of ours (`meLichess`: I have a Lichess account; `them`: the other player's uid). */
export const roomGame = (meLichess: boolean, them: string, minutes: number, increment: number) => isBullet(minutes, increment) || !meLichess || !them.startsWith('lichess:');

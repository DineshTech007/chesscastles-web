/**
 * Chess Castles is in beta, with every feature free, until the end of 30 November 2026 (India time). The BETA
 * badge by the name and the note on the home page go away by themselves after that day.
 */
export const BETA_UNTIL = '2026-11-30';

/** True while the beta lasts (by the date in India). */
export const betaOn = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) <= BETA_UNTIL;

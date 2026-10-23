/**
 * How long a lesson slide needs to be read (owner, 2026-10-23: kids pressed Next, Next and were paid for the lesson).
 * About 3 words a second (a child reading, or Guru speaking slowly), at least 3 seconds, and never more than 20 so a
 * long slide does not hold anyone; a slide whose moves play on the board needs the time they take.
 */
export function slideSeconds(text: string, moves = 0): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const reading = Math.min(20, Math.max(3, words / 3));
  const board = moves ? Math.min(15, 0.7 + moves * 0.9) : 0;
  return Math.round(Math.max(reading, board) * 10) / 10;
}

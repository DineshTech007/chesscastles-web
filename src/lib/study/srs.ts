/**
 * SuperMemo SM-2 adapted for opening moves (the app's lib/openings/srs.dart):
 * right answers schedule 1 day, 6 days, then grow by the ease; a wrong one
 * resets the card and brings it back in ten minutes, so it is practised
 * again in the same sitting. The ease never drops below 1.3.
 */
export interface SrsCard {
  id: string;
  /** Due time, ms since the epoch. */
  due: number;
  repetitions: number;
  intervalDays: number;
  ease: number;
}

/** How well a move was recalled, on SM-2's 0–5 scale. */
export const Recall = { wrong: 1, slow: 4, easy: 5 } as const;
export type RecallQuality = (typeof Recall)[keyof typeof Recall];

const MINUTE = 60_000;

export const freshCard = (id: string, now: number): SrsCard => ({
  id,
  due: now,
  repetitions: 0,
  intervalDays: 0,
  ease: 2.5,
});

export const isDue = (c: SrsCard, now: number) => c.due <= now;

export function review(card: SrsCard, q: RecallQuality, now: number): SrsCard {
  const ease = Math.max(1.3, card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (q < 3) return { id: card.id, repetitions: 0, intervalDays: 0, ease, due: now + 10 * MINUTE };
  const reps = card.repetitions + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.intervalDays * card.ease);
  return { id: card.id, repetitions: reps, intervalDays: interval, ease, due: now + Math.round(interval * 24 * 60) * MINUTE };
}

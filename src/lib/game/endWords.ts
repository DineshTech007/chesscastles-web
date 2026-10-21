/**
 * How a game ended, in words for anyone watching it or reading it later (owner's request, 2026-10-21). A game keeps
 * its player's own words ("You resigned", "Your opponent ran out of time"), which read wrongly to a friend watching
 * or looking at it: "by resignation", "on time", "Draw by repetition" instead. Anything else stays as it was.
 */
const WORDS: Record<string, string> = {
  Checkmate: 'by checkmate',
  'You resigned': 'by resignation',
  'White resigned': 'by resignation',
  'Black resigned': 'by resignation',
  'You ran out of time': 'on time',
  'Your opponent ran out of time': 'on time',
  'White ran out of time': 'on time',
  'Black ran out of time': 'on time',
  Stalemate: 'Draw by stalemate',
  'Same position three times': 'Draw by repetition',
  '50 moves without a capture or pawn move': 'Draw by the 50-move rule',
  'Neither side can checkmate': 'Draw: neither side can checkmate',
  'Time ran out, but the other side cannot checkmate': 'Draw: time ran out, but checkmate was not possible',
};

/** "by resignation", "on time", "Draw by repetition"… ('' for none). */
export const endWords = (reason?: string) => (reason ? (WORDS[reason] ?? reason) : '');

/** The same with a capital, on its own in a list ("Blitz · 5+0 · By resignation"). */
export const endWordsCap = (reason?: string) => {
  const w = endWords(reason);
  return w && w[0].toUpperCase() + w.slice(1);
};

/** Whether those words are a draw's ("Draw by repetition"). */
export const isDrawWords = (words: string) => /^draw/i.test(words);

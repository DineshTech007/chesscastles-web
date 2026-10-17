/** Openings to prepare against (the app's openingCatalog). */
export interface Opening {
  id: string;
  name: string;
  sans: string;
  blurb: string;
  /** The side you play when you train it. */
  side: 'white' | 'black';
}

export const OPENINGS: Opening[] = [
  { id: 'italian', name: 'Italian Game', sans: 'e4 e5 Nf3 Nc6 Bc4', blurb: 'Quick development and an early attack on f7.', side: 'white' },
  { id: 'ruy-lopez', name: 'Ruy Lopez', sans: 'e4 e5 Nf3 Nc6 Bb5', blurb: 'The Spanish: classical pressure on e5.', side: 'white' },
  { id: 'queens-gambit', name: "Queen's Gambit", sans: 'd4 d5 c4', blurb: 'Offer a pawn to win the centre.', side: 'white' },
  { id: 'london', name: 'London System', sans: 'd4 d5 Bf4', blurb: 'One solid set-up against almost anything.', side: 'white' },
  { id: 'jobava', name: 'Jobava London', sans: 'd4 d5 Nc3 Nf6 Bf4', blurb: 'The London with Nc3: sharp, aggressive, Nb5 ideas.', side: 'white' },
  { id: 'english', name: 'English Opening', sans: 'c4', blurb: 'Flexible flank play.', side: 'white' },
  { id: 'najdorf', name: 'Sicilian Najdorf', sans: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', blurb: "Fischer and Kasparov's fighting choice.", side: 'black' },
  { id: 'sicilian', name: 'Sicilian Defence', sans: 'e4 c5', blurb: 'The most popular answer to 1.e4.', side: 'black' },
  { id: 'caro-kann', name: 'Caro-Kann Defence', sans: 'e4 c6', blurb: 'Solid and hard to crack.', side: 'black' },
  { id: 'french', name: 'French Defence', sans: 'e4 e6', blurb: 'A strong pawn chain and counterplay.', side: 'black' },
  { id: 'scandinavian', name: 'Scandinavian Defence', sans: 'e4 d5', blurb: 'Hit the centre at once.', side: 'black' },
  { id: 'qgd', name: "Queen's Gambit Declined", sans: 'd4 d5 c4 e6', blurb: 'Rock-solid classical defence.', side: 'black' },
  { id: 'slav', name: 'Slav Defence', sans: 'd4 d5 c4 c6', blurb: 'Keep the bishop free, hold d5.', side: 'black' },
  { id: 'kings-indian', name: "King's Indian Defence", sans: 'd4 Nf6 c4 g6 Nc3 Bg7', blurb: 'Let White take the centre, then strike.', side: 'black' },
  { id: 'nimzo', name: 'Nimzo-Indian Defence', sans: 'd4 Nf6 c4 e6 Nc3 Bb4', blurb: 'Pin, double the pawns, control e4.', side: 'black' },
];

/** Rated games per 100-point group in the book (both players counted). */
export const GAMES_PER_HUNDRED: Record<number, number> = {
  1000: 6722, 1100: 12950, 1200: 19991, 1300: 29872, 1400: 44595, 1500: 70751, 1600: 108109,
  1700: 165680, 1800: 254722, 1900: 388534, 2000: 723184, 2100: 1038128, 2200: 1452018,
  2300: 1570776, 2400: 1470356, 2500: 978750, 2600: 460412, 2700: 133905, 2800: 10693,
};

export function coverage(rating: number): { text: string; tone: string } {
  const n = GAMES_PER_HUNDRED[Math.floor(rating / 100) * 100] ?? 0;
  if (n >= 150_000) return { text: 'Plenty of real games at this level', tone: 'var(--win)' };
  if (n >= 40_000) return { text: 'Good: real moves for most of the opening', tone: 'var(--accent)' };
  return { text: 'Fewer games here: the engine helps sooner', tone: 'var(--engine)' };
}

/** Stockfish levels for "Play the computer" (the app's playLevels). */
export const LEVELS: { name: string; elo: number }[] = [
  { name: 'Beginner', elo: 1350 },
  { name: 'Club', elo: 1600 },
  { name: 'Strong', elo: 1900 },
  { name: 'Expert', elo: 2200 },
  { name: 'Master', elo: 2500 },
  { name: 'Maximum', elo: 3190 },
];

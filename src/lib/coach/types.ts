import type { L10n } from './i18n';

export type Category = 'opening' | 'middlegame' | 'endgame';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface GameRef {
  /** CaissaBase game id (opens on the analysis board). */
  id: number;
  white: string;
  black: string;
  event: string;
  year: number;
  /** The legend whose idea this is (a key of LEGENDS). */
  legend?: string;
}

/** One explained position: the board, the moves played out, and Guru's words. */
export interface Slide {
  /** The position at the start of the slide. */
  fen: string;
  /** Moves played out on the board (UCI), one after another. */
  moves?: string[];
  text: L10n;
  arrows?: { from: string; to: string; brush?: 'green' | 'red' | 'blue' | 'yellow' }[];
  /** Squares to highlight. */
  marks?: string[];
  /** "Practice with the engine" from this slide: the position (default: after the moves) and the student's side. */
  practice?: { fen?: string; side?: 'white' | 'black' } | false;
  game?: GameRef;
  orientation?: 'white' | 'black';
}

export interface Lesson {
  id: string;
  category: Category;
  section: string;
  level: Level;
  title: string;
  blurb: string;
  slides: Slide[];
  /** Legends whose games the lesson uses. */
  legends?: string[];
}

/** A lesson in the catalogue; its slides load when it is opened. */
export interface LessonEntry extends Omit<Lesson, 'slides'> {
  load: () => Promise<Lesson>;
}

export const SECTIONS: Record<Category, string[]> = {
  opening: ['Opening basics', 'Open games (1.e4 e5)', 'Sicilian Defence', 'Other answers to 1.e4', "Queen's pawn openings", 'Indian defences', 'Flank openings'],
  middlegame: ['Basics', 'Tactics', 'Checkmate patterns', 'Strategy'],
  endgame: ['Basic checkmates', 'Pawn endgames', 'Rook endgames', 'Advanced endgames'],
};

import type { Chess } from 'chessops/chess';
import type { NormalMove, Role } from 'chessops/types';
import { makeSquare } from 'chessops/util';
import { fill, type L10n, type Lang } from './i18n';

/**
 * Written explanations, no AI: checked chess facts become sentences in
 * English, Hindi and Marathi (chess words stay English, everyday Hindi and
 * Marathi). Every sentence a lesson shows comes from here or from the
 * lesson texts themselves, so it is always correct.
 */

export type Note =
  | { k: 'develop'; piece: Role }
  | { k: 'occupyCentre'; squares: string }
  | { k: 'controlCentre'; squares: string }
  | { k: 'capture'; piece: Role; square: string }
  | { k: 'opensLine'; piece: Role; square: string }
  | { k: 'space' }
  | { k: 'challenge' }
  | { k: 'gambit' }
  | { k: 'fianchetto' }
  | { k: 'castleReady' }
  | { k: 'castles' }
  | { k: 'pins'; piece: Role; square: string }
  | { k: 'attacks'; piece: Role; square: string }
  | { k: 'fork'; piece: Role; square: string; a: Role; b: Role }
  | { k: 'check' }
  | { k: 'mate' }
  | { k: 'popular'; pct: number; games: string }
  | { k: 'wins'; piece: Role }
  | { k: 'promotes' };

const T: Record<Note['k'] | 'forkBoth', L10n> = {
  develop: { en: 'It develops the {piece} into the game.', hi: 'इससे {piece} game में आ जाता है (development)।', mr: 'यामुळे {piece} game मध्ये येतो (development).' },
  occupyCentre: { en: 'It takes a centre square ({squares}).', hi: 'यह centre के square ({squares}) पर कब्ज़ा करता है।', mr: 'हे centre चा square ({squares}) ताब्यात घेते.' },
  controlCentre: { en: 'It controls the centre ({squares}).', hi: 'यह centre के squares {squares} को control करता है।', mr: 'हे centre चे squares {squares} control करते.' },
  capture: { en: 'It captures the {piece} on {square}.', hi: 'यह {square} पर {piece} को capture करता है।', mr: 'हे {square} वरचा {piece} capture करते.' },
  opensLine: { en: 'It opens a line for the {piece} on {square}.', hi: 'इससे {square} वाले {piece} के लिए रास्ता खुलता है।', mr: 'यामुळे {square} वरच्या {piece} साठी रस्ता मोकळा होतो.' },
  space: { en: 'It gains space.', hi: 'इससे ज़्यादा space मिलता है।', mr: 'यामुळे जास्त space मिळते.' },
  challenge: { en: "It challenges the opponent's pawns.", hi: 'यह सामने वाले के pawns को challenge करता है।', mr: 'हे समोरच्याच्या pawns ना challenge करते.' },
  gambit: { en: 'It offers a pawn (a gambit) to win time or the centre.', hi: 'यह time या centre पाने के लिए एक pawn offer करता है (gambit)।', mr: 'time किंवा centre मिळवण्यासाठी हे एक pawn offer करते (gambit).' },
  fianchetto: { en: 'Fianchetto: the bishop aims along the long diagonal.', hi: 'Fianchetto: bishop लंबे diagonal पर निशाना साधता है।', mr: 'Fianchetto: bishop लांब diagonal वर नेम धरतो.' },
  castleReady: { en: 'Now castling is possible.', hi: 'अब castling हो सकती है।', mr: 'आता castling करता येते.' },
  castles: { en: 'Castling puts the king in safety and brings the rook toward the centre.', hi: 'Castling से king safe हो जाता है और rook centre की तरफ़ आता है।', mr: 'Castling मुळे king safe होतो आणि rook centre कडे येतो.' },
  pins: { en: 'It pins the {piece} on {square}.', hi: 'यह {square} वाले {piece} को pin करता है।', mr: 'हे {square} वरच्या {piece} ला pin करते.' },
  attacks: { en: 'It attacks the {piece} on {square}.', hi: 'यह {square} वाले {piece} पर attack करता है।', mr: 'हे {square} वरच्या {piece} वर attack करते.' },
  fork: { en: 'The {piece} on {square} attacks the {a} and the {b} at the same time: a fork!', hi: '{square} वाला {piece} एक साथ {a} और {b} पर attack करता है: fork!', mr: '{square} वरचा {piece} एकाच वेळी {a} आणि {b} वर attack करतो: fork!' },
  forkBoth: { en: 'The {piece} on {square} attacks both {a}s at the same time: a fork!', hi: '{square} वाला {piece} एक साथ दोनों {a} पर attack करता है: fork!', mr: '{square} वरचा {piece} एकाच वेळी दोन्ही {a} वर attack करतो: fork!' },
  check: { en: 'It gives check.', hi: 'यह check देता है।', mr: 'हे check देते.' },
  mate: { en: 'Checkmate!', hi: 'Checkmate!', mr: 'Checkmate!' },
  popular: { en: 'Strong players (2000+) chose this move in {pct}% of {games} games.', hi: 'Strong players (2000+) ने {games} games में से {pct}% में यही move खेली।', mr: 'Strong players (2000+) नी {games} games पैकी {pct}% मध्ये हीच move खेळली.' },
  wins: { en: 'The {piece} is won.', hi: '{piece} जीत लिया।', mr: '{piece} जिंकला.' },
  promotes: { en: 'The pawn becomes a new queen!', hi: 'Pawn नई queen बन जाता है!', mr: 'Pawn नवी queen बनतो!' },
};

export function noteText(n: Note, lang: Lang): string {
  // Two pieces of the same kind: "attacks both rooks", not "the rook and the rook".
  const key = n.k === 'fork' && n.a === n.b ? 'forkBoth' : n.k;
  return fill(T[key][lang], n as unknown as Record<string, string | number>);
}

export const notesText = (notes: Note[], lang: Lang) => notes.map((n) => noteText(n, lang)).join(' ');

/** "White plays knight to f3", in each language (chess words in English). */
export function moveSentence(pos: Chess, m: NormalMove, lang: Lang): string {
  const piece = pos.board.get(m.from);
  const side = pos.turn === 'white' ? 'White' : 'Black';
  const to = makeSquare(m.to);
  const target = pos.board.get(m.to);
  if (piece?.role === 'king' && target?.color === piece.color) {
    return { en: `${side} castles.`, hi: `${side} castling करता है।`, mr: `${side} castling करतो.` }[lang];
  }
  const role = piece?.role ?? 'piece';
  if (target) return { en: `${side} plays ${role} takes ${to}.`, hi: `${side}: ${role} ${to} पर capture करता है।`, mr: `${side}: ${role} ${to} वर capture करतो.` }[lang];
  return { en: `${side} plays ${role} to ${to}.`, hi: `${side}: ${role} ${to} पर।`, mr: `${side}: ${role} ${to} वर.` }[lang];
}

/** A whole number with thousands as "1.2 lakh"/"12k"-style short text. */
export function shortCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

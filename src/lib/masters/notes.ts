import type { Chess } from 'chessops/chess';
import type { Color, NormalMove, Role, Square } from 'chessops/types';
import { makeSquare, opposite, squareFile, squareRank } from 'chessops/util';
import { attacks } from 'chessops/attacks';
import { attackersOf, VALUE } from '$lib/coach/facts';
import { fill, type L10n, type Lang } from '$lib/coach/i18n';

/**
 * Why a master's endgame move is good, in plain words: checked facts about the
 * position (a passed pawn, the king walking up, a rook behind a pawn, the
 * opposition...), never guesses. Each note is a sentence in English, Hindi
 * and Marathi (chess words stay English).
 */
export type EndNote =
  | { k: 'mate' }
  | { k: 'promotes' }
  | { k: 'trade'; piece: Role }
  | { k: 'tradeAhead' }
  | { k: 'winsPawn'; square: string }
  | { k: 'wins'; piece: Role; square: string }
  | { k: 'newPasser'; square: string }
  | { k: 'pushPasser' }
  | { k: 'rookBehind' }
  | { k: 'cutOff' }
  | { k: 'seventh' }
  | { k: 'opposition' }
  | { k: 'blockade'; square: string }
  | { k: 'kingCentre' }
  | { k: 'kingPasser' }
  | { k: 'kingPawns' }
  | { k: 'attacksPawn'; square: string }
  | { k: 'check' };

const T: Record<EndNote['k'], L10n> = {
  mate: { en: 'Checkmate!', hi: 'Checkmate!', mr: 'Checkmate!' },
  promotes: { en: 'The pawn becomes a new queen!', hi: 'Pawn नई queen बन जाता है!', mr: 'Pawn नवी queen बनतो!' },
  trade: { en: 'It trades the {piece}s.', hi: 'यह {piece} का trade करता है।', mr: 'हे {piece} चा trade करते.' },
  tradeAhead: {
    en: 'When you are ahead in material, every trade brings the win closer.',
    hi: 'जब तुम material में आगे हो, तब हर trade जीत को और पास लाता है।',
    mr: 'तू material मध्ये पुढे असताना प्रत्येक trade जिंकणं आणखी जवळ आणतो.',
  },
  winsPawn: { en: 'It wins the pawn on {square}.', hi: 'यह {square} वाला pawn जीत लेता है।', mr: 'हे {square} वरचा pawn जिंकतं.' },
  wins: { en: 'It wins the {piece} on {square}.', hi: 'यह {square} वाला {piece} जीत लेता है।', mr: 'हे {square} वरचा {piece} जिंकतं.' },
  newPasser: {
    en: 'Now the pawn on {square} is a passed pawn: no enemy pawn can stop it.',
    hi: 'अब {square} वाला pawn passed pawn है: कोई दुश्मन pawn उसे रोक नहीं सकता।',
    mr: 'आता {square} वरचा pawn passed pawn आहे: कुठलाही शत्रूचा pawn त्याला अडवू शकत नाही.',
  },
  pushPasser: {
    en: 'The passed pawn moves forward. Passed pawns must be pushed!',
    hi: 'Passed pawn आगे बढ़ता है। Passed pawns को आगे धकेलना ही चाहिए!',
    mr: 'Passed pawn पुढे जातो. Passed pawns ना पुढे ढकलायलाच हवं!',
  },
  rookBehind: {
    en: 'The rook goes behind the passed pawn: rooks belong behind passed pawns.',
    hi: 'Rook passed pawn के पीछे जाता है: rook की जगह passed pawn के पीछे होती है।',
    mr: 'Rook passed pawn च्या मागे जातो: rook ची जागा passed pawn च्या मागे असते.',
  },
  cutOff: {
    en: 'The rook cuts the enemy king off from the passed pawn.',
    hi: 'Rook दुश्मन king को passed pawn से काट देता है (cut off)।',
    mr: 'Rook शत्रूच्या king ला passed pawn पासून तोडतो (cut off).',
  },
  seventh: {
    en: 'The rook reaches the 7th rank, where it attacks the pawns from the side.',
    hi: 'Rook 7th rank पर पहुँचता है, जहाँ से वो pawns पर बगल से attack करता है।',
    mr: 'Rook 7th rank वर पोहोचतो, जिथून तो pawns वर बाजूने attack करतो.',
  },
  opposition: {
    en: 'The kings face each other with one square between them: this is the opposition, and the other king has to give way.',
    hi: 'दोनों kings के बीच एक square है और वो आमने-सामने हैं: यह opposition है, अब दूसरे king को रास्ता देना पड़ेगा।',
    mr: 'दोन्ही kings समोरासमोर आहेत आणि मध्ये एक square आहे: हे opposition आहे, आता दुसऱ्या king ला वाट सोडावी लागेल.',
  },
  blockade: {
    en: 'It stops the passed pawn by standing right in front of it, on {square}.',
    hi: 'यह {square} पर passed pawn के ठीक आगे खड़ा होकर उसे रोक देता है।',
    mr: 'हे {square} वर passed pawn च्या अगदी समोर उभं राहून त्याला थांबवतं.',
  },
  kingCentre: {
    en: 'The king walks toward the centre: in the endgame the king is a fighting piece.',
    hi: 'King centre की तरफ़ चलता है: endgame में king भी लड़ने वाला piece है।',
    mr: 'King centre कडे चालतो: endgame मध्ये king सुद्धा लढणारा piece असतो.',
  },
  kingPasser: {
    en: 'The king comes to help its passed pawn.',
    hi: 'King अपने passed pawn की मदद करने आता है।',
    mr: 'King आपल्या passed pawn च्या मदतीला येतो.',
  },
  kingPawns: {
    en: "The king walks up to the enemy pawns to attack them.",
    hi: 'King दुश्मन के pawns पर attack करने उनके पास जाता है।',
    mr: 'King शत्रूच्या pawns वर attack करायला त्यांच्या जवळ जातो.',
  },
  attacksPawn: {
    en: 'It attacks the pawn on {square}, which has no defender.',
    hi: 'यह {square} वाले pawn पर attack करता है, जिसे कोई बचा नहीं रहा।',
    mr: 'हे {square} वरच्या pawn वर attack करतं, ज्याला कोणी वाचवत नाहीये.',
  },
  check: { en: 'It gives check.', hi: 'यह check देता है।', mr: 'हे check देते.' },
};

export const endNoteText = (n: EndNote, lang: Lang) => fill(T[n.k][lang] || T[n.k].en, n as unknown as Record<string, string | number>);

const ahead = (rank: number, c: Color) => (c === 'white' ? rank : 7 - rank);
const nonPawnPieces = (pos: Chess) => [...pos.board.occupied].filter((s) => {
  const r = pos.board.get(s)?.role;
  return r !== 'pawn' && r !== 'king';
});

/** Whether the pawn of `c` on `s` is passed (no enemy pawn ahead on its own or a next file). */
export function isPassed(pos: Chess, s: Square, c: Color): boolean {
  const f = squareFile(s);
  const r = ahead(squareRank(s), c);
  for (const e of pos.board.pieces(opposite(c), 'pawn')) {
    if (Math.abs(squareFile(e) - f) <= 1 && ahead(squareRank(e), c) > r) return false;
  }
  return true;
}

const passers = (pos: Chess, c: Color) => [...pos.board.pieces(c, 'pawn')].filter((s) => isPassed(pos, s, c));
const material = (pos: Chess, c: Color) =>
  [...pos.board[c]].reduce((sum, s) => {
    const r = pos.board.get(s)!.role;
    return r === 'king' ? sum : sum + VALUE[r];
  }, 0);
const dist = (a: Square, b: Square) => Math.max(Math.abs(squareFile(a) - squareFile(b)), Math.abs(squareRank(a) - squareRank(b)));
const centreDist = (s: Square) => Math.max(Math.abs(squareFile(s) * 2 - 7), Math.abs(squareRank(s) * 2 - 7)) >> 1;
const nearest = (s: Square, list: Square[]) => (list.length ? Math.min(...list.map((t) => dist(s, t))) : 99);

/** Up to two notes on why `move` (by the side to move in `pos`) is good. */
export function endgameNotes(pos: Chess, move: NormalMove): EndNote[] {
  const me = pos.turn;
  const them = opposite(me);
  const piece = pos.board.get(move.from);
  if (!piece) return [];
  const after = pos.clone();
  after.play(move);
  const out: EndNote[] = [];
  const add = (n: EndNote) => out.length < 2 && out.push(n);

  if (after.isCheckmate()) return [{ k: 'mate' }];
  if (move.promotion) add({ k: 'promotes' });

  const target = pos.board.get(move.to);
  if (target && target.color === them) {
    const recapture = attackersOf(after, move.to, them).length > 0;
    if (target.role === piece.role && recapture) {
      add({ k: 'trade', piece: target.role });
      if (material(pos, me) - material(pos, them) >= 1) add({ k: 'tradeAhead' });
    } else if (!recapture || VALUE[target.role] > VALUE[piece.role]) {
      add(target.role === 'pawn' ? { k: 'winsPawn', square: makeSquare(move.to) } : { k: 'wins', piece: target.role, square: makeSquare(move.to) });
    }
  }

  // Passed pawns.
  const before = passers(pos, me);
  const now = passers(after, me);
  const fresh = now.find((s) => !before.includes(s) && !(piece.role === 'pawn' && before.includes(move.from) && s === move.to));
  if (fresh !== undefined) add({ k: 'newPasser', square: makeSquare(fresh) });
  else if (piece.role === 'pawn' && !move.promotion && before.includes(move.from) && now.includes(move.to)) add({ k: 'pushPasser' });

  if (piece.role === 'rook') {
    const file = squareFile(move.to);
    const rank = ahead(squareRank(move.to), me);
    const behind = [...passers(after, me)].some((p) => squareFile(p) === file && ahead(squareRank(p), me) > rank)
      || [...passers(after, them)].some((p) => squareFile(p) === file && ahead(squareRank(p), them) > ahead(squareRank(move.to), them));
    const wasBehind = squareFile(move.from) === file && behind;
    if (behind && !wasBehind) add({ k: 'rookBehind' });
    else {
      const enemyKing = after.board.kingOf(them);
      const cut = enemyKing !== undefined && squareFile(move.from) !== file && now.some((p) => {
        const kf = squareFile(enemyKing);
        const pf = squareFile(p);
        return Math.min(kf, pf) < file && file < Math.max(kf, pf) && dist(enemyKing, move.to) > 1;
      });
      if (cut) add({ k: 'cutOff' });
      else if (rank === 6 && ahead(squareRank(move.from), me) !== 6) {
        const pawnsThere = [...after.board.pieces(them, 'pawn')].some((p) => ahead(squareRank(p), me) === 6);
        const kingThere = enemyKing !== undefined && ahead(squareRank(enemyKing), me) === 7;
        if (pawnsThere || kingThere) add({ k: 'seventh' });
      }
    }
  }

  if (piece.role !== 'pawn' && piece.role !== 'king') {
    const blocked = passers(after, them).find((p) => {
      const step = them === 'white' ? 8 : -8;
      return p + step === move.to;
    });
    if (blocked !== undefined) add({ k: 'blockade', square: makeSquare(move.to) });
  }

  if (piece.role === 'king') {
    const enemyKing = after.board.kingOf(them);
    const pawnEnding = nonPawnPieces(after).length === 0;
    if (pawnEnding && enemyKing !== undefined) {
      const df = Math.abs(squareFile(enemyKing) - squareFile(move.to));
      const dr = Math.abs(squareRank(enemyKing) - squareRank(move.to));
      if ((df === 0 && dr === 2) || (dr === 0 && df === 2)) add({ k: 'opposition' });
    }
    if (out.length < 2 && !target) {
      const mine = passers(pos, me);
      const enemyPawns = [...pos.board.pieces(them, 'pawn')];
      if (centreDist(move.to) < centreDist(move.from) && centreDist(move.from) >= 2) add({ k: 'kingCentre' });
      else if (mine.length && nearest(move.to, mine) < nearest(move.from, mine)) add({ k: 'kingPasser' });
      else if (nearest(move.to, enemyPawns) < nearest(move.from, enemyPawns) && nearest(move.to, enemyPawns) <= 2) add({ k: 'kingPawns' });
    }
  }

  if (!out.length && piece.role !== 'king' && piece.role !== 'pawn') {
    for (const t of attacks(piece, move.to, after.board.occupied)) {
      const p = after.board.get(t);
      if (p?.color === them && p.role === 'pawn' && !attackersOf(after, t, them).length) {
        const already = attacks(piece, move.from, pos.board.occupied).has(t);
        if (!already) {
          add({ k: 'attacksPawn', square: makeSquare(t) });
          break;
        }
      }
    }
  }
  if (!out.length && after.isCheck()) add({ k: 'check' });
  return out;
}

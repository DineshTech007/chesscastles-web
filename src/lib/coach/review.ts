import type { Chess } from 'chessops/chess';
import type { Color, NormalMove, Role } from 'chessops/types';
import { makeSquare } from 'chessops/util';
import { fenOf, moveToUci, positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
import { engine, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
import type { SavedGame } from '$lib/stores/myGames';
import { loadLibrary } from './content/openings';
import { moveSentence, noteText } from './explain';
import { gradeMove, openingNotes, type Grade } from './facts';
import { fill, type L10n, type Lang } from './i18n';
import type { Lesson, Slide } from './types';
import type { MoveClass } from '$lib/review/badges';

/**
 * Game review with Guru: the engine studies every move of the student's game,
 * then the review becomes slides: a summary, the opening, the biggest
 * mistakes with the better moves played out, and the best moment.
 */

export interface MoveReview {
  ply: number;
  san: string;
  move: NormalMove;
  /** Who played it. */
  color: Color;
  grade: Grade;
  /** The review badge: brilliant, only move, best, … blunder. */
  cls: MoveClass;
  /** Drop in the student's winning chances, 0..1. */
  drop: number;
  before: EngineInfo;
  after: EngineInfo;
  fenBefore: string;
}

export interface GameReview {
  accuracy: number;
  counts: Record<Grade, number>;
  opening?: { eco: string; name: string; plies: number };
  /** The student's moves. */
  moves: MoveReview[];
  /** Every move of the game, both sides, with its badge. */
  all: MoveReview[];
  /** Accuracy and badge counts for each side. */
  sides: Record<Color, { accuracy: number; classes: Record<MoveClass, number> }>;
  /** The positions of the game, from the start. */
  fens: string[];
}

const TACTICAL = new Set(['capture', 'pins', 'attacks', 'fork', 'check', 'mate']);

/** The first look: every position to this depth, or this long, whichever comes first. */
const FIRST_DEPTH = 13;
const FIRST_MS = 1200;
/** Moves still in the named opening are labelled "book": a light look is enough. */
const BOOK_DEPTH = 8;
const CACHE_KEY = 'k24.reviews';
const CACHE_MAX = 30;

/** A finished review, kept so opening the same game again is instant. */
function cached(key: string): GameReview | undefined {
  try {
    const r = (JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, GameReview>)[key];
    return r && withMisses(r);
  } catch {
    return undefined;
  }
}

/** Every review kept on this device with its game's moves (UCI) and the player's side, for the profile's all-time numbers. */
export function keptReviews(): { moves: string; side: Color; review: GameReview }[] {
  try {
    return Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, GameReview>).map(([key, review]) => {
      const [, moves, side] = key.split('|');
      return { moves, side: side as Color, review: withMisses(review) };
    });
  } catch {
    return [];
  }
}

/** Reviews kept before the missed-win badge: their mistakes and blunders that were missed wins get it now. */
export function withMisses(r: GameReview): GameReview {
  if (r.sides.white.classes.miss !== undefined) return r;
  r.sides.white.classes.miss = 0;
  r.sides.black.classes.miss = 0;
  const byPly = new Map(r.all.map((m) => [m.ply, m]));
  for (const m of r.all) {
    if ((m.cls !== 'mistake' && m.cls !== 'blunder') || !isMiss(m.before, m.after, byPly.get(m.ply - 1)?.before, m.color)) continue;
    r.sides[m.color].classes[m.cls]--;
    r.sides[m.color].classes.miss++;
    m.cls = 'miss';
  }
  for (const m of r.moves) m.cls = byPly.get(m.ply)?.cls ?? m.cls;
  return r;
}
function keep(key: string, review: GameReview) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, GameReview>;
    delete all[key];
    all[key] = review;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - CACHE_MAX))) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the review just isn't kept */
  }
}

/**
 * Reviews a game: every position at depth 13 (capped at about a second, so a
 * hard position can't hold a phone up), then the positions around each move
 * about to be called brilliant, an only move, a mistake or a blunder again,
 * deeper (`recheckDepth`: the plan's review depth), so the labels people
 * notice are not shallow guesses. A finished review is kept on the device.
 */
export async function analyseGame(g: SavedGame, onProgress: (p: number) => void, recheckDepth = 18, stopped: () => boolean = () => false): Promise<GameReview> {
  const positions: Chess[] = [positionFromFen(g.startFen)];
  const moves: NormalMove[] = [];
  for (const uci of g.uci) {
    const m = uciToMove(uci);
    const p = positions[positions.length - 1].clone();
    if (!m || !p.isLegal(m)) break;
    p.play(m);
    moves.push(m);
    positions.push(p);
  }
  const cacheKey = `${fenOf(positions[0])}|${moves.map(moveToUci).join(' ')}|${g.userSide}|${recheckDepth}`;
  const hit = cached(cacheKey);
  if (hit) {
    onProgress(1);
    return hit;
  }
  const opening = await findOpening(positions[0], moves);
  const evals: (EngineInfo | undefined)[] = [];
  for (let i = 0; i < positions.length; i++) {
    if (stopped()) throw new Error('stopped');
    const book = !!opening && i < opening.plies;
    // The second-best line tells an only move from an easy one.
    evals.push(positions[i].isEnd() ? undefined : await engine.evaluate(fenOf(positions[i]), book ? BOOK_DEPTH : FIRST_DEPTH, 2, FIRST_MS));
    onProgress((0.8 * (i + 1)) / positions.length);
  }
  // The second look: the positions around every strong label, deeper.
  const recheck = new Set<number>();
  for (let i = 0; i < moves.length; i++) {
    const before = evals[i];
    const after = evals[i + 1];
    if (!before || !after) continue;
    const color = positions[i].turn;
    const mine = (x: EngineInfo) => (color === 'white' ? whiteChances(x) : 1 - whiteChances(x));
    const grade = gradeMove(before, after, color, moves[i], positions[i]);
    const drop = Math.max(0, mine(before) - mine(after));
    const cls = classify({ pos: positions[i], move: moves[i], prev: i > 0 ? { pos: positions[i - 1], move: moves[i - 1] } : undefined, before, after, prevBefore: evals[i - 1], grade, drop, color, book: !!opening && i < opening.plies });
    if (cls === 'brilliant' || cls === 'only' || cls === 'mistake' || cls === 'miss' || cls === 'blunder') recheck.add(i).add(i + 1);
  }
  const deeper = [...recheck].filter((i) => !positions[i].isEnd());
  for (let k = 0; k < deeper.length; k++) {
    if (stopped()) throw new Error('stopped');
    evals[deeper[k]] = await engine.evaluate(fenOf(positions[deeper[k]]), recheckDepth, 2, recheckDepth >= 22 ? 8000 : 4000);
    onProgress(0.8 + (0.2 * (k + 1)) / deeper.length);
  }
  onProgress(1);
  const counts: Record<Grade, number> = { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  const emptyClasses = (): Record<MoveClass, number> => ({ brilliant: 0, only: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0 });
  const acc: Record<Color, { sum: number; n: number; classes: Record<MoveClass, number> }> = {
    white: { sum: 0, n: 0, classes: emptyClasses() },
    black: { sum: 0, n: 0, classes: emptyClasses() },
  };
  const all: MoveReview[] = [];
  for (let i = 0; i < moves.length; i++) {
    const pos = positions[i];
    const color = pos.turn;
    const before = evals[i];
    // After a mating move there is nothing to evaluate: it is the best move.
    const after = evals[i + 1] ?? (positions[i + 1].isCheckmate() ? { fen: fenOf(positions[i + 1]), depth: 0, mate: color === 'white' ? 1 : -1, pv: [] } : undefined);
    if (!before || !after) continue;
    const grade = gradeMove(before, after, color, moves[i], pos);
    const mine = (x: EngineInfo) => (color === 'white' ? whiteChances(x) : 1 - whiteChances(x));
    const drop = Math.max(0, mine(before) - mine(after));
    const cls = classify({ pos, move: moves[i], prev: i > 0 ? { pos: positions[i - 1], move: moves[i - 1] } : undefined, before, after, prevBefore: evals[i - 1], grade, drop, color, book: !!opening && i < opening.plies });
    const side = acc[color];
    side.sum += Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop * 100) - 3.1669));
    side.n++;
    side.classes[cls]++;
    if (color === g.userSide) counts[grade]++;
    all.push({ ply: i, san: sanOf(pos, moves[i]), move: moves[i], color, grade, cls, drop, before, after, fenBefore: fenOf(pos) });
  }
  const sides = {
    white: { accuracy: acc.white.n ? Math.round(acc.white.sum / acc.white.n) : 0, classes: acc.white.classes },
    black: { accuracy: acc.black.n ? Math.round(acc.black.sum / acc.black.n) : 0, classes: acc.black.classes },
  };
  const review: GameReview = { accuracy: sides[g.userSide].accuracy, counts, opening, moves: all.filter((m) => m.color === g.userSide), all, sides, fens: positions.map(fenOf) };
  keep(cacheKey, review);
  return review;
}

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
const material = (p: Chess, c: Color) => (['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[]).reduce((n, r) => n + p.board.pieces(c, r).size() * VALUE[r], 0);

/**
 * The badge for one move:
 * - book: still in the named opening;
 * - brilliant: the best move (or as good), and it gives up material
 *   (2+ points along the engine's line) while the game stays fine, and the
 *   game was not already completely won;
 * - only move: the best move, when the second-best gives away a lot
 *   (not a plain recapture, and not when the second move also wins easily);
 * - best / excellent / good / inaccuracy / mistake / blunder by how much
 *   winning chance it gave away, except that a mistake or blunder that only
 *   misses a win (isMiss) is a missed win: a blunder loses the game, a miss
 *   lets a win slip.
 */
export function classify(o: {
  pos: Chess;
  move: NormalMove;
  prev?: { pos: Chess; move: NormalMove };
  before: EngineInfo;
  after: EngineInfo;
  /** The evaluation before the opponent's last move. */
  prevBefore?: EngineInfo;
  grade: Grade;
  drop: number;
  color: Color;
  book: boolean;
}): MoveClass {
  const { pos, move, before, after, grade, drop, color } = o;
  if ((grade === 'mistake' || grade === 'blunder') && isMiss(before, after, o.prevBefore, color)) return 'miss';
  if (o.book && grade !== 'mistake' && grade !== 'blunder') return 'book';
  if (grade === 'inaccuracy' || grade === 'mistake' || grade === 'blunder') return grade;
  const mine = (x: Pick<EngineInfo, 'cp' | 'mate'>) => (color === 'white' ? whiteChances(x) : 1 - whiteChances(x));
  const top = grade === 'best' || drop < 0.01;
  if (top && mine(before) < 0.95 && mine(after) >= 0.45 && isSacrifice(pos, move, after, color)) return 'brilliant';
  if (grade === 'best') {
    const second = before.second;
    const recapture = o.prev && o.prev.move.to === move.to && o.prev.pos.board.get(o.prev.move.to) !== undefined;
    let legal = 0;
    for (const [, d] of pos.allDests()) legal += d.size();
    if (second && legal > 1 && !recapture && mine(before) - mine(second) >= 0.2 && mine(second) < 0.85 && mine(before) >= 0.3) return 'only';
    return 'best';
  }
  return drop < 0.02 ? 'excellent' : 'good';
}

/** Winning chances at a centipawn score (the engine's curve). */
const chanceAt = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * cp));
/** Clearly winning: about three pawns up, or a mate. */
const WON = chanceAt(300);
/** Still winning: about two pawns up. */
const STILL_WON = chanceAt(180);

/**
 * A missed win rather than a blunder, for a move that gave away a lot: there
 * was a clear win, and either the player is still winning after the move (a
 * straighter win was missed), or the opponent had just slipped and the move
 * only gives back what that slip gave (no worse than before it, not losing).
 */
export function isMiss(before: EngineInfo, after: EngineInfo, prevBefore: EngineInfo | undefined, color: Color): boolean {
  const mine = (x: Pick<EngineInfo, 'cp' | 'mate'>) => (color === 'white' ? whiteChances(x) : 1 - whiteChances(x));
  const b = mine(before);
  const a = mine(after);
  if (b < WON) return false;
  if (a >= STILL_WON) return true;
  if (!prevBefore) return false;
  const earlier = mine(prevBefore);
  return a >= 0.45 && b - earlier >= 0.2 && a >= earlier - 0.03;
}

/**
 * Whether the move gives up 2+ points of material for good: still down after
 * the opponent's reply and after the next pair of moves too (so an exchange
 * in progress is not a sacrifice).
 */
function isSacrifice(pos: Chess, move: NormalMove, after: EngineInfo, color: Color): boolean {
  const them: Color = color === 'white' ? 'black' : 'white';
  const balance = (p: Chess) => material(p, color) - material(p, them);
  const start = balance(pos);
  const p = pos.clone();
  p.play(move);
  const line = after.pv.slice(0, 3);
  if (line.length < 3) return false;
  let best = -Infinity;
  for (let i = 0; i < line.length; i++) {
    const m = uciToMove(line[i]);
    if (!m || !p.isLegal(m)) return false;
    p.play(m);
    if (i % 2 === 0) best = Math.max(best, balance(p));
  }
  return start - best >= 2;
}

/** The longest named opening the game followed (from the 3,865-opening library). */
async function findOpening(start: Chess, moves: NormalMove[]): Promise<GameReview['opening']> {
  if (fenOf(start) !== fenOf(positionFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'))) return undefined;
  const rows = await loadLibrary().catch(() => []);
  const p = start.clone();
  const sans: string[] = [];
  for (const m of moves.slice(0, 30)) {
    sans.push(sanOf(p, m));
    p.play(m);
  }
  const line = sans.join(' ');
  let best: GameReview['opening'];
  for (const [eco, name, l] of rows) {
    const n = l.split(' ').length;
    if ((line === l || line.startsWith(`${l} `)) && (!best || n > best.plies)) best = { eco, name, plies: n };
  }
  return best;
}

const both = (fn: (l: Lang) => string): L10n => ({ en: fn('en'), hi: fn('hi'), mr: fn('mr') });
const moveNo = (ply: number) => Math.floor(ply / 2) + 1;

const T = {
  summary: {
    en: '{result} Your accuracy was {acc}%. Best moves: {best}. Good moves: {good}. Inaccuracies: {inacc}, mistakes: {mist}, missed wins: {miss}, blunders: {blun}. Let\'s look at the most important moments together.',
    hi: '{result} तुम्हारी accuracy {acc}% रही। Best moves: {best}। Good moves: {good}। Inaccuracies: {inacc}, mistakes: {mist}, missed wins: {miss}, blunders: {blun}। चलो, सबसे ज़रूरी moments साथ में देखते हैं।',
    mr: '{result} तुझी accuracy {acc}% होती. Best moves: {best}. Good moves: {good}. Inaccuracies: {inacc}, mistakes: {mist}, missed wins: {miss}, blunders: {blun}. चल, सगळ्यात महत्त्वाचे moments एकत्र बघूया.',
  },
  won: { en: 'You won this game. Well played!', hi: 'तुमने यह game जीता। बहुत बढ़िया!', mr: 'तू हा game जिंकलास. मस्त खेळलास!' },
  lost: { en: 'You lost this game, but every loss is a lesson.', hi: 'तुम यह game हार गए, पर हर हार एक lesson है।', mr: 'तू हा game हरलास, पण प्रत्येक हार एक lesson असते.' },
  draw: { en: 'This game was a draw.', hi: 'यह game draw रहा।', mr: 'हा game draw झाला.' },
  unfinished: { en: 'This game was not finished.', hi: 'यह game पूरा नहीं हुआ।', mr: 'हा game पूर्ण झाला नाही.' },
  opening: {
    en: 'You played the {name} ({eco}). You followed known opening theory for the first {moves} moves.',
    hi: 'तुमने {name} ({eco}) खेली। पहली {moves} moves तक तुमने जानी-मानी opening theory follow की।',
    mr: 'तू {name} ({eco}) खेळलास. पहिल्या {moves} moves पर्यंत तू ओळखीची opening theory follow केलीस.',
  },
  mistake: {
    en: 'Move {n}: you played {san}. {grade}',
    hi: 'Move {n}: तुमने {san} खेला। {grade}',
    mr: 'Move {n}: तू {san} खेळलास. {grade}',
  },
  punish: { en: 'Your opponent could answer: {reply}', hi: 'सामने वाला इसका जवाब दे सकता था: {reply}', mr: 'समोरचा याला उत्तर देऊ शकत होता: {reply}' },
  better: { en: 'Better was: {best}', hi: 'इससे बेहतर था: {best}', mr: 'याहून चांगली move होती: {best}' },
  practise: { en: 'Press Practice and play this position again against the engine.', hi: 'Practice दबाओ और यह position engine के खिलाफ़ फिर से खेलो।', mr: 'Practice दाब आणि ही position engine विरुद्ध पुन्हा खेळ.' },
  great: { en: 'Your best moment: move {n}, {san}. {why}', hi: 'तुम्हारा सबसे अच्छा moment: move {n}, {san}। {why}', mr: 'तुझा सगळ्यात भारी moment: move {n}, {san}. {why}' },
  greatWhy: { en: 'It was the best move in a position where the alternatives were much worse.', hi: 'यह ऐसी position में best move थी जहाँ दूसरी moves बहुत खराब थीं।', mr: 'अशा position मध्ये ही best move होती जिथे बाकीच्या moves खूप वाईट होत्या.' },
  clean: { en: 'No big mistakes in this game. Excellent, keep playing like this!', hi: 'इस game में कोई बड़ी गलती नहीं। शानदार, ऐसे ही खेलते रहो!', mr: 'या game मध्ये एकही मोठी चूक नाही. मस्त, असंच खेळत राहा!' },
  end: {
    en: 'That is the review. Remember the better moves, and practise the positions where you went wrong: that is how strong players improve.',
    hi: 'यह रहा review। बेहतर moves याद रखो, और जिन positions में गलती हुई उन्हें practice करो: strong players ऐसे ही सुधरते हैं।',
    mr: 'हा झाला review. चांगल्या moves लक्षात ठेव, आणि ज्या positions मध्ये चूक झाली त्या practice कर: strong players असेच सुधारतात.',
  },
};
const MISSED: L10n = {
  en: 'A win slipped away here: there was a much stronger move.',
  hi: 'यहाँ जीत हाथ से निकल गई: इससे कहीं ज़्यादा strong move थी।',
  mr: 'इथे जिंकायची संधी हुकली: याहून खूप जोरदार move होती.',
};
const GRADE: Record<Grade, L10n> = {
  blunder: { en: 'That was a blunder.', hi: 'यह blunder था।', mr: 'हा blunder होता.' },
  mistake: { en: 'That was a mistake.', hi: 'यह mistake थी।', mr: 'ही mistake होती.' },
  inaccuracy: { en: 'That was an inaccuracy.', hi: 'यह inaccuracy थी।', mr: 'ही inaccuracy होती.' },
  good: { en: 'A good move.', hi: 'अच्छी move।', mr: 'चांगली move.' },
  best: { en: 'The best move!', hi: 'Best move!', mr: 'Best move!' },
};

/** "White plays knight to f6. It attacks the queen on d7." in every language. */
function explainMove(pos: Chess, m: NormalMove, l: Lang): string {
  const notes = openingNotes(pos, m).filter((n) => TACTICAL.has(n.k));
  return [moveSentence(pos, m, l), ...notes.map((n) => noteText(n, l))].join(' ');
}

/** The review as lesson slides. */
export function reviewLesson(g: SavedGame, r: GameReview): Lesson {
  const side = g.userSide;
  const slides: Slide[] = [];
  const outcomeKey = g.result === '1/2-1/2' ? 'draw' : g.result === '*' ? 'unfinished' : (g.result === '1-0') === (side === 'white') ? 'won' : 'lost';
  // Mistakes, missed wins and blunders as the badges count them.
  const badge = (c: MoveClass) => r.moves.filter((m) => m.cls === c).length;
  const vars = { acc: r.accuracy, best: r.counts.best, good: r.counts.good, inacc: r.counts.inaccuracy, mist: badge('mistake'), miss: badge('miss'), blun: badge('blunder') };
  slides.push({ fen: g.startFen, orientation: side, practice: false, text: both((l) => fill(T.summary[l], { ...vars, result: T[outcomeKey][l] })) });

  if (r.opening) {
    const uci = g.uci.slice(0, r.opening.plies);
    slides.push({
      fen: g.startFen,
      moves: uci,
      orientation: side,
      text: both((l) => fill(T.opening[l], { name: r.opening!.name, eco: r.opening!.eco, moves: Math.ceil(r.opening!.plies / 2) })),
      practice: { side },
    });
  }

  // The three biggest mistakes, in game order.
  const worst = r.moves
    .filter((m) => m.grade === 'mistake' || m.grade === 'blunder' || (m.grade === 'inaccuracy' && m.drop >= 0.05))
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 3)
    .sort((a, b) => a.ply - b.ply);
  if (!worst.length) slides.push({ fen: g.startFen, orientation: side, practice: false, text: T.clean });
  for (const w of worst) {
    const pos = positionFromFen(w.fenBefore);
    const next = pos.clone();
    next.play(w.move);
    const reply = w.after.pv[0] ? uciToMove(w.after.pv[0]) : undefined;
    const replyOk = reply && next.isLegal(reply);
    slides.push({
      fen: w.fenBefore,
      moves: [moveToUci(w.move)],
      orientation: side,
      arrows: replyOk ? [{ from: makeSquare(reply!.from), to: makeSquare(reply!.to), brush: 'red' }] : undefined,
      text: both((l) => [fill(T.mistake[l], { n: moveNo(w.ply), san: w.san, grade: (w.cls === 'miss' ? MISSED : GRADE[w.grade])[l] }), replyOk ? fill(T.punish[l], { reply: explainMove(next, reply!, l) }) : ''].filter(Boolean).join(' ')),
      practice: { fen: w.fenBefore, side },
    });
    const best = w.before.pv[0] ? uciToMove(w.before.pv[0]) : undefined;
    if (best && pos.isLegal(best)) {
      // The better move and a few moves of the best play after it.
      const line: string[] = [];
      const q = pos.clone();
      for (const u of w.before.pv.slice(0, 4)) {
        const m = uciToMove(u);
        if (!m || !q.isLegal(m)) break;
        line.push(u);
        q.play(m);
      }
      slides.push({
        fen: w.fenBefore,
        moves: line,
        orientation: side,
        text: both((l) => `${fill(T.better[l], { best: explainMove(pos, best, l) })} ${T.practise[l]}`),
        practice: { fen: w.fenBefore, side },
      });
    }
  }

  // The best moment: a best move with a tactic in it if there is one, else the first best move in a sharp position.
  const bests = r.moves.filter((m) => m.grade === 'best');
  const tactic = (m: MoveReview) => openingNotes(positionFromFen(m.fenBefore), m.move).some((n) => TACTICAL.has(n.k) && n.k !== 'capture');
  const great = bests.find(tactic) ?? bests.sort((a, b) => Math.abs(b.before.cp ?? 0) - Math.abs(a.before.cp ?? 0))[0];
  if (great) {
    const pos = positionFromFen(great.fenBefore);
    const notes = openingNotes(pos, great.move).filter((n) => TACTICAL.has(n.k));
    slides.push({
      fen: great.fenBefore,
      moves: [moveToUci(great.move)],
      orientation: side,
      text: both((l) => fill(T.great[l], { n: moveNo(great.ply), san: great.san, why: notes.length ? notes.map((n) => noteText(n, l)).join(' ') : T.greatWhy[l] })),
      practice: false,
    });
  }
  slides.push({ fen: g.startFen, orientation: side, practice: false, text: T.end });
  return {
    id: `review-${g.id}`,
    category: 'middlegame',
    section: 'Game review',
    level: 'beginner',
    title: `Review: you vs ${side === 'white' ? g.black : g.white}`,
    blurb: '',
    slides,
  };
}

import { attacks } from 'chessops/attacks';
import type { Chess } from 'chessops/chess';
import { SquareSet } from 'chessops/squareSet';
import type { Color, NormalMove, Role, Square } from 'chessops/types';
import { makeSquare, opposite } from 'chessops/util';
import { sanOf, uciToMove } from '$lib/chess/position';
import { whiteChances, type EngineInfo } from '$lib/engine/stockfish';
import type { Note } from './explain';

/**
 * The checked truth about a position or a move, in plain English, for
 * Chess Guru. Everything here comes from the chess rules and
 * Stockfish, never from the language model, which only puts it into words.
 */

export const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
const sq = (s: Square) => makeSquare(s);
const side = (c: Color) => (c === 'white' ? 'White' : 'Black');

export type Grade = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface Arrow {
  id: string;
  from: string;
  to: string;
  /** Drawn colour: green for good ideas, red for threats, blue for plans. */
  brush: 'green' | 'red' | 'blue';
  label: string;
}

export interface Facts {
  facts: string[];
  arrows: Arrow[];
  /** Every square named in the facts (the reply may name only these). */
  squares: string[];
  grade?: Grade;
  /** The main square to look at, for written fallback replies. */
  focus?: { square: string; piece: string };
}

/** Squares of color's pieces that attack target. */
export function attackersOf(pos: Chess, target: Square, color: Color): Square[] {
  const out: Square[] = [];
  for (const from of pos.board[color]) {
    const piece = pos.board.get(from)!;
    if (attacks(piece, from, pos.board.occupied).has(target)) out.push(from);
  }
  return out;
}

const pieceAt = (pos: Chess, s: Square) => pos.board.get(s);
const roleAt = (pos: Chess, s: Square) => pos.board.get(s)?.role ?? 'piece';

/** "the knight from g1 to f3, taking the pawn on e5" (castling and promotion in words). */
export function describeMove(pos: Chess, move: NormalMove): string {
  const piece = pieceAt(pos, move.from);
  if (!piece) return `a move to ${sq(move.to)}`;
  const target = pieceAt(pos, move.to);
  if (piece.role === 'king' && target?.color === piece.color) {
    return move.to > move.from ? 'castling on the king side (the king goes to safety)' : 'castling on the queen side';
  }
  const captured = target
    ? `, taking the ${target.role} on ${sq(move.to)}`
    : piece.role === 'pawn' && sq(move.from)[0] !== sq(move.to)[0]
      ? ', taking a pawn en passant'
      : '';
  const promo = move.promotion ? ` and becoming a ${move.promotion}` : '';
  return `the ${piece.role} from ${sq(move.from)} to ${sq(move.to)}${captured}${promo}`;
}

/** color's pieces that are attacked and either undefended or attacked by something cheaper. */
export function loosePieces(pos: Chess, color: Color): { square: Square; role: Role; defended: boolean }[] {
  const out: { square: Square; role: Role; defended: boolean }[] = [];
  for (const s of pos.board[color]) {
    const role = roleAt(pos, s) as Role;
    if (role === 'king') continue;
    const attackers = attackersOf(pos, s, opposite(color));
    if (!attackers.length) continue;
    const defenders = attackersOf(pos, s, color);
    const cheapest = Math.min(...attackers.map((a) => VALUE[roleAt(pos, a) as Role]));
    if (!defenders.length || cheapest < VALUE[role]) out.push({ square: s, role, defended: defenders.length > 0 });
  }
  return out.sort((a, b) => VALUE[b.role] - VALUE[a.role]);
}

/** What the piece standing on s attacks that matters: the king, pieces worth more, or anything undefended. */
export function targetsOf(pos: Chess, s: Square): { square: Square; role: Role }[] {
  const piece = pieceAt(pos, s);
  if (!piece) return [];
  const out: { square: Square; role: Role }[] = [];
  for (const t of attacks(piece, s, pos.board.occupied).intersect(pos.board[opposite(piece.color)])) {
    const role = roleAt(pos, t) as Role;
    const undefended = attackersOf(pos, t, opposite(piece.color)).length === 0;
    if (role === 'king' || VALUE[role] > VALUE[piece.role] || undefended) out.push({ square: t, role });
  }
  return out.sort((a, b) => VALUE[b.role] - VALUE[a.role]);
}

/** An enemy piece pinned to its king by the slider on s. */
export function pinBy(pos: Chess, s: Square): { square: Square; role: Role } | undefined {
  const piece = pieceAt(pos, s);
  if (!piece || !['bishop', 'rook', 'queen'].includes(piece.role)) return undefined;
  const king = pos.board.kingOf(opposite(piece.color));
  if (king === undefined || !attacks(piece, s, SquareSet.empty()).has(king)) return undefined;
  const between = attacks(piece, s, pos.board.occupied).intersect(pos.board[opposite(piece.color)]);
  for (const t of between) {
    const role = roleAt(pos, t) as Role;
    if (role === 'king') continue;
    // t is pinned if removing it lets the slider see the king.
    if (attacks(piece, s, pos.board.occupied.without(t)).has(king)) return { square: t, role };
  }
  return undefined;
}

/** The student's winning chances (0..1) from an evaluation of a position. */
export function chancesFor(info: EngineInfo, color: Color): number {
  const w = whiteChances(info);
  return color === 'white' ? w : 1 - w;
}

const ORDER: Grade[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];
const worse = (a: Grade, b: Grade): Grade => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

/** A score for color in centipawns; mate in n counts as 10000 - n (negative when color is mated). */
export function povScore(info: EngineInfo, color: Color): number {
  const s = info.mate !== undefined ? (info.mate > 0 ? 10000 - info.mate : -10000 - info.mate) : (info.cp ?? 0);
  return color === 'white' ? s : -s;
}

/**
 * How good a move was. The drop in winning chances (Lichess-like steps) misses
 * one thing a coach must catch: throwing away an easy win while staying ahead.
 * So a big loss of advantage, or missing a short forced mate, is a mistake or
 * a blunder even when the position is still fine.
 */
export function gradeMove(before: EngineInfo, after: EngineInfo, color: Color, played: NormalMove, pos: Chess): Grade {
  const best = before.pv[0] ? uciToMove(before.pv[0]) : undefined;
  if (best && pos.isLegal(best) && sanOf(pos, best) === sanOf(pos, played)) return 'best';
  const drop = chancesFor(before, color) - chancesFor(after, color);
  let g: Grade = drop < 0.03 ? 'good' : drop < 0.07 ? 'inaccuracy' : drop < 0.14 ? 'mistake' : 'blunder';
  const b = povScore(before, color);
  const a = povScore(after, color);
  // Missing a mate in 1, 2 or 3.
  if (b >= 9997 && a < 9000) g = worse(g, 'blunder');
  // Long mates and huge advantages count the same (1500), so winning endgames aren't nitpicked.
  const clamp = (x: number) => Math.max(-1500, Math.min(1500, x));
  const loss = clamp(b) - clamp(a);
  if (loss >= 500) g = worse(g, a >= 500 ? 'mistake' : 'blunder');
  else if (loss >= 250) g = worse(g, 'mistake');
  else if (loss >= 120) g = worse(g, 'inaccuracy');
  return g;
}

/** What playing the engine's line achieves for color: a mate, or the material it wins. */
function lineGain(pos: Chess, info: EngineInfo, color: Color): string | undefined {
  if (info.mate !== undefined && (info.mate > 0) === (color === 'white') && Math.abs(info.mate) <= 5) return `it gives checkmate in ${Math.abs(info.mate)}`;
  const p = pos.clone();
  const value = (c: Color) => (['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[]).reduce((n, r) => n + p.board.pieces(c, r).size() * VALUE[r], 0);
  const start = value(color) - value(opposite(color));
  let biggest: Role | undefined;
  for (const uci of info.pv.slice(0, 5)) {
    const m = uciToMove(uci);
    if (!m || !p.isLegal(m)) break;
    const taken = p.board.get(m.to);
    if (taken && taken.color !== p.turn && p.turn === color && (!biggest || VALUE[taken.role] > VALUE[biggest])) biggest = taken.role;
    p.play(m);
  }
  const gain = value(color) - value(opposite(color)) - start;
  if (gain >= 3) return `it wins material${biggest ? ` (the ${biggest})` : ''}`;
  return undefined;
}

const GRADE_TEXT: Record<Grade, string> = {
  best: 'This is the best move here.',
  good: 'This is a good move.',
  inaccuracy: 'This move is a small slip (an inaccuracy): there was something better.',
  mistake: 'This move is a mistake.',
  blunder: 'This move is a big mistake (a blunder).',
};

function standing(info: EngineInfo, color: Color): string {
  if (info.mate !== undefined) {
    const mine = (info.mate > 0) === (color === 'white');
    return mine ? `The student can force checkmate in ${Math.abs(info.mate)}.` : `The opponent can force checkmate in ${Math.abs(info.mate)}.`;
  }
  const c = chancesFor(info, color);
  if (c > 0.8) return 'The student is winning.';
  if (c > 0.6) return 'The student is better.';
  if (c >= 0.4) return 'The position is about equal.';
  if (c >= 0.2) return 'The opponent is better.';
  return 'The opponent is winning.';
}

class Builder {
  facts: string[] = [];
  arrows: Arrow[] = [];
  focus?: { square: string; piece: string };
  add(f: string) {
    if (f && !this.facts.includes(f)) this.facts.push(f);
  }
  arrow(move: NormalMove, brush: Arrow['brush'], label: string) {
    const id = `A${this.arrows.length + 1}`;
    this.arrows.push({ id, from: sq(move.from), to: sq(move.to), brush, label });
    return id;
  }
  done(grade?: Grade): Facts {
    const text = [...this.facts, ...this.arrows.map((a) => a.label + ` ${a.from} ${a.to}`)].join(' ');
    const squares = [...new Set(text.match(/\b[a-h][1-8]\b/g) ?? [])];
    return { facts: this.facts, arrows: this.arrows, squares, grade, focus: this.focus };
  }
}

/** Tactics the piece that just moved to s creates. */
function tacticsFrom(pos: Chess, s: Square, who: string, b: Builder) {
  const targets = targetsOf(pos, s);
  const piece = pieceAt(pos, s);
  if (!piece) return;
  if (targets.length >= 2) {
    b.add(
      targets[0].role === targets[1].role
        ? `${who} ${piece.role} on ${sq(s)} attacks both ${targets[0].role}s, on ${sq(targets[0].square)} and ${sq(targets[1].square)}, at the same time.`
        : `${who} ${piece.role} on ${sq(s)} attacks the ${targets[0].role} on ${sq(targets[0].square)} and the ${targets[1].role} on ${sq(targets[1].square)} at the same time: a fork.`);
  } else if (targets.length === 1 && targets[0].role !== 'king' && targets[0].role !== 'pawn') {
    b.add(`${who} ${piece.role} on ${sq(s)} attacks the ${targets[0].role} on ${sq(targets[0].square)}.`);
  }
  const pin = pinBy(pos, s);
  if (pin) b.add(`${who} ${piece.role} on ${sq(s)} pins the ${pin.role} on ${sq(pin.square)} to its king: that ${pin.role} cannot move away.`);
}

/**
 * Facts about the student's move. before/after are full evaluations of the
 * position before the move (student to move) and after it (opponent to move).
 */
export function moveFacts(pos: Chess, move: NormalMove, before?: EngineInfo, after?: EngineInfo): Facts {
  const b = new Builder();
  const me = pos.turn;
  const them = opposite(me);
  const next = pos.clone();
  next.play(move);
  b.add(`The student plays ${side(me)} and played ${describeMove(pos, move)}.`);
  if (next.isCheckmate()) {
    b.add('It is checkmate! The student wins.');
    return b.done('best');
  }
  if (next.isStalemate()) b.add('It is stalemate: the opponent has no legal move but is not in check, so the game is a draw.');
  else if (next.isCheck()) b.add('It gives check.');

  const grade = before && after ? gradeMove(before, after, me, move, pos) : undefined;
  if (grade) b.add(GRADE_TEXT[grade]);
  const to = pieceAt(next, move.to) ? move.to : undefined;
  if (to !== undefined) tacticsFrom(next, to, "The student's", b);

  // What the opponent can do now.
  const reply = after?.pv[0] ? uciToMove(after.pv[0]) : undefined;
  if (reply && next.isLegal(reply) && grade && grade !== 'best' && grade !== 'good') {
    const after2 = next.clone();
    after2.play(reply);
    const mate = after2.isCheckmate();
    b.add(`Now ${side(them)} can play ${describeMove(next, reply)}${mate ? ', and that is checkmate' : after2.isCheck() ? ', giving check' : ''}.`);
    b.arrow(reply, 'red', `${side(them)}'s threat: ${roleAt(next, reply.from)} ${sq(reply.from)} to ${sq(reply.to)}`);
    const target = pieceAt(next, reply.to);
    b.focus = { square: sq(reply.from), piece: roleAt(next, reply.from) };
    if (target) b.focus = { square: sq(reply.to), piece: target.role };
    if (pieceAt(after2, reply.to)) tacticsFrom(after2, reply.to, `${side(them)}'s`, b);
  }
  for (const l of loosePieces(next, me).slice(0, 2)) {
    b.add(`The student's ${l.role} on ${sq(l.square)} is attacked and ${l.defended ? 'not defended enough' : 'not defended'}.`);
    b.focus ??= { square: sq(l.square), piece: l.role };
  }
  for (const l of loosePieces(next, them).slice(0, 1)) {
    if (grade === 'best' || grade === 'good') b.add(`${side(them)}'s ${l.role} on ${sq(l.square)} is attacked and ${l.defended ? 'not defended enough' : 'not defended'}.`);
  }

  // A missed chance: the student is fine, but threw away something big.
  if (before && after && (grade === 'mistake' || grade === 'blunder') && povScore(after, me) >= -150) {
    const what = lineGain(pos, before, me);
    if (what) b.add(`There was a much stronger move: ${what}. The student missed it; ask them to look for it again.`);
  }

  // The better move, for mistakes.
  const best = before?.pv[0] ? uciToMove(before.pv[0]) : undefined;
  if (best && pos.isLegal(best) && grade && grade !== 'best' && grade !== 'good') {
    b.add(`A better move was ${describeMove(pos, best)}.`);
    b.arrow(best, 'green', `Better: ${roleAt(pos, best.from)} ${sq(best.from)} to ${sq(best.to)}`);
    const p2 = pos.clone();
    p2.play(best);
    if (pieceAt(p2, best.to)) tacticsFrom(p2, best.to, 'That', b);
  }
  if (after) b.add(standing(after, me));
  return b.done(grade);
}

/**
 * Facts about the opponent's reply: what it does, whether it was the best
 * reply (and if not, what was), and what it threatens now.
 * before: evaluation with the opponent to move; after: with the student to move.
 */
export function replyFacts(pos: Chess, reply: NormalMove, before?: EngineInfo, after?: EngineInfo): Facts {
  const b = new Builder();
  const them = pos.turn;
  const me = opposite(them);
  const next = pos.clone();
  next.play(reply);
  b.add(`${side(them)} replied ${describeMove(pos, reply)}${next.isCheckmate() ? ', and it is checkmate' : next.isCheck() ? ', giving check' : ''}.`);
  if (before && after) {
    const best = before.pv[0] ? uciToMove(before.pv[0]) : undefined;
    const grade = gradeMove(before, after, them, reply, pos);
    if (grade === 'best') b.add(`This is ${side(them)}'s best reply.`);
    else if (grade === 'good') b.add(`This is a good reply by ${side(them)}.`);
    else {
      b.add(`This reply is a ${grade === 'inaccuracy' ? 'small slip' : 'mistake'} by ${side(them)}: the student now has a chance. Do not tell the student which move to play.`);
      if (best && pos.isLegal(best)) b.add(`${side(them)}'s best reply was ${describeMove(pos, best)}.`);
    }
  }
  const to = pieceAt(next, reply.to) ? reply.to : undefined;
  if (to !== undefined) tacticsFrom(next, to, `${side(them)}'s`, b);
  for (const l of loosePieces(next, me).slice(0, 2)) {
    b.add(`The student's ${l.role} on ${sq(l.square)} is attacked and ${l.defended ? 'not defended enough' : 'not defended'}.`);
    b.focus ??= { square: sq(l.square), piece: l.role };
  }
  if (after) b.add(standing(after, me));
  return b.done();
}

/** One set of facts from several (arrow ids renumbered, squares merged). */
export function mergeFacts(...parts: Facts[]): Facts {
  const arrows: Arrow[] = [];
  for (const p of parts) for (const a of p.arrows) arrows.push({ ...a, id: `A${arrows.length + 1}` });
  return {
    facts: parts.flatMap((p) => p.facts),
    arrows,
    squares: [...new Set(parts.flatMap((p) => p.squares))],
    grade: parts[0]?.grade,
    focus: parts.find((p) => p.focus)?.focus,
  };
}

/** Facts about a position the student is looking at (for hints and questions). */
export function positionFacts(pos: Chess, info?: EngineInfo, hintLevel = 0): Facts {
  const b = new Builder();
  const me = pos.turn;
  b.add(`It is ${side(me)}'s turn; the student plays ${side(me)}.`);
  if (pos.isCheck()) b.add(`${side(me)}'s king is in check.`);
  for (const l of loosePieces(pos, me).slice(0, 2)) {
    b.add(`The student's ${l.role} on ${sq(l.square)} is attacked and ${l.defended ? 'not defended enough' : 'not defended'}.`);
    b.focus ??= { square: sq(l.square), piece: l.role };
  }
  for (const l of loosePieces(pos, opposite(me)).slice(0, 2)) b.add(`The opponent's ${l.role} on ${sq(l.square)} can be attacked: it is ${l.defended ? 'not defended enough' : 'not defended'}.`);
  const best = info?.pv[0] ? uciToMove(info.pv[0]) : undefined;
  if (best && pos.isLegal(best)) {
    const piece = roleAt(pos, best.from);
    b.focus = { square: sq(best.from), piece };
    if (hintLevel >= 1) b.add(`The key piece is the ${piece} on ${sq(best.from)}.`);
    if (hintLevel >= 2) {
      b.add(`The best move is ${describeMove(pos, best)}.`);
      b.arrow(best, 'green', `Best: ${piece} ${sq(best.from)} to ${sq(best.to)}`);
      const p2 = pos.clone();
      p2.play(best);
      if (p2.isCheckmate()) b.add('That move is checkmate.');
      else if (pieceAt(p2, best.to)) tacticsFrom(p2, best.to, 'That', b);
    }
  }
  // depth 0 = a lesson's known answer, not a real evaluation.
  if (info && info.depth > 0) b.add(standing(info, me));
  return b.done();
}

// ── Opening and positional ideas ──

const CENTRE = ['d4', 'e4', 'd5', 'e5'];
const fileOf = (s: Square) => s & 7;
const rankOf = (s: Square) => s >> 3;
const relRank = (s: Square, c: Color) => (c === 'white' ? rankOf(s) : 7 - rankOf(s));
const parseSq = (name: string): Square => name.charCodeAt(0) - 97 + (Number(name[1]) - 1) * 8;
const HOME: Partial<Record<Role, string[]>> = { knight: ['b1', 'g1', 'b8', 'g8'], bishop: ['c1', 'f1', 'c8', 'f8'] };

/** Whether color could castle now if nothing else stopped it (rights kept, squares between empty). */
function castleReady(p: Chess, color: Color): boolean {
  const k = p.board.kingOf(color);
  if (k === undefined) return false;
  for (const r of p.board.pieces(color, 'rook')) {
    if (rankOf(r) !== rankOf(k) || !p.castles.castlingRights.has(r)) continue;
    let empty = true;
    for (let s = Math.min(r, k) + 1; s < Math.max(r, k); s++) if (p.board.occupied.has(s)) empty = false;
    if (empty) return true;
  }
  return false;
}

/** Why an opening move is played: development, centre, castling, lines, gambits (as notes for explain.ts). */
export function openingNotes(pos: Chess, move: NormalMove): Note[] {
  const out: Note[] = [];
  const me = pos.turn;
  const piece = pos.board.get(move.from);
  if (!piece) return out;
  const target = pos.board.get(move.to);
  if (piece.role === 'king' && target?.color === me) return [{ k: 'castles' }];
  const next = pos.clone();
  next.play(move);
  const to = sq(move.to);
  if (HOME[piece.role]?.includes(sq(move.from))) out.push({ k: 'develop', piece: piece.role });
  const seen = attacks(piece, move.to, next.board.occupied);
  if (target) out.push({ k: 'capture', piece: target.role, square: to });
  const centre = CENTRE.filter((c) => c === to || seen.has(parseSq(c)));
  if (centre.includes(to)) out.push({ k: 'occupyCentre', squares: to });
  else if (centre.length) out.push({ k: 'controlCentre', squares: centre.join(', ') });
  if (piece.role === 'pawn') {
    for (const s of next.board[me]) {
      const p = next.board.get(s)!;
      if (p.role !== 'bishop' && p.role !== 'queen') continue;
      if (attacks(p, s, next.board.occupied).size() - attacks(p, s, pos.board.occupied).size() >= 2) out.push({ k: 'opensLine', piece: p.role, square: sq(s) });
    }
    if (relRank(move.to, me) >= 4) out.push({ k: 'space' });
    if ([...seen.intersect(next.board[opposite(me)])].some((s) => next.board.get(s)!.role === 'pawn')) out.push({ k: 'challenge' });
    if (!target && attackersOf(next, move.to, opposite(me)).length > attackersOf(next, move.to, me).length) out.push({ k: 'gambit' });
  }
  if (piece.role === 'bishop' && ['g2', 'b2', 'g7', 'b7'].includes(to)) out.push({ k: 'fianchetto' });
  if (!castleReady(pos, me) && castleReady(next, me)) out.push({ k: 'castleReady' });
  const pin = pinBy(next, move.to);
  if (pin) out.push({ k: 'pins', piece: pin.role, square: sq(pin.square) });
  const t = targetsOf(next, move.to).filter((x) => x.role !== 'king');
  if (t.length >= 2) out.push({ k: 'fork', piece: piece.role, square: to, a: t[0].role, b: t[1].role });
  else if (t.length === 1 && !pin) out.push({ k: 'attacks', piece: t[0].role, square: sq(t[0].square) });
  if (next.isCheckmate()) out.push({ k: 'mate' });
  else if (next.isCheck()) out.push({ k: 'check' });
  return out;
}

/** Notable positional features: pawn structure, open files, outposts, bad bishops, space, king safety. */
export function positionThemes(pos: Chess, color: Color): string[] {
  const out: string[] = [];
  const them = opposite(color);
  const who = (c: Color) => (c === color ? "The student's" : "The opponent's");
  const pawns = (c: Color) => [...pos.board.pieces(c, 'pawn')];
  const files = (c: Color) => pawns(c).map(fileOf);
  for (const c of [color, them]) {
    const fs = files(c);
    for (const p of pawns(c)) {
      const f = fileOf(p);
      const blockers = pawns(opposite(c)).some((e) => Math.abs(fileOf(e) - f) <= 1 && relRank(e, c) > relRank(p, c));
      if (!blockers && relRank(p, c) >= 3) out.push(`${who(c)} pawn on ${sq(p)} is a passed pawn: no enemy pawn can stop it.`);
      else if (!fs.includes(f - 1) && !fs.includes(f + 1) && (f === 3 || f === 4)) out.push(`${who(c)} pawn on ${sq(p)} is isolated: no friendly pawn can protect it.`);
    }
    const doubled = [...new Set(fs.filter((f, i) => fs.indexOf(f) !== i))];
    if (doubled.length) out.push(`${who(c)} pawns on the ${'abcdefgh'[doubled[0]]}-file are doubled.`);
  }
  for (const s of pos.board.pieces(color, 'rook')) {
    const f = fileOf(s);
    if (!files(color).includes(f) && !files(them).includes(f)) out.push(`The student's rook on ${sq(s)} stands on an open file.`);
    if (relRank(s, color) === 6) out.push(`The student's rook on ${sq(s)} is on the 7th rank.`);
  }
  for (const s of pos.board.pieces(color, 'knight')) {
    if (relRank(s, color) < 4) continue;
    const backed = attackersOf(pos, s, color).some((a) => pos.board.get(a)?.role === 'pawn');
    const chasable = pawns(them).some((e) => Math.abs(fileOf(e) - fileOf(s)) === 1 && relRank(e, color) > relRank(s, color));
    if (backed && !chasable) out.push(`The student's knight on ${sq(s)} sits on an outpost: no enemy pawn can chase it away.`);
  }
  for (const c of [color, them]) {
    for (const s of pos.board.pieces(c, 'bishop')) {
      const light = (fileOf(s) + rankOf(s)) % 2 === 1;
      const blocked = pawns(c).filter((p) => ((fileOf(p) + rankOf(p)) % 2 === 1) === light && relRank(p, c) >= 2).length;
      if (blocked >= 4) out.push(`${who(c)} bishop on ${sq(s)} is a "bad" bishop: its own pawns stand on its colour and block it.`);
    }
  }
  const space = (c: Color) => {
    let n = 0;
    for (const s of pos.board[c]) {
      const p = pos.board.get(s)!;
      if (p.role === 'king') continue;
      for (const t of attacks(p, s, pos.board.occupied)) if (relRank(t, c) >= 4) n++;
    }
    return n;
  };
  const sm = space(color);
  const st = space(them);
  if (sm >= st + 6) out.push("The student has more space: more pieces reach into the opponent's half.");
  else if (st >= sm + 6) out.push('The opponent has more space.');
  for (const c of [color, them]) {
    const k = pos.board.kingOf(c);
    if (k === undefined || relRank(k, c) > 1 || pos.board.occupied.size() <= 16) continue;
    const shield = pawns(c).filter((p) => Math.abs(fileOf(p) - fileOf(k)) <= 1 && relRank(p, c) - relRank(k, c) >= 1 && relRank(p, c) - relRank(k, c) <= 2).length;
    if (shield <= 1) out.push(`${who(c)} king has few pawns in front of it: it may be unsafe.`);
  }
  return out.slice(0, 5);
}

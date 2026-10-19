import { describe, expect, it } from 'vitest';
import { parseSquare } from 'chessops/util';
import { fenOf, playSans, positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
import type { EngineInfo } from '$lib/engine/stockfish';
import type { BookSource } from '$lib/book/book';
import { CATALOG } from './catalog';
import { buildCourse, COURSES } from './content/openings';
import { LEGENDS } from './content/legends';
import { describeMove, loosePieces, moveFacts, pinBy, positionFacts, targetsOf } from './facts';
import type { L10n } from './i18n';
import { classify, reviewLesson, type GameReview } from './review';
import { SECTIONS, type Lesson } from './types';

/** No network in tests: an empty opening book. */
const noBook = { entries: async () => [], prefetch: () => {} } as unknown as BookSource & ConstructorParameters<typeof Object>[0];

function checkText(t: L10n, where: string) {
  for (const l of ['en', 'hi', 'mr'] as const) expect(t[l]?.trim(), `${where} (${l})`).toBeTruthy();
  // Chess words stay English: no regional names for the pieces.
  expect(t.hi + t.mr, where).not.toMatch(/घोड|हत्ती|हाथी|ऊँट|उंट|प्याद|मोहर|राणी|रानी/);
}

/** Every slide: a legal position, legal moves played out, a legal practice position, text in all languages. */
function checkLesson(lesson: Lesson) {
  expect(lesson.slides.length, lesson.id).toBeGreaterThan(0);
  lesson.slides.forEach((s, i) => {
    const where = `${lesson.id} slide ${i + 1}`;
    const pos = positionFromFen(s.fen);
    for (const u of s.moves ?? []) {
      const m = uciToMove(u);
      expect(m && pos.isLegal(m), `${where}: ${u}`).toBe(true);
      pos.play(m!);
    }
    checkText(s.text, where);
    if (s.practice && s.practice.fen) expect(positionFromFen(s.practice.fen).isEnd(), `${where} practice`).toBe(false);
    for (const sq of [...(s.marks ?? []), ...(s.arrows ?? []).flatMap((a) => [a.from, a.to])]) expect(parseSquare(sq), `${where}: ${sq}`).toBeDefined();
  });
}

describe('the coach catalogue', () => {
  it('has unique ids, known sections, and lessons in every category', () => {
    expect(new Set(CATALOG.map((l) => l.id)).size).toBe(CATALOG.length);
    for (const l of CATALOG) expect(SECTIONS[l.category], l.id).toContain(l.section);
    for (const c of ['opening', 'middlegame', 'endgame'] as const) expect(CATALOG.filter((l) => l.category === c).length).toBeGreaterThanOrEqual(15);
  });

  it('builds every non-opening lesson with legal positions and complete texts', async () => {
    for (const entry of CATALOG.filter((l) => !COURSES.some((c) => c.id === l.id))) checkLesson(await entry.load());
  });

  it('builds every opening course from a legal main line', async () => {
    for (const c of COURSES) {
      const lesson = await buildCourse(c, noBook as never);
      checkLesson(lesson);
      // Intro, one slide per move, and the practice slide at the end.
      expect(lesson.slides.length).toBe(c.line.split(' ').length + 2);
    }
  });

  it('knows every legend it names', async () => {
    for (const entry of CATALOG) for (const l of entry.legends ?? []) expect(LEGENDS[l], `${entry.id}: ${l}`).toBeDefined();
  });
});

describe('game review', () => {
  it('turns an analysis into slides: summary, opening, mistakes with better moves, the end', () => {
    const uci = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f3e5', 'c6e5'];
    const game = { id: 'g1', playedAt: 0, kind: 'computer' as const, white: 'You', black: 'Computer', userSide: 'white' as const, result: '0-1', reason: '', timeControl: '', startFen: fenOf(playSans('')), uci };
    const before = fenOf(playSans('e4 e5 Nf3 Nc6'));
    const info = (cp: number, pv: string[]): EngineInfo => ({ fen: before, depth: 11, cp, pv });
    const review: GameReview = {
      accuracy: 61,
      counts: { best: 2, good: 0, inaccuracy: 0, mistake: 0, blunder: 1 },
      opening: { eco: 'C44', name: "King's Knight Opening: Normal Variation", plies: 4 },
      moves: [{ ply: 4, san: 'Nxe5', move: uciToMove('f3e5')!, color: 'white', grade: 'blunder', cls: 'blunder', drop: 0.3, before: info(40, ['f1b5']), after: info(-300, ['c6e5']), fenBefore: before }],
      all: [],
      sides: { white: { accuracy: 61, classes: { brilliant: 0, only: 0, best: 2, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 1 } }, black: { accuracy: 90, classes: { brilliant: 0, only: 0, best: 3, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0 } } },
      fens: [],
    };
    const lesson = reviewLesson(game, review);
    checkLesson(lesson);
    expect(lesson.slides[0].text.en).toContain('You lost this game');
    expect(lesson.slides[0].text.en).toContain('accuracy was 61%');
    expect(lesson.slides.some((s) => s.text.en.startsWith('Move 3: you played Nxe5. That was a blunder.'))).toBe(true);
    expect(lesson.slides.some((s) => s.text.en.startsWith('Better was: White plays bishop to b5.'))).toBe(true);
  });
});

const info = (fen: string, cp: number, pv: string[], mate?: number): EngineInfo => ({ fen, depth: 12, cp: mate === undefined ? cp : undefined, mate, pv });

describe('review badges', () => {
  const base = { book: false, drop: 0, color: 'white' as const };
  it('a queen sacrifice that wins is brilliant; a plain exchange is not', () => {
    // Légal's mate idea: 7.Nxe5! gives the queen (Bxd1) for a mating attack.
    const pos = playSans('e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6');
    const f = fenOf(pos);
    const before = info(f, 250, ['f3e5']);
    const after = info(fenOf(playSans('e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5')), 250, ['g4d1', 'c4f7', 'e8e7', 'c3d5']);
    expect(classify({ ...base, pos, move: uciToMove('f3e5')!, before, after, grade: 'best' })).toBe('brilliant');
    // An even trade: Nxd5, exd5 … material comes back.
    const p2 = playSans('d4 d5 c4 Nf6 Nc3 e6 cxd5');
    const ex = info(fenOf(p2), 0, ['e6d5']);
    expect(classify({ ...base, color: 'black', pos: p2, move: uciToMove('e6d5')!, before: ex, after: info(fenOf(p2), 0, ['c1g5', 'f8e7', 'e2e3']), grade: 'best' })).toBe('best');
  });

  it('the only move that holds, book moves, and the grades', () => {
    const pos = playSans('e4 e5 Nf3 Nc6');
    const f = fenOf(pos);
    const before = { ...info(f, 30, ['f1b5']), second: info(f, -400, ['a2a3']) };
    expect(classify({ ...base, pos, move: uciToMove('f1b5')!, before, after: info(f, 30, ['a7a6']), grade: 'best' })).toBe('only');
    expect(classify({ ...base, pos, move: uciToMove('f1b5')!, before, after: info(f, 30, ['a7a6']), grade: 'best', book: true })).toBe('book');
    expect(classify({ ...base, pos, move: uciToMove('f1c4')!, before, after: info(f, 25, ['f8c5']), grade: 'good', drop: 0.005 })).toBe('excellent');
    expect(classify({ ...base, pos, move: uciToMove('a2a3')!, before, after: info(f, -400, []), grade: 'blunder', drop: 0.4, book: true })).toBe('blunder');
  });

  it('a missed win is not a blunder: still winning, or a slip not punished; losing the win is', () => {
    const pos = playSans('e4 e5 Nf3 Nc6');
    const f = fenOf(pos);
    const move = uciToMove('a2a3')!;
    // Mate in 2 missed, still five pawns up.
    expect(classify({ ...base, pos, move, before: info(f, 0, ['f3g5'], 2), after: info(f, 500, []), grade: 'blunder', drop: 0.14 })).toBe('miss');
    // The opponent hung a piece (+0.2 to +4), the move did not take it: back to +0.2.
    expect(classify({ ...base, pos, move, prevBefore: info(f, 20, []), before: info(f, 400, ['f3e5']), after: info(f, 20, []), grade: 'blunder', drop: 0.3 })).toBe('miss');
    // Four pawns up, and the move hangs a piece of its own: a blunder.
    expect(classify({ ...base, pos, move, prevBefore: info(f, 400, []), before: info(f, 400, ['f3e5']), after: info(f, 20, []), grade: 'blunder', drop: 0.3 })).toBe('blunder');
    // Winning, and now losing: a blunder.
    expect(classify({ ...base, pos, move, prevBefore: info(f, 20, []), before: info(f, 400, ['f3e5']), after: info(f, -300, []), grade: 'blunder', drop: 0.6 })).toBe('blunder');
    // Black's view: Black was winning (-5) and is still winning (-2.5).
    expect(classify({ ...base, color: 'black', pos, move, before: info(f, -500, []), after: info(f, -250, []), grade: 'mistake', drop: 0.15 })).toBe('miss');
  });
});

describe('the facts', () => {
  it('describe moves in words', () => {
    const pos = playSans('e4 e5 Nf3 Nc6 Bc4 Bc5');
    expect(describeMove(pos, uciToMove('e1h1')!)).toContain('castling on the king side');
    expect(describeMove(playSans('e4 d5'), uciToMove('e4d5')!)).toBe('the pawn from e4 to d5, taking the pawn on d5');
  });

  it('find forks, pins and loose pieces', () => {
    // Knight on c7 forks the king on e8 and the rook on a8.
    const fork = positionFromFen('r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1');
    expect(targetsOf(fork, parseSquare('c7')!).map((t) => t.role)).toEqual(['king', 'rook']);
    // Bishop on b5 pins the knight on c6 to the king on e8.
    const pin = positionFromFen('4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1');
    expect(pinBy(pin, parseSquare('b5')!)).toEqual({ square: parseSquare('c6'), role: 'knight' });
    expect(loosePieces(pin, 'black').map((l) => l.role)).toEqual(['knight']);
  });

  it('explain a blunder with the threat, the better move and arrows', () => {
    // Italian Game: 4.Nxe5?? Qg5 forks the knight and g2 (Black played Nd4).
    const pos = playSans('e4 e5 Nf3 Nc6 Bc4 Nd4');
    const move = uciToMove('f3e5')!;
    expect(sanOf(pos, move)).toBe('Nxe5');
    const before = info(fenOf(pos), 30, ['f3d4']);
    const next = pos.clone();
    next.play(move);
    // Scores are from White's side: Black is now winning.
    const after = info(fenOf(next), -250, ['d8g5']);
    const f = moveFacts(pos, move, before, after);
    expect(f.grade).toBe('blunder');
    const all = f.facts.join(' ');
    expect(all).toContain('the queen from d8 to g5');
    expect(all).toContain('a fork');
    expect(all).toContain('A better move was the knight from f3 to d4, taking the knight on d4');
    expect(f.arrows.map((a) => [a.brush, a.from, a.to])).toEqual([
      ['red', 'd8', 'g5'],
      ['green', 'f3', 'd4'],
    ]);
    expect(f.squares).toEqual(expect.arrayContaining(['f3', 'e5', 'd8', 'g5', 'g2', 'd4']));
  });

  it('call a mate a mate and give hints step by step', () => {
    const pos = positionFromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    const mate = moveFacts(pos, uciToMove('a1a8')!);
    expect(mate.facts.join(' ')).toContain('checkmate');
    const e = info(fenOf(pos), 0, ['a1a8'], 1);
    expect(positionFacts(pos, e, 0).facts.join(' ')).not.toContain('a8');
    expect(positionFacts(pos, e, 1).facts.join(' ')).toContain('The key piece is the rook on a1');
    const h2 = positionFacts(pos, e, 2);
    expect(h2.facts.join(' ')).toContain('That move is checkmate');
    expect(h2.arrows[0]).toMatchObject({ from: 'a1', to: 'a8', brush: 'green' });
  });
});

describe('the voice', () => {
  it('spells chess words and squares the way Indian students say them', async () => {
    const { forIndianVoice } = await import('./voice');
    expect(forIndianVoice('तुझा knight e4 वरून f6 वर ने, Checkmate!')).toBe('तुझा नाइट ई फोर वरून एफ सिक्स वर ने, चेकमेट!');
    expect(forIndianVoice('d-pawn, L shape, e4वर')).toBe('डी पॉन, एल शेप, ई फोरवर');
  });
});

describe('grading like a coach', () => {
  // White is a rook up and can take a loose queen with the rook.
  const pos = positionFromFen('4k3/8/8/3q4/8/8/3R4/R3K3 w - - 0 1');
  const quiet = uciToMove('e1f1')!;

  it('calls throwing away an easy win a mistake, and says what was missed', async () => {
    const { gradeMove, moveFacts } = await import('./facts');
    const before = info(fenOf(pos), 1200, ['d2d5']);
    const next = pos.clone();
    next.play(quiet);
    const after = info(fenOf(next), 600, ['d5d2']);
    expect(gradeMove(before, after, 'white', quiet, pos)).toBe('mistake');
    const f = moveFacts(pos, quiet, before, after);
    expect(f.facts.join(' ')).toContain('There was a much stronger move: it wins material (the queen)');
  });

  it('calls missing a short mate a blunder, but not a longer mate instead of a shorter one', async () => {
    const { gradeMove } = await import('./facts');
    const next = pos.clone();
    next.play(quiet);
    expect(gradeMove(info(fenOf(pos), 0, ['d2d5'], 2), info(fenOf(next), 300, ['d5d2']), 'white', quiet, pos)).toBe('blunder');
    expect(gradeMove(info(fenOf(pos), 0, ['d2d5'], 8), info(fenOf(next), 0, ['d5d2'], 10), 'white', quiet, pos)).toBe('good');
  });

  it("explains the opponent's reply: best or not, and what it attacks", async () => {
    const { replyFacts } = await import('./facts');
    const p = playSans('e4 e5 Nf3');
    const reply = uciToMove('b8c6')!;
    const next = p.clone();
    next.play(reply);
    const f = replyFacts(p, reply, info(fenOf(p), -30, ['b8c6']), info(fenOf(next), 30, ['f1b5']));
    expect(f.facts[0]).toBe('Black replied the knight from b8 to c6.');
    expect(f.facts).toContain("This is Black's best reply.");
    const weak = uciToMove('f7f6')!;
    const n2 = p.clone();
    n2.play(weak);
    const g = replyFacts(p, weak, info(fenOf(p), -30, ['b8c6']), info(fenOf(n2), 250, ['f3e5']));
    expect(g.facts.join(' ')).toContain('mistake by Black');
    expect(g.facts.join(' ')).toContain("Black's best reply was the knight from b8 to c6");
  });
});

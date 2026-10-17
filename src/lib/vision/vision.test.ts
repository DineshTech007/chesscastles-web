import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BlindPuzzle, describe as describePos, readMove, visionRatingAfter, type VisionPuzzle } from './vision';
import { playSans } from '$lib/chess/position';

describe('Vision Gym', () => {
  it('writes a position as text', () => {
    const [w, b] = describePos(playSans('e4 e5 Nf3'));
    expect(w.pieces).toBe('Ke1 Qd1 Ra1 Rh1 Bc1 Bf1 Nb1 Nf3');
    expect(w.pawns).toBe('a2 b2 c2 d2 e4 f2 g2 h2');
    expect(b.long.startsWith('King e8 · Queen d8 · Rooks a8, h8')).toBe(true);
  });

  it('reads typed moves forgivingly', () => {
    const p = playSans('e4 e5 Nf3 Nc6 Bc4 Nf6');
    expect(readMove(p, 'ng5')).toMatchObject({ to: 38 });
    expect(readMove(p, 'f3g5')).toMatchObject({ to: 38 });
    expect(readMove(p, '0-0')).toBeDefined();
    expect(readMove(p, 'Qh7')).toBeUndefined();
  });

  it('plays a puzzle from the bank: the right moves solve it, a wrong one fails', () => {
    const bank: VisionPuzzle[] = JSON.parse(readFileSync('static/data/vision.json', 'utf8'));
    expect(bank.length).toBeGreaterThan(2000);
    for (const p of bank.slice(0, 200)) {
      const solve = new BlindPuzzle(p);
      while (solve.status === 'solving') solve.answer(solve.san(solve.step));
      expect(solve.status).toBe('solved');
    }
    const fail = new BlindPuzzle(bank[0]);
    const legal = fail.positionAt(1);
    const wrong = [...legal.allDests()].flatMap(([f, ds]) => [...ds].map((t) => ({ from: f, to: t }))).find((m) => m.from !== fail.moves[1].from || m.to !== fail.moves[1].to)!;
    const after = legal.clone();
    after.play(wrong);
    if (!after.isCheckmate()) {
      expect(fail.answer(`${'abcdefgh'[wrong.from & 7]}${(wrong.from >> 3) + 1}${'abcdefgh'[wrong.to & 7]}${(wrong.to >> 3) + 1}`).ok).toBe(false);
      expect(fail.status).toBe('failed');
    }
  });

  it('rates like Elo', () => {
    expect(visionRatingAfter(1000, 0, 1000, true)).toBe(1020);
    expect(visionRatingAfter(1000, 30, 1400, false)).toBe(998);
  });
});

import { makeRound } from './memory';
import { seeded } from './sprint';

describe('Move Memory', () => {
  it('asks about the final position of a library line, with the right answer', () => {
    const rnd = seeded(5);
    const lines: [string, string][] = JSON.parse(readFileSync('static/data/openings.json', 'utf8')).map((r: string[]) => [r[1], r[2]]);
    let n = 0;
    for (const [name, line] of lines.filter(([, l]) => l.split(' ').length >= 12).slice(0, 300)) {
      const r = makeRound(name, line, 12, rnd);
      if (!r) continue;
      n++;
      const q = r.question;
      if (q.kind === 'where') {
        const p = r.final.board.get('abcdefgh'.indexOf(q.answer[0]) + 8 * (Number(q.answer[1]) - 1));
        expect(p?.role).toBe(q.role);
        expect(p?.color).toBe(q.color);
      }
    }
    expect(n).toBeGreaterThan(250);
    // A known line: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7: where is the knight from g1? f3.
    const ruy = makeRound('Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7', 10, () => 0.1);
    expect(ruy?.question).toMatchObject({ kind: 'where' });
  });
});

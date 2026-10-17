import { describe, expect, it } from 'vitest';
import { gradeSprint, knightDistance, sprintQuestion } from './sprint';

describe('Vision Sprint', () => {
  it('knows board geometry', () => {
    expect(knightDistance(1, 0, 2, 2)).toBe(1); // b1-c3
    expect(knightDistance(0, 0, 7, 7)).toBe(6); // a1-h8
    expect(knightDistance(0, 0, 1, 1)).toBe(4); // a1-b2
    expect(sprintQuestion(1, 0)).toEqual(sprintQuestion(1, 0));
  });

  it('asks right questions with right answers, the same for a seed', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const q = sprintQuestion(42, i);
      seen.add(q.kind);
      expect(q.options).toContain(q.answer);
      if (q.kind === 'color') {
        const [f, r] = [q.text.charCodeAt(3) - 97, Number(q.text[4]) - 1];
        expect(q.answer).toBe((f + r) % 2 === 1 ? 'Light' : 'Dark');
      }
    }
    expect(seen.size).toBe(5);
    const answers = Array.from({ length: 10 }, (_, i) => sprintQuestion(7, i).answer);
    expect(gradeSprint(7, answers)).toEqual({ score: 10, right: 10, wrong: 0 });
    expect(gradeSprint(7, ['nonsense', ...answers.slice(1)]).score).toBe(8);
  });
});

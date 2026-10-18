import { describe, expect, it } from 'vitest';
import { playSans } from '$lib/chess/position';
import { PLANS, STUDY_OPENINGS, studyOpening, studyTrainerId } from './openingStudy';

describe('opening study', () => {
  it('has the three openings, with legal lines', () => {
    expect(STUDY_OPENINGS.map((o) => o.id)).toEqual(['caro-kann', 'jobava-london', 'chebanenko']);
    for (const o of STUDY_OPENINGS) {
      const root = playSans(o.root);
      expect(root.fullmoves, o.id).toBeGreaterThan(1);
      for (const l of o.lines) {
        // playSans stops at the first illegal move: every move must be played.
        const words = l.sans.split(' ');
        let pos = playSans('');
        for (let i = 1; i <= words.length; i++) pos = playSans(words.slice(0, i).join(' '));
        expect(Math.ceil(words.length / 2), `${o.id} ${l.id}`).toBe(pos.fullmoves - (pos.turn === 'white' ? 1 : 0));
      }
    }
  });
  it('explains every line in every language', () => {
    for (const o of STUDY_OPENINGS) {
      const p = PLANS[o.id];
      expect(p.overview.en && p.overview.hi && p.overview.mr).toBeTruthy();
      for (const l of [...o.lines.map((x) => x.id), 'other']) {
        const lp = p.lines[l];
        expect(lp?.plans.length, `${o.id} ${l}`).toBeGreaterThan(0);
        for (const t of [...lp.plans, ...(lp.watch ? [lp.watch] : [])]) expect(t.en && t.hi && t.mr, `${o.id} ${l}`).toBeTruthy();
      }
    }
  });
  it('gives the trainer and the FIDE opponent each line', () => {
    const whole = studyOpening(studyTrainerId('caro-kann'));
    expect(whole).toMatchObject({ side: 'black', sans: 'e4 c6 d4 d5', study: 'caro-kann' });
    const line = studyOpening(studyTrainerId('jobava-london', 'c5'));
    expect(line).toMatchObject({ side: 'white', sans: 'd4 d5 Nc3 Nf6 Bf4 c5', name: 'Jobava London: 3...c5' });
    expect(studyOpening('st-chebanenko--nope')).toBeUndefined();
    expect(studyOpening('st-nothing')).toBeUndefined();
  });
});

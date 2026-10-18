import { describe, expect, it } from 'vitest';
import { playSans } from '$lib/chess/position';
import { curatedFor, planOf, PLANS, STUDY_OPENINGS, studyOpening, studyTrainerId } from './openingStudy';

describe('opening study', () => {
  it('has the three openings, with legal lines', () => {
    expect(STUDY_OPENINGS.map((o) => o.id)).toEqual(['caro-kann', 'jobava-london', 'chebanenko']);
    for (const o of STUDY_OPENINGS) {
      const root = playSans(o.root);
      expect(root.fullmoves, o.id).toBeGreaterThan(1);
      for (const l of [...o.curated, ...o.lines]) {
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
      // Every hand-picked line has written plans, itself or through its options.
      for (const c of o.curated) expect(planOf(o, c) || curatedFor(o, c).some((x) => planOf(o, x)), `${o.id} ${c.id}`).toBeTruthy();
      for (const l of [...new Set(o.curated.map((x) => x.plan ?? x.id).filter((id) => p.lines[id])), 'other']) {
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
    expect(line).toMatchObject({ side: 'white', sans: 'd4 d5 Nc3 Nf6 Bf4 c5', study: 'jobava-london' });
    expect(studyOpening(studyTrainerId('jobava-london', 'bf5-f3'))).toMatchObject({ sans: 'd4 d5 Nc3 Nf6 Bf4 Bf5 f3', study: 'jobava-london' });
    expect(studyOpening('st-chebanenko--nope')).toBeUndefined();
    expect(studyOpening('st-nothing')).toBeUndefined();
  });
});

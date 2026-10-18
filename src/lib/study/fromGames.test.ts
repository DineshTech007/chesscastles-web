import { describe, expect, it } from 'vitest';
import { parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';
import { positionFromFen, START_FEN } from '$lib/chess/position';
import type { ImportedGame } from '$lib/insights/games';
import { buildWeeklyPlan } from '$lib/insights/plan';
import type { Report } from '$lib/insights/report';
import { isWeak, studyLineOf, studyStats } from './fromGames';

function uciOf(sans: string): string[] {
  const pos = positionFromFen(START_FEN);
  return sans.split(' ').map((s) => {
    const m = parseSan(pos, s)!;
    pos.play(m);
    return makeUci(m);
  });
}
const game = (sans: string, userColor: 'white' | 'black', result: ImportedGame['result']): ImportedGame => ({
  url: `x/${Math.random()}`,
  site: 'chesscom',
  username: 'kid',
  endTime: 0,
  timeClass: 'rapid',
  baseSeconds: 600,
  increment: 0,
  white: 'a',
  black: 'b',
  result,
  userColor,
  uci: uciOf(sans),
  san: sans.split(' '),
  clocks: [],
});

describe('study lines in the player\'s own games', () => {
  it('finds the line by position, in any move order', () => {
    expect(studyLineOf(uciOf('e4 c6 d4 d5 e5 Bf5 Nf3 e6'), 'black')).toEqual({ opening: 'caro-kann', line: 'advance' });
    // 3.Nd2 instead of 3.Nc3 reaches the same Classical position.
    expect(studyLineOf(uciOf('e4 c6 d4 d5 Nd2 dxe4 Nxe4 Bf5 Ng3 Bg6'), 'black')).toEqual({ opening: 'caro-kann', line: 'classical' });
    // 1.d4 Nf6 2.Nc3 d5 3.Bf4 c5: the Jobava London 3...c5.
    expect(studyLineOf(uciOf('d4 Nf6 Nc3 d5 Bf4 c5 e3'), 'white')).toEqual({ opening: 'jobava-london', line: 'c5' });
    expect(studyLineOf(uciOf('e4 c6 d4 d5 Bd3'), 'black')).toEqual({ opening: 'caro-kann', line: 'other' });
  });
  it('counts only games with the player on the opening\'s side', () => {
    expect(studyLineOf(uciOf('e4 c6 d4 d5 e5 Bf5'), 'white')).toBeUndefined();
    expect(studyLineOf(uciOf('e4 e5 Nf3 Nc6'), 'black')).toBeUndefined();
  });
  it('turns repeated losses into a weak line and a study week', () => {
    const adv = 'e4 c6 d4 d5 e5 Bf5 Nf3 e6';
    const games = [game(adv, 'black', '1-0'), game(adv, 'black', '1-0'), game(adv, 'black', '1/2-1/2'), game(adv, 'black', '1-0'), game('e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6', 'black', '0-1')];
    const stats = studyStats(games);
    expect(stats[0]).toMatchObject({ opening: 'caro-kann', line: 'advance', games: 4, losses: 3, draws: 1 });
    expect(isWeak(stats[0])).toBe(true);
    expect(stats.find((s) => s.line === 'exchange')).toMatchObject({ games: 1, wins: 1 });
    const plan = buildWeeklyPlan({ weaknesses: [], study: stats, averageRating: 1500 } as unknown as Report, 'test');
    const tasks = plan.days.flatMap((d) => d.tasks);
    expect(tasks.some((t) => t.href === '/learn/study/caro-kann?line=advance&tab=games')).toBe(true);
    expect(tasks.some((t) => t.href === '/learn/study/caro-kann?line=advance&tab=puzzles')).toBe(true);
    expect(plan.focus[0].title).toBe('Study the Caro-Kann Defence, Advance Variation');
  });
});

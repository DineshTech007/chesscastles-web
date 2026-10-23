import type { Plan } from '$lib/plans';
/**
 * Chess Castles' leaderboards, in one shape for the Leaderboard page and the
 * home card: CC Rating, Lichess ratings and puzzle ratings of Chess Castles players,
 * Blindfold Gym, study points this week, and book chapters read.
 */
import { boardOf, kfideLeaders } from '$lib/social';
import { lichessRatings } from '$lib/lichess';
import { leaders, type Board as VisionBoard } from '$lib/vision/api';
import { weekOf } from '$lib/study/progress';
import { SPEED_LABEL, type KfideSpeed } from '$lib/kfide';
import { rushTitle } from '$lib/puzzles/rewards';
import { racerTitle } from '$lib/racer/stats';

export type BoardKind = 'kfide' | 'lichess' | 'puzzles' | 'rush' | 'endless' | 'racer' | 'vision' | 'study' | 'books';

export interface Row {
  /** A Chess Castles title (CGM…), shown as a badge before the name. */
  ccTitle?: string;
  key: string;
  /** The account ("lichess:<id>"), when known: for the Friends filter and the profile link. */
  uid?: string;
  name: string;
  country?: string;
  title?: string;
  value: number;
  /** A small note, e.g. "14 games". */
  sub?: string;
  me?: boolean;
  /** The badge beside the name. */
  plan?: Plan;
}

export const BOARDS: { id: BoardKind; label: string; signIn: boolean; variants: { id: string; label: string }[]; unit: string }[] = [
  { id: 'kfide', label: 'CC Rating', signIn: true, unit: 'CC Rating', variants: [{ id: 'main', label: 'Overall' }, ...(['standard', 'rapid', 'blitz', 'bullet'] as KfideSpeed[]).map((s) => ({ id: s, label: SPEED_LABEL[s] }))] },
  { id: 'lichess', label: 'Lichess', signIn: true, unit: 'rating', variants: ['blitz', 'rapid', 'classical', 'bullet'].map((s) => ({ id: s, label: s[0].toUpperCase() + s.slice(1) })) },
  { id: 'puzzles', label: 'Puzzles', signIn: true, unit: 'puzzle rating', variants: [{ id: 'rating', label: 'Puzzle rating' }, { id: 'solved', label: 'Most solved' }] },
  { id: 'racer', label: 'Puzzle Racer', signIn: true, unit: 'best score', variants: [] },
  { id: 'rush', label: 'Puzzle Rush', signIn: true, unit: 'best score', variants: [] },
  // Rush Unlimited (no clock, 3 mistakes): its own standings (owner, 2026-10-23).
  { id: 'endless', label: 'Rush Unlimited', signIn: true, unit: 'best score', variants: [] },
  { id: 'vision', label: 'Blindfold Gym', signIn: false, unit: '', variants: [{ id: 'rating', label: 'Vision rating' }, { id: 'sprint', label: 'Best sprint' }, { id: 'today', label: 'Today' }] },
  { id: 'study', label: 'Study', signIn: true, unit: 'points this week', variants: [] },
  { id: 'books', label: 'Audio Books', signIn: true, unit: 'chapters read', variants: [] },
];

export async function loadBoard(kind: BoardKind, variant = ''): Promise<Row[]> {
  if (kind === 'vision') {
    const r = await leaders((variant || 'rating') as VisionBoard);
    return r.players.map((p) => ({ key: p.id, name: p.name, value: p.value, sub: `${p.games} puzzles` }));
  }
  if (kind === 'kfide') {
    const l = await kfideLeaders((variant || 'main') as 'main' | KfideSpeed);
    return l.map((p) => ({ key: p.uid, uid: p.uid, name: p.name, country: p.country, ccTitle: p.title, value: p.rating, sub: `${p.games} ${p.games === 1 ? 'game' : 'games'}`, me: p.me, plan: p.plan }));
  }
  if (kind === 'study' || kind === 'books') {
    const l = await boardOf(kind, weekOf(Date.now()));
    return l.map((p) => ({ key: p.uid, uid: p.uid, name: p.name, country: p.country, ccTitle: p.title, value: p.rating, me: p.me, plan: p.plan }));
  }
  if (kind === 'racer') {
    // Puzzle Racer: the best score in a race, and how many races.
    const l = await boardOf('racer');
    return l.map((p) => ({ key: p.uid, uid: p.uid, name: p.name, country: p.country, ccTitle: p.title, value: p.rating, sub: [racerTitle(p.rating) ? `🏎️ ${racerTitle(p.rating)}` : '', p.games ? `${p.games} ${p.games === 1 ? 'race' : 'races'}` : ''].filter(Boolean).join(' · '), me: p.me, plan: p.plan }));
  }
  if (kind === 'rush') {
    // Puzzle Rush: the best score, with the title it earns (Speedster, Rush master, Rush legend).
    const l = await boardOf('rush');
    return l.map((p) => {
      const t = rushTitle(p.rating);
      return { key: p.uid, uid: p.uid, name: p.name, country: p.country, ccTitle: p.title, value: p.rating, sub: [t ? `🚀 ${t}` : '', p.games ? `${p.games} ${p.games === 1 ? 'rush' : 'rushes'}` : ''].filter(Boolean).join(' · '), me: p.me, plan: p.plan };
    });
  }
  if (kind === 'endless') {
    // Rush Unlimited: the best run, and how many runs.
    const l = await boardOf('endless');
    return l.map((p) => ({ key: p.uid, uid: p.uid, name: p.name, country: p.country, ccTitle: p.title, value: p.rating, sub: p.games ? `${p.games} ${p.games === 1 ? 'run' : 'runs'}` : '', me: p.me, plan: p.plan }));
  }
  if (kind === 'puzzles') {
    // Chess Castles puzzles: the puzzle rating here and how many each player solved here (not their Lichess numbers).
    const solved = variant === 'solved';
    const l = await boardOf(solved ? 'puzzles_solved' : 'puzzles');
    return l.map((p) => ({
      key: p.uid,
      uid: p.uid,
      name: p.name,
      country: p.country,
      ccTitle: p.title,
      value: solved ? p.games : p.rating,
      sub: solved ? `rating ${p.rating}` : `${p.games} ${p.games === 1 ? 'puzzle' : 'puzzles'} solved`,
      me: p.me,
      plan: p.plan,
    }));
  }
  // Lichess ratings of the Chess Castles players.
  const members = await boardOf('members');
  const ratings = await lichessRatings(members.map((m) => m.uid.replace(/^lichess:/, '')));
  const perf = variant || 'blitz';
  return members
    .flatMap((m) => {
      const u = ratings.get(m.uid.replace(/^lichess:/, ''));
      const p = u?.perfs[perf];
      if (!u || !p || (!p.games && perf !== 'puzzle')) return [];
      return [{ key: m.uid, uid: m.uid, name: m.name, country: m.country, title: u.title, value: p.rating, sub: p.games ? `${p.games} ${perf === 'puzzle' ? 'puzzles' : 'games'}${p.prov ? ' · provisional' : ''}` : undefined, me: m.me, plan: m.plan }];
    })
    .sort((a, b) => b.value - a.value);
}

import type { Plan } from '$lib/plans';
/**
 * Chess Castles' leaderboards, in one shape for the Leaderboard page and the
 * home card: CC Rating, Lichess ratings and puzzle ratings of Chess Castles players,
 * Vision Gym, study points this week, and book chapters read.
 */
import { boardOf, kfideLeaders } from '$lib/social';
import { lichessRatings } from '$lib/lichess';
import { leaders, type Board as VisionBoard } from '$lib/vision/api';
import { weekOf } from '$lib/study/progress';
import { SPEED_LABEL, type KfideSpeed } from '$lib/kfide';

export type BoardKind = 'kfide' | 'lichess' | 'puzzles' | 'vision' | 'study' | 'books';

export interface Row {
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
  { id: 'kfide', label: 'CC Rating', signIn: true, unit: 'CC Rating', variants: [{ id: 'main', label: 'Overall' }, ...(['standard', 'rapid', 'blitz'] as KfideSpeed[]).map((s) => ({ id: s, label: SPEED_LABEL[s] }))] },
  { id: 'lichess', label: 'Lichess', signIn: true, unit: 'rating', variants: ['blitz', 'rapid', 'classical', 'bullet'].map((s) => ({ id: s, label: s[0].toUpperCase() + s.slice(1) })) },
  { id: 'puzzles', label: 'Puzzles', signIn: true, unit: 'puzzle rating', variants: [] },
  { id: 'vision', label: 'Vision Gym', signIn: false, unit: '', variants: [{ id: 'rating', label: 'Vision rating' }, { id: 'sprint', label: 'Best sprint' }, { id: 'today', label: 'Today' }] },
  { id: 'study', label: 'Study', signIn: true, unit: 'points this week', variants: [] },
  { id: 'books', label: 'Books', signIn: true, unit: 'chapters read', variants: [] },
];

export async function loadBoard(kind: BoardKind, variant = ''): Promise<Row[]> {
  if (kind === 'vision') {
    const r = await leaders((variant || 'rating') as VisionBoard);
    return r.players.map((p) => ({ key: p.id, name: p.name, value: p.value, sub: `${p.games} puzzles` }));
  }
  if (kind === 'kfide') {
    const l = await kfideLeaders((variant || 'main') as 'main' | KfideSpeed);
    return l.map((p) => ({ key: p.uid, uid: p.uid, name: p.name, country: p.country, value: p.rating, sub: `${p.games} ${p.games === 1 ? 'game' : 'games'}`, me: p.me, plan: p.plan }));
  }
  if (kind === 'study' || kind === 'books') {
    const l = await boardOf(kind, weekOf(Date.now()));
    return l.map((p) => ({ key: p.uid, uid: p.uid, name: p.name, country: p.country, value: p.rating, me: p.me, plan: p.plan }));
  }
  // Lichess and puzzle ratings of the Chess Castles players.
  const members = await boardOf('members');
  const ratings = await lichessRatings(members.map((m) => m.uid.replace(/^lichess:/, '')));
  const perf = kind === 'puzzles' ? 'puzzle' : variant || 'blitz';
  return members
    .flatMap((m) => {
      const u = ratings.get(m.uid.replace(/^lichess:/, ''));
      const p = u?.perfs[perf];
      if (!u || !p || (!p.games && perf !== 'puzzle')) return [];
      return [{ key: m.uid, uid: m.uid, name: m.name, country: m.country, title: u.title, value: p.rating, sub: p.games ? `${p.games} ${perf === 'puzzle' ? 'puzzles' : 'games'}${p.prov ? ' · provisional' : ''}` : undefined, me: m.me, plan: m.plan }];
    })
    .sort((a, b) => b.value - a.value);
}

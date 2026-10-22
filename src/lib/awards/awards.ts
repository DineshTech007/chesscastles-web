import { get } from 'svelte/store';
import { BADGES, rewards, type Badge } from '$lib/puzzles/rewards';
import { PUZZLE_LEVELS } from '$lib/puzzles/bank';
import { puzzleRating } from '$lib/puzzles/rating';
import { badges as studyBadges, study, type Activity } from '$lib/study/progress';
import { learnedCount, loadTree, userNodes } from '$lib/study/openingTree';
import { OPENINGS } from '$lib/openings';
import { customOpenings } from '$lib/customOpenings';
import { loadStars } from '$lib/masters/data';
import { loadTrophies, type Trophy } from '$lib/tournament/tournament';
import { loadCoach } from '$lib/coach/progress';
import { allProgress } from '$lib/books/books';
import { myGames, outcome } from '$lib/stores/myGames';
import { gamesOf, kfide } from '$lib/stores/me';
import { session } from '$lib/auth';

/**
 * Every award a player can win on Chess Castles, in one list (owner, 2026-10-22: "a section for each student with the
 * badges and awards they got in their study and puzzles"): the puzzle badges and Puzzle Rush titles (rewards.ts), the
 * puzzle levels' trophies, the study badges (study/progress.ts), lessons and books, the masters lessons, and the
 * tournaments against the computer. Most are counted in this browser; the ids won also go to the account (the
 * profile's progress, kept once won) so they show on every device and to friends.
 */

export type AwardGroup = 'start' | 'games' | 'ratings' | 'levels' | 'puzzles' | 'rush' | 'study' | 'lessons' | 'masters' | 'tournaments';
export interface Award extends Badge {
  group: AwardGroup;
  /** Its picture (a medal name or a whole path) and the number on it. */
  art?: { medal: string; n?: string };
}

export const GROUPS: { id: AwardGroup; name: string }[] = [
  { id: 'start', name: 'Welcome' },
  { id: 'games', name: 'Games' },
  { id: 'ratings', name: 'CC Rating' },
  { id: 'levels', name: 'Puzzle levels' },
  { id: 'puzzles', name: 'Puzzles' },
  { id: 'rush', name: 'Puzzle Rush' },
  { id: 'study', name: 'Study' },
  { id: 'lessons', name: 'Lessons and books' },
  { id: 'masters', name: 'Masters lessons' },
  { id: 'tournaments', name: 'Tournaments' },
];

const TROPHY = '/art/trophy-256.webp';
const STUDY_ART: Record<string, { medal: string; n?: string }> = {
  streak7: { medal: 'calendar', n: '7' },
  streak30: { medal: 'calendar', n: '30' },
  puzzles25: { medal: 'puzzle', n: '25' },
  games10: { medal: 'target', n: '10' },
  opening: { medal: 'crown' },
  points1000: { medal: 'star', n: '1K' },
};
const STUDY_ICON: Record<string, string> = { streak7: '📅', streak30: '🗓️', puzzles25: '🧩', games10: '⚔️', opening: '📖', points1000: '⭐' };

export const AWARDS: Award[] = [
  { id: 'welcome', group: 'start', icon: '👋', name: 'Welcome!', hint: 'Join Chess Castles', art: { medal: 'sprout' } },
  { id: 'firstgame', group: 'games', icon: '♟', name: 'First game', hint: 'Finish your first game', art: { medal: 'target' } },
  { id: 'firstwin', group: 'games', icon: '🏆', name: 'First win', hint: 'Win a game', art: { medal: 'star', n: '1' } },
  { id: 'wins10', group: 'games', icon: '🥉', name: '10 wins', hint: 'Win 10 games', art: { medal: 'star', n: '10' } },
  { id: 'wins50', group: 'games', icon: '🥈', name: '50 wins', hint: 'Win 50 games', art: { medal: 'star', n: '50' } },
  { id: 'giant', group: 'games', icon: '⚔️', name: 'Giant killer', hint: 'Beat an opponent rated 200 or more above you', art: { medal: 'flame', n: '+200' } },
  ...[1400, 1600, 1800, 2000].map((r): Award => ({ id: `cc${r}`, group: 'ratings', icon: '♜', name: `CC Rating ${r}`, hint: `Reach a CC Rating of ${r} (after 5 rated games)`, art: { medal: 'crown', n: String(r) } })),
  ...PUZZLE_LEVELS.slice(1).map((l): Award => ({ id: `lvl${l.name.toLowerCase()}`, group: 'levels', icon: l.glyph, name: `${l.name} level`, hint: `Reach a puzzle rating of ${l.from}`, art: { medal: l.image } })),
  ...BADGES.filter((b) => !b.id.startsWith('rush')).map((b): Award => ({ ...b, group: 'puzzles' })),
  ...BADGES.filter((b) => b.id.startsWith('rush')).map((b): Award => ({ ...b, group: 'rush' })),
  ...studyBadges([], 0, 0).map((b): Award => ({ id: b.id, name: b.name, hint: b.hint, icon: STUDY_ICON[b.id] ?? '⭐', group: 'study', art: STUDY_ART[b.id] })),
  { id: 'lesson1', group: 'lessons', icon: '🌱', name: 'First lesson', hint: 'Finish a lesson with Chess Guru', art: { medal: 'sprout', n: '1' } },
  { id: 'lessons10', group: 'lessons', icon: '🎓', name: '10 lessons', hint: 'Finish 10 lessons', art: { medal: 'sprout', n: '10' } },
  { id: 'lessons25', group: 'lessons', icon: '🎓', name: '25 lessons', hint: 'Finish 25 lessons', art: { medal: 'sprout', n: '25' } },
  { id: 'chapter1', group: 'lessons', icon: '📖', name: 'First chapter', hint: 'Read a chapter of a book' },
  { id: 'chapters25', group: 'lessons', icon: '📚', name: 'Bookworm', hint: 'Read 25 chapters' },
  { id: 'masters1', group: 'masters', icon: '♔', name: 'With the masters', hint: 'Finish a lesson with the masters', art: { medal: 'star', n: '1' } },
  { id: 'masters3', group: 'masters', icon: '🌟', name: 'Perfect lesson', hint: 'Get 3 stars in a masters lesson', art: { medal: 'star', n: '3★' } },
  { id: 'masters10', group: 'masters', icon: '⭐', name: '10 master stars', hint: 'Win 10 stars in masters lessons', art: { medal: 'star', n: '10' } },
  { id: 'masters50', group: 'masters', icon: '💫', name: '50 master stars', hint: 'Win 50 stars in masters lessons', art: { medal: 'star', n: '50' } },
  { id: 'tourney1', group: 'tournaments', icon: '🏁', name: 'First tournament', hint: 'Finish a tournament', art: { medal: TROPHY, n: '1' } },
  { id: 'tourney5', group: 'tournaments', icon: '🏁', name: 'Tournament regular', hint: 'Finish 5 tournaments', art: { medal: TROPHY, n: '5' } },
  { id: 'podium', group: 'tournaments', icon: '🥉', name: 'On the podium', hint: 'Finish a tournament in the top 3', art: { medal: TROPHY, n: 'Top 3' } },
  { id: 'champion', group: 'tournaments', icon: '🥇', name: 'Champion', hint: 'Win a tournament', art: { medal: TROPHY, n: '1st' } },
];

/** What the awards are counted from. */
export interface AwardInput {
  /** Puzzle badges won (rewards.ts). */
  badges: string[];
  puzzleRating: number;
  study: Activity[];
  now: number;
  openingsLearned: number;
  /** Masters lessons: stars per lesson. */
  masters: Record<string, number>;
  trophies: Trophy[];
  lessonsDone: number;
  chapters: number;
  /** Games finished and won, and the biggest rating gap beaten (opponent minus me). */
  played: number;
  wins: number;
  gap: number;
  /** My CC Rating and the rated games behind it. */
  cc: number;
  ccGames: number;
}

/** The awards won, from the player's numbers. */
export function earnedFrom(x: AwardInput): Set<string> {
  const won = new Set(x.badges.filter((b) => AWARDS.some((a) => a.id === b)));
  won.add('welcome');
  for (const l of PUZZLE_LEVELS.slice(1)) if (x.puzzleRating >= l.from) won.add(`lvl${l.name.toLowerCase()}`);
  for (const b of studyBadges(x.study, x.now, x.openingsLearned)) if (b.earned) won.add(b.id);
  const stars = Object.values(x.masters);
  const total = stars.reduce((n, s) => n + s, 0);
  const add = (id: string, ok: boolean) => ok && won.add(id);
  add('firstgame', x.played >= 1);
  add('firstwin', x.wins >= 1);
  add('wins10', x.wins >= 10);
  add('wins50', x.wins >= 50);
  add('giant', x.gap >= 200);
  for (const r of [1400, 1600, 1800, 2000]) add(`cc${r}`, x.ccGames >= 5 && x.cc >= r);
  add('lesson1', x.lessonsDone >= 1);
  add('lessons10', x.lessonsDone >= 10);
  add('lessons25', x.lessonsDone >= 25);
  add('chapter1', x.chapters >= 1);
  add('chapters25', x.chapters >= 25);
  add('masters1', stars.some((s) => s > 0));
  add('masters3', stars.some((s) => s >= 3));
  add('masters10', total >= 10);
  add('masters50', total >= 50);
  add('tourney1', x.trophies.length >= 1);
  add('tourney5', x.trophies.length >= 5);
  add('podium', x.trophies.some((t) => t.place <= 3));
  add('champion', x.trophies.some((t) => t.place === 1));
  return won;
}

/** This browser's awards (each source read as it is now). */
export function earnedNow(now = Date.now()): Set<string> {
  const learned = [...OPENINGS, ...customOpenings()].filter((o) => {
    const t = loadTree(o.id);
    return t && userNodes(t).length && learnedCount(t) === userNodes(t).length;
  }).length;
  // Games: the signed-in player's own (another account on this browser has its own), else the ones played signed out.
  const s = get(session);
  const games = s.status === 'in' ? gamesOf(get(myGames), s.uid) : get(myGames).filter((g) => !g.owner);
  const done = games.filter((g) => outcome(g) !== 'unfinished');
  const won = done.filter((g) => outcome(g) === 'won');
  const cc = get(kfide);
  return earnedFrom({
    played: done.length,
    wins: won.length,
    gap: Math.max(0, ...won.filter((g) => g.opponentRating && g.myRating).map((g) => g.opponentRating! - g.myRating!)),
    cc: cc.rating,
    ccGames: cc.games,
    badges: get(rewards).badges,
    puzzleRating: get(puzzleRating),
    study: get(study),
    now,
    openingsLearned: learned,
    masters: loadStars(),
    trophies: loadTrophies(),
    lessonsDone: Object.keys(loadCoach().done ?? {}).length,
    chapters: Object.values(allProgress()).reduce((n, b) => n + (b.read?.length ?? 0), 0),
  });
}

import { addCustomOpening } from '$lib/customOpenings';
import { CATALOG } from '$lib/coach/catalog';
import { loadCoach } from '$lib/coach/progress';
import { dayOf, type Activity } from '$lib/study/progress';
import { loadPlan, savePlan, type Topic } from '$lib/study/plan';
import { TACTICS } from './analysis';
import type { MoveRef, Report, Weakness } from './report';

/**
 * Guru's weekly plan from the report on the player's games (a port of the
 * app's lib/insights/study_plan.dart, with the website's material): each
 * weakness becomes concrete tasks with a target, laid out over seven days,
 * costliest weakness first, with a little Vision training every day.
 * Progress is counted from what the player actually does on the site.
 */

export type TaskKind = 'puzzles' | 'mistakes' | 'lesson' | 'vision' | 'sprint' | 'opening' | 'games' | 'tip';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  href: string;
  /** How many to do (puzzles, positions, games); 1 for a lesson or a tip. */
  target: number;
  minutes: number;
  theme?: string;
  lessonId?: string;
  /** Activity labels that count for this task (prefix match). */
  counts?: string;
}

export interface DayPlan {
  day: string;
  topic: Topic;
  tasks: Task[];
}

export interface WeeklyPlan {
  created: number;
  source: string;
  rating: number;
  focus: { title: string; evidence: string }[];
  days: DayPlan[];
  /** Tasks the player ticked by hand (tips). */
  ticked: string[];
}

const KEY = 'k24.guruPlan';

export function loadWeeklyPlan(): WeeklyPlan | undefined {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return p && Array.isArray(p.days) ? p : undefined;
  } catch {
    return undefined;
  }
}

export function saveWeeklyPlan(p: WeeklyPlan | undefined) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

/** The line of a repeated opening slip, followed by the better move, as SAN for the opening trainer. */
export function repairLine(slip: MoveRef): string | undefined {
  if (!slip.move.bestSan) return undefined;
  return [...slip.game.san.slice(0, slip.move.ply), slip.move.bestSan].join(' ');
}

const puzzles = (theme: string, n: number, why: string): Task => ({
  id: `p-${theme}`,
  kind: 'puzzles',
  title: `${n} ${THEME_NAMES[theme] ?? theme} puzzles`,
  detail: why,
  href: `/puzzles/themes?theme=${theme}&n=${n}`,
  target: n,
  minutes: n * 2,
  theme,
  counts: `Theme puzzle: ${theme}`,
});

export const THEME_NAMES: Record<string, string> = {
  fork: 'fork', pin: 'pin', skewer: 'skewer', hangingPiece: 'hanging-piece', mateIn1: 'mate-in-1', mateIn2: 'mate-in-2', mateIn3: 'mate-in-3',
  backRankMate: 'back-rank', opening: 'opening', rookEndgame: 'rook-endgame', pawnEndgame: 'pawn-endgame', crushing: 'finish-it-off',
  short: 'quick', endgame: 'endgame', middlegame: 'middlegame', discoveredAttack: 'discovered-attack', defensiveMove: 'defence', sacrifice: 'sacrifice',
};

const lesson = (id: string, why: string): Task | undefined => {
  const l = CATALOG.find((x) => x.id === id);
  return l ? { id: `l-${id}`, kind: 'lesson', title: `Lesson: ${l.title}`, detail: why, href: `/coach/${id}`, target: 1, minutes: 10, lessonId: id } : undefined;
};

/** The next unfinished Coach lessons of a section, at the player's level first (rating below 1200: beginner, below 1800: intermediate, else advanced). */
const nextLessons = (category: 'endgame' | 'middlegame' | 'opening', n: number, why: string, rating: number): Task[] => {
  const done = loadCoach().done;
  const want = rating < 1200 ? 0 : rating < 1800 ? 1 : 2;
  const level = { beginner: 0, intermediate: 1, advanced: 2 };
  return CATALOG.filter((l) => l.category === category && !done[l.id])
    .sort((a, b) => Math.abs(level[a.level] - want) - Math.abs(level[b.level] - want))
    .slice(0, n)
    .map((l) => lesson(l.id, why)!)
    .filter(Boolean);
};

const vision = (n: number): Task => ({ id: 'v-blind', kind: 'vision', title: `${n} blindfold puzzles`, detail: 'See the board in your head: it makes calculation and tactics stronger.', href: '/vision/blind', target: n, minutes: n * 2, counts: 'Vision puzzle' });
const sprint: Task = { id: 'v-sprint', kind: 'sprint', title: 'One Vision Sprint', detail: 'A minute of quick board sight, no board.', href: '/vision/sprint', target: 1, minutes: 2, counts: 'Vision Sprint' };

function tasksFor(w: Weakness, rating: number): Task[] {
  const out: (Task | undefined)[] = [];
  switch (w.kind) {
    case 'tactic': {
      const t = w.tactic!;
      out.push({ id: `m-${t}`, kind: 'mistakes', title: `Replay 5 of your own ${TACTICS[t].label.toLowerCase()} moments`, detail: 'Find the move you missed in your own games, three tries each.', href: `/insights/mistakes?tactic=${t}`, target: 5, minutes: 10, counts: 'Own mistake' });
      out.push(puzzles(TACTICS[t].theme, 10, `${TACTICS[t].label} puzzles at your level: make the pattern automatic.`));
      const LESSON: Record<string, string> = { fork: 'knight-forks', pin: 'pins', skewer: 'skewers', backRank: 'back-rank-mate', mate: 'mate-in-two', hanging: 'free-pieces' };
      out.push(lesson(LESSON[t] ?? 'free-pieces', 'Guru explains the idea with master games.'));
      break;
    }
    case 'opening': {
      const o = w.opening!;
      const slip = o.repeatedSlip ?? o.slips[0];
      const line = slip ? repairLine(slip) : undefined;
      if (line) {
        out.push({ id: `o-${o.name}-${o.color}`, kind: 'opening', title: `Repair your ${o.name}`, detail: `Learn the line up to ${slip!.move.bestSan} (instead of ${slip!.move.san}) in the opening trainer.`, href: `/insights/repair?line=${encodeURIComponent(line)}&color=${o.color}`, target: 1, minutes: 15, counts: 'Trainer' });
      }
      out.push(puzzles('opening', 8, 'Opening traps and ideas: punish early mistakes, and avoid them yourself.'));
      break;
    }
    case 'openingPhase':
      out.push(lesson('opening-principles', 'Centre, development, king safety: the rules that prevent early mistakes.'));
      out.push(lesson('opening-traps', 'The traps players fall into most.'));
      out.push(puzzles('opening', 8, 'Opening puzzles at your level.'));
      break;
    case 'endgame':
      out.push(...nextLessons('endgame', 2, 'The key endgame positions every player needs.', rating));
      out.push(puzzles('rookEndgame', 8, 'The most common endgame: active rook, rook behind passed pawns.'));
      out.push(puzzles('pawnEndgame', 8, 'Opposition and counting moves: king and pawns only.'));
      break;
    case 'timeTrouble':
      out.push({ id: 't-pace', kind: 'tip', title: 'Pace your clock', detail: 'Aim to have half your time left by move 20. In the last tenth of your clock: checks, captures, threats, then the safest move.', href: '/play', target: 1, minutes: 2 });
      out.push(sprint);
      out.push(puzzles('short', 10, 'Short, easy puzzles fast, to make safe moves automatic.'));
      break;
    case 'slowOpening':
      out.push({ id: 't-fast-opening', kind: 'tip', title: 'Play the opening faster', detail: 'Your first ten moves should come from what you know. Learn one line for each colour in the opening trainer and play it quickly.', href: '/learn#openings', target: 1, minutes: 2 });
      break;
    case 'conversion':
      out.push({ id: 't-convert', kind: 'tip', title: 'Winning won games', detail: 'When ahead: trade pieces (not pawns), stop counterplay first, and check every reply before you move.', href: '/coach', target: 1, minutes: 2 });
      out.push(puzzles('crushing', 10, 'Puzzles where you are winning: finish cleanly.'));
      out.push(lesson('outside-passer', 'Turning an extra pawn into a win.'));
      break;
  }
  return out.filter((t): t is Task => !!t);
}

const TOPIC_OF: Record<Task['kind'], Topic> = { puzzles: 'tactics', mistakes: 'tactics', lesson: 'middlegame', vision: 'tactics', sprint: 'tactics', opening: 'openings', games: 'middlegame', tip: 'middlegame' };

/** Builds the week from the report, starting today. */
export function buildWeeklyPlan(r: Report, source: string): WeeklyPlan {
  const sections = r.weaknesses.map((w) => ({ w, tasks: tasksFor(w, r.averageRating ?? 1200) })).filter((s) => s.tasks.length);
  const days: DayPlan[] = [];
  const start = new Date();
  for (let d = 0; d < 7; d++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d, 12);
    const tasks: Task[] = [];
    if (d === 6 || !sections.length) {
      tasks.push({ id: 'g-games', kind: 'games', title: 'Play 2 games against a FIDE-rated player', detail: 'At your level, then come back and analyse your games again to see what changed.', href: '/play', target: 2, minutes: 40, counts: 'Game' });
    } else {
      // The costliest weakness gets days 1, 3 and 5; the others share the rest.
      const s = d % 2 === 0 ? sections[0] : sections[(Math.floor(d / 2) + 1) % sections.length];
      tasks.push(s.tasks[Math.floor(d / 2) % s.tasks.length]);
      if (s.tasks.length > 1 && d % 2 === 1) tasks.push(s.tasks[(Math.floor(d / 2) + 1) % s.tasks.length]);
      // A little Vision training every day: the skill behind calculation.
      const daily = d % 2 === 0 ? vision(3) : sprint;
      if (!tasks.some((t) => t.id === daily.id)) tasks.push(daily);
    }
    const kinds = tasks.map((t) => t.kind);
    const topic: Topic = tasks.some((t) => t.lessonId && CATALOG.find((l) => l.id === t.lessonId)?.category === 'endgame') || tasks.some((t) => t.theme?.includes('ndgame'))
      ? 'endgame'
      : kinds.includes('opening') || tasks.some((t) => t.theme === 'opening' || t.lessonId?.startsWith('opening'))
        ? 'openings'
        : TOPIC_OF[tasks[0].kind];
    days.push({ day: dayOf(date.getTime()), topic, tasks: tasks.map((t, i) => ({ ...t, id: `${d}-${i}-${t.id}` })) });
  }
  return { created: Date.now(), source, rating: r.averageRating ?? 1200, focus: r.weaknesses.slice(0, 3).map((w) => ({ title: w.title, evidence: w.evidence })), days, ticked: [] };
}

/** How much of a task is done: from the study log (on or after its day) and the Coach's finished lessons. */
export function progressOf(t: Task, day: string, plan: WeeklyPlan, activities: Activity[]): number {
  if (t.kind === 'tip') return plan.ticked.includes(t.id) ? 1 : 0;
  if (t.kind === 'lesson' && t.lessonId) {
    const done = loadCoach().done[t.lessonId];
    return done && done >= plan.created ? 1 : 0;
  }
  const since = new Date(`${day}T00:00:00`).getTime();
  const used = activities.filter((a) => a.at >= since && a.at >= plan.created);
  const n =
    t.kind === 'games'
      ? used.filter((a) => a.kind === 'game').length
      : t.kind === 'opening'
        ? used.filter((a) => a.kind === 'trainer').length
        : used.filter((a) => t.counts && a.label.startsWith(t.counts)).length;
  return Math.min(1, n / t.target);
}

export function weekProgress(plan: WeeklyPlan, activities: Activity[]) {
  const all = plan.days.flatMap((d) => d.tasks.map((t) => progressOf(t, d.day, plan, activities)));
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
}

/** Puts the week's topics into the daily study plan (and so into the reminders). */
export function applyToStudyPlan(p: WeeklyPlan) {
  const plan = loadPlan();
  const days = [...plan.days];
  for (const d of p.days) days[new Date(`${d.day}T12:00:00`).getDay()] = d.topic;
  savePlan({ ...plan, days });
  return { ...plan, days };
}

/** Adds a repair line to the opening trainer; returns its trainer id. */
export function addRepairLine(line: string, color: 'white' | 'black', name?: string): string | undefined {
  const r = addCustomOpening(line, color, name);
  return typeof r === 'string' ? undefined : r.id;
}

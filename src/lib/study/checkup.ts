/**
 * Opening check-up: the lines where a player's results drop, from their own
 * games (chess.com and Chess Castles games against FIDE-rated opponents,
 * rapid and slower only: fast games say more about the clock than about
 * the opening).
 *
 * The games are put in a tree of their first moves, one for each colour.
 * A problem line is a move sequence reached in at least 3 games, with at
 * least 2 losses and 40% or less, at the move where the results drop
 * (clearly worse than one move earlier). Longer sequences under it are
 * left out: its "next moves" show them.
 */
import type { ImportedGame } from '$lib/insights/games';

export type Color = 'white' | 'black';

export interface CheckupGame {
  source: 'chesscom' | 'lichess' | 'chesscastles';
  /** The game's address on chess.com or Lichess, or its id in My games. */
  ref: string;
  at: number;
  color: Color;
  /** 1 won, 0.5 drawn, 0 lost. */
  score: number;
  san: string[];
  /** The opening's name (chess.com's), if known. */
  name?: string;
  opponent: string;
}

export interface Results {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** 0 to 1. */
  score: number;
}

export interface ProblemLine extends Results {
  /** "white:e4 c5 c3", for comparing check-ups. */
  key: string;
  color: Color;
  sans: string[];
  name?: string;
  /** The line's last move is the player's own (else the opponent's, a line they meet). */
  yourMove: boolean;
  /** The player's results one move earlier. */
  before: Results;
  /** What came next in these games, most played first. */
  next: { san: string; games: number; score: number }[];
  /** Its games, newest first. */
  list: CheckupGame[];
}

/** How far into the game lines are followed (12 moves each). */
const PLIES = 24;
export const MIN_GAMES = 3;

interface Node {
  sans: string[];
  games: CheckupGame[];
  children: Map<string, Node>;
}

const node = (sans: string[]): Node => ({ sans, games: [], children: new Map() });

export function resultsOf(games: CheckupGame[]): Results {
  const wins = games.filter((g) => g.score === 1).length;
  const losses = games.filter((g) => g.score === 0).length;
  const draws = games.length - wins - losses;
  return { games: games.length, wins, draws, losses, score: games.length ? (wins + draws / 2) / games.length : 0 };
}

const isProblem = (r: Results) => r.games >= MIN_GAMES && r.losses >= 2 && r.score <= 0.4;

function treeOf(games: CheckupGame[], color: Color): Node {
  const root = node([]);
  for (const g of games) {
    if (g.color !== color) continue;
    let n = root;
    n.games.push(g);
    for (const san of g.san.slice(0, PLIES)) {
      let c = n.children.get(san);
      if (!c) n.children.set(san, (c = node([...n.sans, san])));
      c.games.push(g);
      n = c;
    }
  }
  return root;
}

/** The most common opening name among the games (chess.com's names). */
function nameOf(games: CheckupGame[]): string | undefined {
  const count = new Map<string, number>();
  for (const g of games) if (g.name) count.set(g.name, (count.get(g.name) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** The problem lines, the costliest first (the points lost against an even score). */
export function problemLines(games: CheckupGame[]): ProblemLine[] {
  const out: ProblemLine[] = [];
  for (const color of ['white', 'black'] as const) {
    const walk = (n: Node, parent: Results) => {
      for (const c of n.children.values()) {
        const r = resultsOf(c.games);
        if (r.games < MIN_GAMES) continue;
        // From the third move of the game (1.e4 c5 2.c3), where the results drop (or the first
        // move that can be shown, when they were already low before it).
        if (c.sans.length >= 3 && isProblem(r) && (n.sans.length < 3 || !isProblem(parent) || parent.score - r.score >= 0.12)) {
          const next = [...c.children.values()]
            .map((x) => ({ san: x.sans[x.sans.length - 1], ...resultsOf(x.games) }))
            .sort((a, b) => b.games - a.games)
            .map(({ san, games, score }) => ({ san, games, score }));
          out.push({
            key: `${color}:${c.sans.join(' ')}`,
            color,
            sans: c.sans,
            name: nameOf(c.games),
            yourMove: (c.sans.length % 2 === 1) === (color === 'white'),
            before: parent,
            next,
            list: [...c.games].sort((a, b) => b.at - a.at),
            ...r,
          });
          continue; // longer lines under it are its "next moves"
        }
        walk(c, r);
      }
    };
    const root = treeOf(games, color);
    walk(root, resultsOf(root.games));
  }
  const cost = (l: ProblemLine) => l.games * (0.5 - l.score);
  return out.sort((a, b) => cost(b) - cost(a) || b.games - a.games);
}

/** The lines that go best (at least 3 games and 65%), the best first. */
export function bestLines(games: CheckupGame[], limit = 3): (Results & { color: Color; sans: string[]; name?: string })[] {
  const out: (Results & { color: Color; sans: string[]; name?: string })[] = [];
  for (const color of ['white', 'black'] as const) {
    const walk = (n: Node) => {
      for (const c of n.children.values()) {
        const r = resultsOf(c.games);
        if (r.games < MIN_GAMES) continue;
        // The longest line still at 65% or more (from the third move).
        const deeper = [...c.children.values()].some((x) => x.games.length >= MIN_GAMES && resultsOf(x.games).score >= 0.65);
        if (c.sans.length >= 3 && r.score >= 0.65 && !deeper) out.push({ color, sans: c.sans, name: nameOf(c.games), ...r });
        else walk(c);
      }
    };
    walk(treeOf(games, color));
  }
  return out.sort((a, b) => b.games * (b.score - 0.5) - a.games * (a.score - 0.5)).slice(0, limit);
}

/** "1.e4 c5 2.c3" (or "… 2...Nf6" from Black's move). */
export function movesText(sans: string[]): string {
  return sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ');
}

/** A chess.com or Lichess game, for the check-up. */
export function fromOnline(g: ImportedGame): CheckupGame {
  return {
    source: g.site,
    ref: g.url,
    at: g.endTime,
    color: g.userColor,
    score: g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.userColor === 'white') ? 1 : 0,
    san: g.san,
    name: g.opening,
    opponent: g.userColor === 'white' ? g.black : g.white,
  };
}

/** The check-up as saved, to show next time what changed. */
export interface SavedCheckup {
  at: number;
  username: string;
  games: number;
  lines: { key: string; games: number; score: number }[];
}
const KEY = 'cc.openingCheckup';

/** The last two check-ups (newest first). */
export function loadCheckups(): SavedCheckup[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCheckup(c: SavedCheckup): void {
  try {
    const prev = loadCheckups()[0];
    // A check-up the same day replaces that day's, so "last time" stays an earlier one.
    const older = prev && new Date(prev.at).toDateString() === new Date(c.at).toDateString() ? loadCheckups()[1] : prev;
    localStorage.setItem(KEY, JSON.stringify(older ? [c, older] : [c]));
  } catch {
    /* storage blocked */
  }
}

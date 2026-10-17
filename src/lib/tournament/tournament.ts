/**
 * Chess Castles FIDE tournaments: the player against 5–10 computer opponents rated like FIDE-rated
 * players from the FIDE list (the bot plays each at their rating). The
 * player's game each round is played on the board; the others are decided
 * by FIDE's expected score (with draws, more often between strong players).
 * Swiss (paired by score, no repeats) or round robin (everyone once).
 */

export type Result = '1-0' | '0-1' | '1/2-1/2';
export type Format = 'swiss' | 'robin';

export interface TPlayer {
  id: string;
  name: string;
  title?: string;
  rating: number;
  /** FIDE federation, e.g. "IND". */
  fed: string;
  /** Old tournaments only (opponents used to carry real players' names; see loadTournament). */
  fideId?: number;
  /** A computer opponent (every opponent is one). */
  bot?: boolean;
  me?: boolean;
}

/**
 * The computer opponents' names: invented first names, never a real player's
 * (the FIDE list only gives each opponent a realistic rating).
 */
export const BOT_NAMES = [
  'Aarav', 'Diya', 'Vihaan', 'Anika', 'Kabir', 'Myra', 'Reyansh', 'Saanvi', 'Advait', 'Ira', 'Arjun', 'Kiara', 'Ishaan', 'Navya', 'Dhruv', 'Aadhya',
  'Rohan', 'Tara', 'Neel', 'Riya', 'Veer', 'Zoya', 'Om', 'Mira', 'Yash', 'Pari', 'Dev', 'Siya', 'Aryan', 'Avni', 'Shaurya', 'Kavya',
];
const botName = (i: number) => `${BOT_NAMES[i % BOT_NAMES.length]}${i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : ''}`;

export interface TGame {
  round: number;
  white: string;
  /** Empty for a bye (a point without playing). */
  black: string;
  result?: Result;
  /** The player's own game, once played (in My games). */
  gameId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  created: number;
  /** Index in TIME_CONTROLS. */
  tc: number;
  format: Format;
  rounds: number;
  players: TPlayer[];
  games: TGame[];
  /** The round being played (1-based); rounds + 1 when finished. */
  round: number;
}

export const ME = 'me';

/** A small seeded random generator, so a tournament's simulated games are fixed once played. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ---------- opponents from the FIDE list ----------

/** A row of the FIDE list data: [id, name, title, sex, standard, rapid, blitz, born, inactive]. */
export type FideRow = [number, string, string, string, number, number, number, number, number];
export type Speed = 'standard' | 'rapid' | 'blitz';
const COL: Record<Speed, number> = { standard: 4, rapid: 5, blitz: 6 };

/** "Carlsen, Magnus" -> "Magnus Carlsen". */
export const displayName = (n: string) => (n.includes(', ') ? n.split(', ').reverse().join(' ') : n).replace(/\s+/g, ' ').trim();

/**
 * `n` active players rated near `rating` at this speed, different each
 * time: first within 150 points, widening until there are enough.
 */
export function pickOpponents(rows: FideRow[], rating: number, n: number, speed: Speed, fed: string, random: () => number): TPlayer[] {
  const col = COL[speed];
  /** The rating at this speed, or the standard one if there is none. */
  const val = (r: FideRow) => Number(r[col]) || r[4];
  const ok = rows.filter((r) => !r[8] && val(r) > 0);
  const out: TPlayer[] = [];
  const used = new Set<number>();
  // Names in a random order, so each tournament has different ones.
  const names = BOT_NAMES.map((_, i) => i).sort(() => random() - 0.5);
  for (const width of [150, 250, 400, 700, 3000]) {
    const pool = ok.filter((r) => !used.has(r[0]) && Math.abs(val(r) - rating) <= width);
    while (out.length < n && pool.length) {
      const r = pool.splice(Math.floor(random() * pool.length), 1)[0];
      used.add(r[0]);
      // Only the rating comes from the list: no name, title or FIDE ID of a real player.
      out.push({ id: `b${r[0]}`, name: botName(names[out.length] ?? out.length), rating: val(r), fed, bot: true });
    }
    if (out.length >= n) break;
  }
  return out.sort((a, b) => b.rating - a.rating);
}

// ---------- results ----------

export const expected = (a: number, b: number) => 1 / (1 + 10 ** (Math.max(-400, Math.min(400, b - a)) / 400));

/** A game between two rated players, by the odds: draws grow with the players' strength. */
export function simulate(white: number, black: number, random: () => number): Result {
  const e = expected(white + 35, black); // White's first move is worth a little.
  const draw = Math.min(0.5, Math.max(0.12, 0.12 + ((white + black) / 2 - 1200) / 3500)) * (1 - Math.abs(e - 0.5));
  const x = random();
  const win = Math.max(0, e - draw / 2);
  return x < win ? '1-0' : x < win + draw ? '1/2-1/2' : '0-1';
}

const points = (g: TGame, id: string): number => {
  if (!g.result) return 0;
  if (!g.black) return g.white === id ? 1 : 0; // a bye
  if (g.result === '1/2-1/2') return g.white === id || g.black === id ? 0.5 : 0;
  return (g.result === '1-0' ? g.white : g.black) === id ? 1 : 0;
};
const playedBy = (t: Tournament, id: string) => t.games.filter((g) => g.result && (g.white === id || g.black === id));

export interface Standing {
  player: TPlayer;
  score: number;
  /** Buchholz: the opponents' scores added up (the usual first tie-break). */
  buchholz: number;
  played: number;
  wins: number;
  rank: number;
}

export function standings(t: Tournament): Standing[] {
  const score = new Map(t.players.map((p) => [p.id, playedBy(t, p.id).reduce((s, g) => s + points(g, p.id), 0)]));
  const rows = t.players.map((p) => {
    const games = playedBy(t, p.id);
    const opps = games.filter((g) => g.black).map((g) => (g.white === p.id ? g.black : g.white));
    return {
      player: p,
      score: score.get(p.id)!,
      buchholz: opps.reduce((s, o) => s + (score.get(o) ?? 0), 0),
      played: games.length,
      wins: games.filter((g) => points(g, p.id) === 1 && g.black).length,
      rank: 0,
    };
  });
  rows.sort((a, b) => b.score - a.score || b.buchholz - a.buchholz || b.wins - a.wins || b.player.rating - a.player.rating);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

// ---------- pairings ----------

const met = (t: Tournament, a: string, b: string) => t.games.some((g) => (g.white === a && g.black === b) || (g.white === b && g.black === a));
const whites = (t: Tournament, id: string) => t.games.filter((g) => g.white === id && g.black).length - t.games.filter((g) => g.black === id).length;

/** Round robin by the circle method: every pairing for every round. */
export function robinRounds(ids: string[]): [string, string][][] {
  const list = ids.length % 2 ? [...ids, ''] : [...ids];
  const n = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** Swiss pairing for the next round: by score (then rating), nobody meets twice, colours balanced. */
export function swissRound(t: Tournament): [string, string][] {
  const order = standings(t).map((s) => s.player.id);
  const pairs: [string, string][] = [];
  let free = [...order];
  // An odd number: the lowest player without a bye yet sits out (and gets a point).
  if (free.length % 2) {
    const hadBye = new Set(t.games.filter((g) => !g.black).map((g) => g.white));
    const bye = [...free].reverse().find((id) => !hadBye.has(id)) ?? free[free.length - 1];
    free = free.filter((id) => id !== bye);
    pairs.push([bye, '']);
  }
  const pair = (rest: string[]): [string, string][] | undefined => {
    if (!rest.length) return [];
    const [a, ...others] = rest;
    for (const b of others) {
      if (met(t, a, b)) continue;
      const tail = pair(others.filter((x) => x !== b));
      if (tail) return [[a, b], ...tail];
    }
    return undefined;
  };
  const found = pair(free) ?? free.reduce<[string, string][]>((acc, id, i) => (i % 2 ? [...acc, [free[i - 1], id]] : acc), []);
  for (const [a, b] of found) pairs.push(whites(t, a) <= whites(t, b) ? [a, b] : [b, a]);
  return pairs;
}

/** Adds the pairings of round `t.round`. */
export function pairNext(t: Tournament): Tournament {
  const pairs = t.format === 'robin' ? robinRounds(t.players.map((p) => p.id))[t.round - 1] : swissRound(t);
  const games: TGame[] = pairs.map(([white, black]) => (white ? { round: t.round, white, black } : { round: t.round, white: black, black: '' }));
  // Byes are scored at once.
  for (const g of games) if (!g.black) g.result = '1-0';
  return { ...t, games: [...t.games, ...games] };
}

export function createTournament(o: { name: string; tc: number; format: Format; rounds: number; me: TPlayer; opponents: TPlayer[]; seed?: number }): Tournament {
  const players = [{ ...o.me, id: ME, me: true }, ...o.opponents];
  const robinCount = players.length % 2 ? players.length : players.length - 1;
  const t: Tournament = {
    id: `t${Date.now().toString(36)}`,
    name: o.name,
    created: Date.now(),
    tc: o.tc,
    format: o.format,
    rounds: o.format === 'robin' ? robinCount : Math.min(o.rounds, players.length - 1),
    players,
    games: [],
    round: 1,
  };
  return pairNext(t);
}

/** The player's game this round (undefined on a bye or when finished). */
export const myGame = (t: Tournament) => t.games.find((g) => g.round === t.round && g.black && (g.white === ME || g.black === ME));
export const playerById = (t: Tournament, id: string) => t.players.find((p) => p.id === id);
export const finished = (t: Tournament) => t.round > t.rounds;

/**
 * Records the player's result (if any), plays the other games of the round
 * by the odds, and pairs the next round (or ends the tournament).
 */
export function completeRound(t: Tournament, mine?: { result: Result; gameId: string }): Tournament {
  const random = rng(t.created + t.round * 7919);
  const byId = new Map(t.players.map((p) => [p.id, p]));
  const games = t.games.map((g) => {
    if (g.round !== t.round || g.result) return g;
    if (g.white === ME || g.black === ME) return mine ? { ...g, ...mine } : g;
    return { ...g, result: simulate(byId.get(g.white)!.rating, byId.get(g.black)!.rating, random) };
  });
  if (games.some((g) => g.round === t.round && !g.result)) return { ...t, games };
  const next = { ...t, games, round: t.round + 1 };
  return finished(next) ? next : pairNext(next);
}

// ---------- saved (this browser) ----------

const KEY = 'k24.tournament';
const TROPHIES = 'k24.trophies';

export interface Trophy {
  id: string;
  name: string;
  place: number;
  players: number;
  score: number;
  rounds: number;
  at: number;
}

export function loadTournament(): Tournament | undefined {
  try {
    const t: Tournament | undefined = JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? undefined;
    // Older tournaments named their opponents after real players: computer names instead.
    t?.players.forEach((p, i) => {
      if (!p.me && (p.fideId || !p.bot)) {
        p.name = botName(i);
        p.bot = true;
        delete p.fideId;
        delete p.title;
      }
    });
    return t;
  } catch {
    return undefined;
  }
}
export function saveTournament(t: Tournament | undefined) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
export function loadTrophies(): Trophy[] {
  try {
    return JSON.parse(localStorage.getItem(TROPHIES) ?? '[]');
  } catch {
    return [];
  }
}
/** Keeps the finished tournament's result (once). */
export function awardTrophy(t: Tournament): Trophy | undefined {
  if (!finished(t)) return undefined;
  const me = standings(t).find((s) => s.player.me)!;
  const trophy: Trophy = { id: t.id, name: t.name, place: me.rank, players: t.players.length, score: me.score, rounds: t.rounds, at: Date.now() };
  const all = loadTrophies().filter((x) => x.id !== t.id);
  try {
    localStorage.setItem(TROPHIES, JSON.stringify([trophy, ...all].slice(0, 100)));
  } catch {
    /* private mode */
  }
  return trophy;
}
export const placeMedal = (place: number) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '');

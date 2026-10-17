import { writable } from 'svelte/store';
import { positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type GameKind = 'computer' | 'fide' | 'lichess';

export const KIND_LABEL: Record<GameKind, string> = {
  computer: 'Computer',
  fide: 'FIDE-rated player',
  lichess: 'Lichess',
};

/** A game played on this site, kept in this browser (like the app's My games). */
export interface SavedGame {
  id: string;
  playedAt: number;
  kind: GameKind;
  white: string;
  black: string;
  userSide: 'white' | 'black';
  /** "1-0", "0-1", "1/2-1/2", or "*" for a game left unfinished. */
  result: string;
  reason: string;
  timeControl: string;
  opponentRating?: number;
  startFen: string;
  uci: string[];
  /** Fair play: times the player left the game's tab during their own turn. */
  blurs?: number;
  /** The account that played it ("lichess:<id>"); none when played signed out (or before accounts were noted). */
  owner?: string;
}

const KEY = 'k24.myGames';
const MAX = 500;

function read(): SavedGame[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: SavedGame[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage full or blocked: keep the list for this visit only */
  }
}

export const outcome = (g: SavedGame): 'won' | 'lost' | 'draw' | 'unfinished' =>
  g.result === '1-0'
    ? g.userSide === 'white'
      ? 'won'
      : 'lost'
    : g.result === '0-1'
      ? g.userSide === 'black'
        ? 'won'
        : 'lost'
      : g.result === '1/2-1/2'
        ? 'draw'
        : 'unfinished';

export const opponentOf = (g: SavedGame) => (g.userSide === 'white' ? g.black : g.white);

function createStore() {
  const { subscribe, set } = writable<SavedGame[]>([]);
  let list: SavedGame[] = [];
  /** Who is signed in: their new games are marked as theirs. */
  let owner: string | undefined;
  const load = () => {
    list = read().sort((a, b) => b.playedAt - a.playedAt);
    set(list);
  };
  return {
    subscribe,
    load,
    setOwner(uid: string | undefined) {
      owner = uid;
    },
    /** Keeps a game (one without moves is not worth keeping). */
    save(g: Omit<SavedGame, 'id' | 'playedAt'> & Partial<Pick<SavedGame, 'id' | 'playedAt'>>) {
      if (!g.uci.length) return;
      const game: SavedGame = { id: g.id ?? crypto.randomUUID(), playedAt: g.playedAt ?? Date.now(), ...(owner ? { owner } : {}), ...g };
      list = [game, ...list.filter((x) => x.id !== game.id)];
      write(list);
      set(list);
    },
    /** Adds games from the account (played on another device); games already here stay as they are. */
    merge(games: SavedGame[]) {
      const have = new Set(list.map((g) => g.id));
      const added = games.filter((g) => g?.id && Array.isArray(g.uci) && !have.has(g.id));
      if (!added.length) return 0;
      list = [...list, ...added].sort((a, b) => b.playedAt - a.playedAt);
      write(list);
      set(list);
      return added.length;
    },
    remove(id: string) {
      list = list.filter((x) => x.id !== id);
      write(list);
      set(list);
    },
    get: (id: string) => list.find((x) => x.id === id) ?? read().find((x) => x.id === id),
  };
}

export const myGames = createStore();

/** The game as PGN (to open in Analyse, e.g. a friend's game). */
export function pgnOfSaved(g: SavedGame): string {
  const pos = positionFromFen(g.startFen || START);
  const parts: string[] = [];
  for (const u of g.uci) {
    const m = uciToMove(u);
    if (!m || !pos.isLegal(m)) break;
    if (pos.turn === 'white') parts.push(`${pos.fullmoves}.`);
    else if (!parts.length) parts.push(`${pos.fullmoves}...`);
    parts.push(sanOf(pos, m));
    pos.play(m);
  }
  const d = new Date(g.playedAt);
  const tags = [
    ['Event', `Chess Castles · ${KIND_LABEL[g.kind] ?? 'Analysis'}`],
    ['Date', `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`],
    ['White', g.white],
    ['Black', g.black],
    ['Result', g.result],
    ...(g.startFen && g.startFen !== START ? [['FEN', g.startFen], ['SetUp', '1']] : []),
  ];
  return `${tags.map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n')}\n\n${parts.join(' ')} ${g.result}\n`;
}

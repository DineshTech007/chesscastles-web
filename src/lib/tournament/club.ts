/**
 * Club tournaments: real Chess Castles players (friends) and computer players in one FIDE tournament, kept on
 * Chess Castles' server (server/api-worker/src/club.ts) so every player sees the same pairings and standings.
 * A real player's game against a computer is played here, in the browser; two real players play each other on
 * Lichess (a game only the two of them can join), and the server reads that result from Lichess.
 */
import { call } from '$lib/social';

export type ClubResult = '1-0' | '0-1' | '1/2-1/2' | '0-0';

export interface ClubPlayer {
  id: string;
  name: string;
  rating: number;
  fed: string;
  bot?: boolean;
  uid?: string;
  lichess?: string;
}

export interface ClubGame {
  round: number;
  white: string;
  black: string;
  result?: ClubResult;
  gameId?: string;
}

export interface Club {
  id: string;
  name: string;
  owner: string;
  created: number;
  tc: number;
  clock: { minutes: number; increment: number };
  format: 'swiss' | 'robin';
  rounds: number;
  players: ClubPlayer[];
  games: ClubGame[];
  round: number;
  roundAt: number;
}

export interface ClubSummary {
  id: string;
  name: string;
  round: number;
  rounds: number;
  players: number;
  people: number;
  owner: boolean;
  done: boolean;
  myTurn: boolean;
}

export const listClubs = () => call<{ tournaments: ClubSummary[] }>('GET', 'club').then((r) => r.tournaments);
export const getClub = (id: string) => call<Club>('GET', `club/${encodeURIComponent(id)}`);
export const createClub = (o: { name: string; tc: number; clock: Club['clock']; format: Club['format']; rounds: number; friends: string[]; bots: Pick<ClubPlayer, 'name' | 'rating' | 'fed'>[] }) =>
  call<Club>('POST', 'club', o);
/** My result against a computer. */
export const sendClubResult = (id: string, round: number, result: '1-0' | '0-1' | '1/2-1/2', gameId: string) => call<Club>('POST', `club/${encodeURIComponent(id)}/result`, { round, result, gameId });
/** The Lichess game of two real players, once opened. */
export const sendClubGame = (id: string, gameId: string) => call<Club>('POST', `club/${encodeURIComponent(id)}/game`, { gameId });
/** Asks the server to read the Lichess result of my game against a person. */
export const checkClubGame = (id: string) => call<Club>('POST', `club/${encodeURIComponent(id)}/check`, {});
export const closeClubRound = (id: string) => call<Club>('POST', `club/${encodeURIComponent(id)}/close`, {});
export const deleteClub = (id: string) => call<{ ok: true }>('POST', `club/${encodeURIComponent(id)}/delete`, {});

// ---------- reading a tournament ----------

const points = (g: ClubGame, id: string): number => {
  if (!g.result || g.result === '0-0') return 0;
  if (!g.black) return g.white === id ? 1 : 0;
  if (g.result === '1/2-1/2') return g.white === id || g.black === id ? 0.5 : 0;
  return (g.result === '1-0' ? g.white : g.black) === id ? 1 : 0;
};

export interface ClubStanding {
  player: ClubPlayer;
  score: number;
  buchholz: number;
  played: number;
  wins: number;
  rank: number;
}

export function clubStandings(t: Club): ClubStanding[] {
  const playedBy = (id: string) => t.games.filter((g) => g.result && (g.white === id || g.black === id));
  const score = new Map(t.players.map((p) => [p.id, playedBy(p.id).reduce((s, g) => s + points(g, p.id), 0)]));
  const rows = t.players.map((p) => {
    const games = playedBy(p.id);
    const opps = games.filter((g) => g.black).map((g) => (g.white === p.id ? g.black : g.white));
    return { player: p, score: score.get(p.id)!, buchholz: opps.reduce((s, o) => s + (score.get(o) ?? 0), 0), played: games.length, wins: games.filter((g) => points(g, p.id) === 1 && g.black).length, rank: 0 };
  });
  rows.sort((a, b) => b.score - a.score || b.buchholz - a.buchholz || b.wins - a.wins || b.player.rating - a.player.rating);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export const clubDone = (t: Club) => t.round > t.rounds;
export const clubPlayer = (t: Club, id: string) => t.players.find((p) => p.id === id);
export const clubMe = (t: Club, uid: string | undefined) => (uid ? t.players.find((p) => p.uid === uid) : undefined);
/** My game this round (undefined on a bye, or when finished). */
export const clubMyGame = (t: Club, meId: string | undefined) => (meId && !clubDone(t) ? t.games.find((g) => g.round === t.round && g.black && (g.white === meId || g.black === meId)) : undefined);

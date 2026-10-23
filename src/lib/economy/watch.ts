/**
 * Where the Treasury's rewards come from: what the site already records, watched rather than wired into every page.
 * - Games (stores/myGames): a finished game of at least 5 moves each: a win, a draw or a loss (online games more).
 * - Study (study/progress, which every puzzle, lesson, opening line and review already logs): puzzles (first try
 *   pays more), the puzzle of the day, Vision Gym, opening lines, lessons and book chapters, game reviews.
 * - Puzzle Rush and Rush Unlimited runs (puzzles/rewards), Puzzle Racer races and wins (racer/stats).
 * - Awards (awards/awards): each new one pays gold and gems.
 * Castle Cups are paid by the server from its own results. What was there before the Treasury started (or before a
 * player first opened it on this device) is noted, never paid backwards.
 */
import { get } from 'svelte/store';
import { session } from '$lib/auth';
import { myGames, outcome, type SavedGame } from '$lib/stores/myGames';
import { study, type Activity, POINTS } from '$lib/study/progress';
import { rewards } from '$lib/puzzles/rewards';
import { racerStats } from '$lib/racer/stats';
import type { EarnEvent } from './core';
import { record } from './wallet';

interface Seen {
  studyAt: number;
  gamesAt: number;
  rush: number;
  endless: number;
  races: number;
  raceWins: number;
  awards: string[];
}
const KEY = 'cc.treasurySeen';

function readSeen(): Seen | undefined {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return s && typeof s.studyAt === 'number' ? s : undefined;
  } catch {
    return undefined;
  }
}
function writeSeen(s: Seen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked */
  }
}

/** What a study activity is worth (undefined: nothing, e.g. one move of a line, or a Rush puzzle paid by the run). */
export function studyEvent(a: Activity): EarnEvent | undefined {
  const ref = `s:${a.at}`;
  if (a.kind === 'puzzle') {
    if (a.label === 'Puzzle Rush' || a.label === 'Puzzle Racer') return undefined;
    if (/^(Vision|Move Memory|Piece Sight)/.test(a.label)) return { kind: 'vision', ref };
    // The puzzle of the day logs "Puzzle <id>" (DailyPuzzle.svelte).
    if (/^Puzzle \S+$/.test(a.label)) return { kind: 'daily', ref };
    return { kind: a.points >= POINTS.puzzleSolved ? 'puzzleClean' : 'puzzle', ref };
  }
  if (a.kind === 'trainer') return a.points >= POINTS.trainerLine ? { kind: 'line', ref } : undefined;
  if (a.kind === 'lesson') return { kind: 'lesson', ref };
  if (a.kind === 'analysis') return { kind: 'review', ref };
  // Games are paid from the game itself (won, drawn or lost).
  return undefined;
}

/** What a finished game is worth: at least 5 moves each (a game abandoned at once pays nothing). */
export function gameEvent(g: SavedGame): EarnEvent | undefined {
  const o = outcome(g);
  if (o === 'unfinished' || g.uci.length < 10) return undefined;
  const online = g.kind === 'lichess';
  return { kind: o === 'won' ? (online ? 'winOnline' : 'win') : o === 'draw' ? 'draw' : 'loss', ref: `g:${g.id}` };
}

/** Starts watching (once, from +layout.svelte). */
export function startEarning(): () => void {
  let seen = readSeen();
  const latest = (): Seen => {
    const r = get(rewards);
    const rc = get(racerStats);
    return {
      studyAt: Math.max(0, ...get(study).map((a) => a.at)),
      gamesAt: Math.max(0, ...get(myGames).map((g) => g.playedAt)),
      rush: r.rushPlayed,
      endless: r.endlessPlayed,
      races: rc.races,
      raceWins: rc.wins,
      awards: seen?.awards ?? [],
    };
  };
  let ready = false;
  const save = () => seen && writeSeen(seen);

  const onStudy = (list: Activity[]) => {
    if (!ready || !seen) return;
    const fresh = list.filter((a) => a.at > seen!.studyAt);
    if (!fresh.length) return;
    seen.studyAt = Math.max(seen.studyAt, ...fresh.map((a) => a.at));
    save();
    record(fresh.map(studyEvent).filter((e): e is EarnEvent => !!e));
    checkAwards();
  };
  const onGames = (list: SavedGame[]) => {
    if (!ready || !seen) return;
    // Games played here just now (games from the account's other devices were paid there).
    const fresh = list.filter((g) => g.playedAt > seen!.gamesAt && Date.now() - g.playedAt < 3 * 3_600_000);
    const top = Math.max(seen.gamesAt, ...list.map((g) => g.playedAt));
    if (top === seen.gamesAt) return;
    seen.gamesAt = top;
    save();
    record(fresh.map(gameEvent).filter((e): e is EarnEvent => !!e));
    checkAwards();
  };
  const onRewards = () => {
    if (!ready || !seen) return;
    const r = get(rewards);
    const events: EarnEvent[] = [];
    if (r.rushPlayed > seen.rush) events.push({ kind: 'rush', ref: `r:${r.rushPlayed}:${Date.now()}`, score: r.rushRuns.at(-1) ?? 0 });
    if (r.endlessPlayed > seen.endless) events.push({ kind: 'rush', ref: `e:${r.endlessPlayed}:${Date.now()}`, score: Math.floor((r.endlessRuns.at(-1) ?? 0) / 2) });
    seen.rush = Math.max(seen.rush, r.rushPlayed);
    seen.endless = Math.max(seen.endless, r.endlessPlayed);
    save();
    record(events);
    if (events.length) checkAwards();
  };
  const onRacer = () => {
    if (!ready || !seen) return;
    const rc = get(racerStats);
    const events: EarnEvent[] = [];
    for (let i = seen.races; i < Math.min(rc.races, seen.races + 3); i++) events.push({ kind: 'race', ref: `rc:${i + 1}:${Date.now()}` });
    for (let i = seen.raceWins; i < Math.min(rc.wins, seen.raceWins + 3); i++) events.push({ kind: 'raceWin', ref: `rw:${i + 1}:${Date.now()}` });
    seen.races = Math.max(seen.races, rc.races);
    seen.raceWins = Math.max(seen.raceWins, rc.wins);
    save();
    record(events);
    if (events.length) checkAwards();
  };

  /** New awards (they read every kind of progress, so they are counted a moment after a change). */
  let awardTimer: ReturnType<typeof setTimeout> | undefined;
  function checkAwards() {
    clearTimeout(awardTimer);
    awardTimer = setTimeout(async () => {
      if (!seen) return;
      const m = await import('$lib/awards/awards').catch(() => undefined);
      if (!m || !seen) return;
      const now = [...m.earnedNow()];
      const fresh = now.filter((id) => !seen!.awards.includes(id));
      if (!fresh.length) return;
      seen.awards = [...seen.awards, ...fresh];
      save();
      // A few seconds later: the server pays an award the profile has, and the profile hears of it first (+layout.svelte
      // sends the progress three seconds after a change).
      setTimeout(() => record(fresh.slice(0, 10).map((id) => ({ kind: 'award', ref: `a:${id}` }))), 6000);
    }, 2500);
  }

  // The first time (on this device): where things stand now is noted, with the awards already won.
  const begin = async () => {
    if (!seen) {
      const m = await import('$lib/awards/awards').catch(() => undefined);
      seen = { ...latest(), awards: m ? [...m.earnedNow()] : [] };
      save();
    }
    ready = true;
  };
  let started = false;
  const unSession = session.subscribe((s) => {
    if (s.status === 'loading' || started) return;
    started = true;
    // My games load from this browser first (+layout.svelte); a moment later, so they are not taken as new.
    setTimeout(() => void begin(), 1200);
  });
  const subs = [study.subscribe(onStudy), myGames.subscribe(onGames), rewards.subscribe(onRewards), racerStats.subscribe(onRacer)];
  return () => {
    unSession();
    subs.forEach((u) => u());
    clearTimeout(awardTimer);
  };
}

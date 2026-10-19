/**
 * The player's own chess.com and Lichess games for the opening sections (the
 * opening check-up, "Lines from your games"): the last 100 rapid and slower
 * games from each site (fast games say more about the clock than about the
 * opening), kept in this browser.
 */
import { chessComGames, lichessGames, type ImportedGame } from '$lib/insights/games';

export type OnlineSite = 'chesscom' | 'lichess';
export const SITE_NAME: Record<OnlineSite, string> = { chesscom: 'chess.com', lichess: 'Lichess' };
export const ONLINE_COUNT = 100;

export interface SiteGames {
  username: string;
  at: number;
  games: ImportedGame[];
}

const KEY = 'cc.myOnlineGames.v1';

export function loadOnline(): Partial<Record<OnlineSite, SiteGames>> {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

function saveOnline(site: OnlineSite, data: SiteGames): void {
  // Without the clocks (the opening sections don't use them): about half the space.
  const all = { ...loadOnline(), [site]: { ...data, games: data.games.map((g) => ({ ...g, clocks: [] })) } };
  for (let keep = ONLINE_COUNT; keep > 0; keep -= 20) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...all, [site]: { ...all[site], games: all[site]!.games.slice(0, keep) } }));
      return;
    } catch {
      /* storage full: keep fewer games */
    }
  }
}

/** Rapid and slower: chess.com's rapid and daily games, Lichess's rapid, classical and correspondence. */
export const slowEnough = (g: ImportedGame) => ['rapid', 'daily', 'classical', 'correspondence'].includes(g.timeClass);

/** Reads (and keeps) the player's last 100 rapid and slower games from a site. */
export async function fetchOnline(site: OnlineSite, username: string, token?: string, onProgress?: (n: number) => void): Promise<ImportedGame[]> {
  const games =
    site === 'chesscom'
      ? await chessComGames(username, ONLINE_COUNT, onProgress, { keep: slowEnough, months: 24 })
      : await lichessGames(username, ONLINE_COUNT, token, 'rapid,classical,correspondence');
  saveOnline(site, { username: username.trim(), at: Date.now(), games });
  return games;
}

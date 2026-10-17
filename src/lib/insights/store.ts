import type { AnalyzedGame } from './analysis';
import type { Site } from './games';

/** The player's analysed games, kept in this browser (newest first, at most 40). */
export interface InsightsData {
  site: Site;
  username: string;
  at: number;
  games: AnalyzedGame[];
}

const KEY = 'k24.insights.v1';

export function loadInsights(): InsightsData | undefined {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return d && Array.isArray(d.games) ? d : undefined;
  } catch {
    return undefined;
  }
}

export function saveInsights(d: InsightsData) {
  const data = { ...d, games: d.games.slice(0, 40) };
  for (let keep = data.games.length; keep > 0; keep -= 5) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...data, games: data.games.slice(0, keep) }));
      return;
    } catch {
      /* storage full: keep fewer games */
    }
  }
}

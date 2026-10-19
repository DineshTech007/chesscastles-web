/** The admin page's calls (server/api-worker/src/admin.ts checks the role on every one). */
import type { KfideSpeed } from '$lib/kfide';
import { auth } from '$lib/auth';
import { call } from '$lib/social';
import type { Banner, Launch, Plan, PlanConfig } from '$lib/plans';

export type Role = 'owner' | 'moderator' | 'support';
export type Can = 'view' | 'grant' | 'reports' | 'suspend' | 'owner';

export interface Overview {
  days: number;
  from: string;
  /** Per day: visitors, views, sessions, signup. */
  series: Record<string, Record<string, number>>;
  top: Record<'views' | 'features' | 'limits' | 'interest' | 'ref' | 'country' | 'device' | 'visitor', { key: string; count: number }[]>;
  totals: { visitors: number; views: number; sessions: number; signups: number };
  members: { total?: number; new7?: number; new1?: number; active1?: number; active7?: number; active30?: number };
  plans: Record<Plan, number>;
  usage: { feature: string; uses: number; players: number }[];
  openReports: number;
  feedback: { fresh: number; avg: number | null };
  dbBytes: number;
  guruToday: number;
}
export interface AdminUser {
  uid: string;
  username: string;
  name: string;
  /** A Chess Castles title (CGM, CIM…). */
  title?: string;
  /** CC Rating at each speed played, and the ratings the owner set. */
  kfideTc?: Partial<Record<KfideSpeed, { rating: number; games: number }>>;
  ratingSet?: Partial<Record<KfideSpeed, { rating: number; at: number }>>;
  country?: string;
  first?: string;
  last?: string;
  location?: string;
  kfide?: number;
  kfideGames?: number;
  joined: number;
  seen: number;
  suspended: boolean;
  plan: Plan;
  planUntil?: number;
  planSource?: string;
  studyPoints?: number;
  booksRead?: number;
  fideId?: string;
  fideRating?: number;
}
export interface Grant {
  id: number;
  plan: Plan;
  start: number;
  until: number;
  source: string;
  note: string;
  by_uid: string;
  created: number;
}
export interface Report {
  id: number;
  kind: string;
  reporter: string;
  reported: string;
  reporterName?: string;
  reportedName?: string;
  reason: string;
  details: string;
  game: string;
  created: number;
  status: string;
  resolution: string;
  resolved_by: string;
  resolved_at: number;
}
export interface UserDetail {
  user: AdminUser;
  grants: Grant[];
  usage: { day: string; feature: string; n: number }[];
  games: number;
  lastGame?: number;
  reportsAbout: Report[];
  reportsBy: number;
  invited: number;
  invitedBy?: string;
  students: number;
  coaches: string[];
}

type Me = { role: Role; can: Can[] };
/** Who asked and what came back, so the pages ask once per sign-in (a 404 for players who are not admins is not repeated). */
let meCache: { uid: string; p: Promise<Me> } | undefined;
const ME_KEY = 'cc.adminMe';
export const adminMe = (): Promise<Me> => {
  const uid = auth.currentUser?.uid ?? '';
  if (meCache && meCache.uid === uid) return meCache.p;
  let p: Promise<Me> | undefined;
  try {
    const saved = JSON.parse(sessionStorage.getItem(ME_KEY) ?? 'null');
    if (saved?.uid === uid && uid) p = saved.me ? Promise.resolve(saved.me as Me) : Promise.reject(new Error('Not an admin.'));
  } catch {
    /* private mode */
  }
  if (!p) {
    p = call<Me>('GET', 'admin/me');
    p.then(
      (me) => remember(uid, me),
      (e) => {
        if (uid && !String(e?.message).startsWith('Sign in')) remember(uid, null);
        else if (meCache?.p === p) meCache = undefined;
      },
    );
  }
  meCache = { uid, p };
  return p;
};
function remember(uid: string, me: Me | null) {
  try {
    sessionStorage.setItem(ME_KEY, JSON.stringify({ uid, me }));
  } catch {
    /* private mode */
  }
}
export const overview = (days: number) => call<Overview>('GET', `admin/overview?days=${days}`);
export const users = (q: string, filter: string) => call<{ users: AdminUser[] }>('GET', `admin/users?q=${encodeURIComponent(q)}&filter=${filter}`).then((r) => r.users);
export const userDetail = (uid: string) => call<UserDetail>('GET', `admin/user/${encodeURIComponent(uid)}`);
export const grant = (uid: string, plan: Plan, days: number, note: string) => call<{ ok: true }>('POST', 'admin/grant', { uid, plan, days, note });
export const revoke = (id: number) => call<{ ok: true }>('POST', 'admin/revoke', { id });
export const userAction = (uid: string, action: 'suspend' | 'unsuspend' | 'reset_rating' | 'delete', reason: string) => call<{ ok: true }>('POST', 'admin/user', { uid, action, reason });
/** Gives a Chess Castles title ('' takes it away). Owner only. */
export const setTitle = (uid: string, title: string, reason: string) => call<{ ok: true }>('POST', 'admin/user', { uid, action: 'title', title, reason });
/** From now on, the player's CC Rating at this speed starts from `rating`. Owner only. */
export const setRating = (uid: string, speed: KfideSpeed, rating: number, reason: string) => call<{ ok: true }>('POST', 'admin/user', { uid, action: 'set_rating', speed, rating, reason });
export const reports = (status: string) => call<{ reports: Report[] }>('GET', `admin/reports?status=${status}`).then((r) => r.reports);
export const resolveReport = (id: number, status: string, resolution: string) => call<{ ok: true }>('POST', 'admin/report', { id, status, resolution });
export interface Settings {
  config: PlanConfig;
  launch: Launch;
  banner: Banner;
}
export const getSettings = () => call<Settings>('GET', 'admin/settings');
export const saveSettings = (s: Partial<Settings>) => call<Settings>('PUT', 'admin/settings', s);
export const admins = () => call<{ owner: string; admins: { uid: string; role: Role; added: number; name?: string; username?: string }[] }>('GET', 'admin/admins');
export const setAdmin = (uid: string, role: Role | '') => call<{ ok: true }>('POST', 'admin/admins', { uid, role });
export const adminLog = () => call<{ log: { id: number; admin: string; action: string; target: string; detail: string; at: number }[] }>('GET', 'admin/log').then((r) => r.log);

/** Page routes as people say them. */
export const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/play': 'Play',
  '/play/fide': 'Game vs FIDE-level opponent',
  '/play/computer': 'Game vs computer',
  '/play/online/[id]': 'Lichess game',
  '/play/tournament': 'FIDE tournament',
  '/play/tournament/game': 'Tournament game',
  '/play/lichess-tournaments': 'Lichess tournaments',
  '/play/lichess-tournaments/[id]': 'Lichess tournament',
  '/analysis': 'Analyse',
  '/games': 'My games',
  '/guide': 'Chess Guide',
  '/blog': 'Castle Chronicles',
  '/blog/[slug]': 'Castle Chronicles story',
  '/insights': 'Insights',
  '/insights/mistakes': 'Insights: mistakes',
  '/insights/repair': 'Insights: repair',
  '/puzzles': 'Daily puzzle',
  '/puzzles/themes': 'Themed puzzles',
  '/learn': 'Learn',
  '/learn/openings/[id]': 'Opening trainer',
  '/coach': 'Coach',
  '/coach/[id]': 'Guru lesson',
  '/coach/practice': 'Coach practice',
  '/coach/review/[id]': 'Guru game review',
  '/vision': 'Blindfold Gym',
  '/vision/blind': 'Vision: blindfold',
  '/vision/memory': 'Vision: move memory',
  '/vision/sight': 'Vision: piece sight',
  '/vision/sprint': 'Vision: sprint',
  '/books': 'Audio Books',
  '/books/[slug]': 'Book reader',
  '/watch': 'Watch',
  '/leaderboard': 'Leaderboard',
  '/ratings': 'Ratings',
  '/community': 'FIDE & Local Events',
  '/friends': 'Friends',
  '/players/[uid]': 'Player profile',
  '/profile': 'My profile',
  '/plans': 'Plans',
  '/help': 'Help',
  '/more': 'More (phone menu)',
  '/admin': 'Admin',
  '/students': 'My students',
  '/feedback': 'Feedback',
  '/legal/refunds': 'Refund policy',
  '/g/[id]': 'Shared game',
};
export const FEATURE_NAMES: Record<string, string> = {
  feedback: 'Sent feedback',
  fide_game: 'Game vs FIDE-level opponent',
  tournament: 'FIDE tournament',
  review: 'Game Review',
  insights: 'Insights report',
  guru: 'Guru lesson',
  puzzle: 'Themed puzzle',
  vision: 'Blindfold Gym session',
  opening: 'Opening course',
  bot_opening: 'Choose bot’s opening',
  themed_puzzles: 'All puzzle themes',
  own_lines: 'Own opening lines',
  coach_tools: 'Coach tools',
  share_game: 'Shared a game',
  computer_game: 'Game vs computer',
  friend_request: 'Friend request',
  lobby_join: 'Joined a lobby game',
  lichess_pair_blitz: 'Lichess quick pairing: blitz',
  lichess_pair_rapid: 'Lichess quick pairing: rapid',
  lichess_pair_classical: 'Lichess quick pairing: classical',
  lichess_challenge: 'Lichess challenge to a friend',
  lichess_computer: 'Lichess computer game',
  book_chapter: 'Book chapter opened',
  analysis_import: 'Imported a game to analyse',
  referral_joined: 'Joined from an invite',
};
export const pageName = (k: string) => PAGE_NAMES[k] ?? k;
export const featureName = (k: string) => FEATURE_NAMES[k] ?? k;

import type { IconName } from '$lib/components/Icon.svelte';

/**
 * The site's pages outside the five signature features, in the order the menu, the More page and the
 * home page's "Explore" block show them. One list, so the three never drift apart.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Paths that light the menu item. */
  match: string[];
  /** Paths that belong to a signature feature instead. */
  not?: string[];
  /** One line under the name, on the home page and the More page. */
  blurb: string;
  /** False: not in the side menu (the signature features' own item already lights up there). */
  menu?: false;
  /** A small tag beside the name, for something new. */
  badge?: string;
}

export const NAV_GROUPS: NavItem[][] = [
  [
    { href: '/learn', label: 'Learn', icon: 'learn', match: ['/learn'], not: ['/learn/openings'], blurb: 'Lessons, your study plan and Chess Guru' },
    { href: '/watch', label: 'Watch', icon: 'watch', match: ['/watch'], blurb: 'The world’s live games and top events' },
    { href: '/games', label: 'My games', icon: 'history', match: ['/games'], blurb: 'Review every game you played, with ratings' },
    { href: '/vision', label: 'Blindfold Gym', icon: 'eye', match: ['/vision'], blurb: 'See the whole board in your head' },
    { href: '/friends', label: 'Friends & Invites', icon: 'users', match: ['/friends', '/players'], blurb: 'Challenge friends, see their progress, invite more' },
    { href: '/community', label: 'FIDE & Local Events', icon: 'calendar', match: ['/community'], blurb: 'Tournaments near you, registration and coaches' },
  ],
  [
    { href: '/play', label: 'Play', icon: 'knight', match: ['/play'], not: ['/play/fide', '/play/tournament'], blurb: 'Lichess players, the computer and friends' },
    { href: '/puzzles', label: 'Puzzles', icon: 'puzzle', match: ['/puzzles'], blurb: 'Unlimited puzzles, 17 themes' },
    { href: '/analysis', label: 'Analysis board', icon: 'analyse', match: ['/analysis'], menu: false, blurb: 'Engine, game import and board editor' },
    { href: '/books', label: 'Audio Books', icon: 'book', match: ['/books'], blurb: 'Listen to or read the chess classics' },
    { href: '/leaderboard', label: 'Leaderboard', icon: 'star', match: ['/leaderboard'], blurb: 'Top players, you and your friends' },
    { href: '/ratings', label: 'FIDE Ratings', icon: 'trophy', match: ['/ratings'], blurb: 'Rating lists and charts of FIDE players' },
  ],
  [
    { href: '/guide', label: 'Chess Guide', icon: 'help', match: ['/guide'], blurb: 'Answers for parents and beginners, in 3 languages' },
    { href: '/blog', label: 'Castle Chronicles', icon: 'pen', match: ['/blog'], badge: 'NEW', blurb: 'Stories, tips for kids and chess history' },
  ],
];

export const NAV_ITEMS = NAV_GROUPS.flat();

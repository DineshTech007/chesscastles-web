/**
 * Chess Castles' five hero features: the ones only Chess Castles has. Used by
 * the landing (home for visitors, /features for ads), the sidebar's "Only on
 * Chess Castles" group, and the phone's More page.
 */
import type { IconName } from '$lib/components/Icon.svelte';

/** Shown wherever "FIDE-rated" opponents are offered (FIDE's name is theirs; our opponents are computer opponents). */
export const FIDE_DISCLAIMER =
  'FIDE-rated opponents are computer opponents that play in the style of players at each FIDE rating. Chess Castles is not affiliated with or endorsed by FIDE (Fédération Internationale des Échecs), and games here do not count for official FIDE ratings.';

export type HeroId = 'fide' | 'database' | 'openings' | 'insights' | 'guru';
export interface HeroFeature {
  id: HeroId;
  /** In the menu. */
  short: string;
  /** On the landing. */
  title: string;
  promise: string;
  /** Three facts as small chips. */
  facts: string[];
  href: string;
  cta: string;
  icon: IconName;
  /** Paths that light the menu item. */
  match: string[];
}

export const HERO_FEATURES: HeroFeature[] = [
  {
    id: 'fide',
    short: 'FIDE-rated play',
    title: 'Play FIDE-rated opponents',
    promise: 'Pick a rating from 1000 to 2800 and face an opponent who opens, plans and even slips like a real tournament player at that level. Every game moves your CC Rating.',
    facts: ['1000 to 2800', 'Blitz · Rapid · Classical', 'FIDE tournaments'],
    href: '/play?mode=fide',
    cta: 'Play now',
    icon: 'knight',
    match: ['/play/fide', '/play/tournament'],
  },
  {
    id: 'database',
    short: '5M game database',
    title: '5 million games behind every review',
    promise: 'Review any game with the engine and 5.4 million real tournament games side by side. See what strong players chose in your exact position, and open their games.',
    facts: ['5.4 million games', 'Move-by-move review', 'Brilliant to blunder'],
    href: '/analysis?tab=database',
    cta: 'Open the database',
    icon: 'database',
    match: ['/analysis'],
  },
  {
    id: 'openings',
    short: 'AI opening trainer',
    title: 'An AI opening trainer that knows your opponents',
    promise: 'Choose an opening and a rating. The trainer builds your repertoire from the moves players at that level really play, then drills it until it sticks.',
    facts: ['Built from real games', 'Spaced repetition', 'Your own lines'],
    href: '/learn#openings',
    cta: 'Build my repertoire',
    icon: 'tree',
    match: ['/learn/openings'],
  },
  {
    id: 'insights',
    short: 'Game Insights',
    title: 'Game Insights from your online games',
    promise: 'Works with your chess.com and Lichess games. See where you lose points, which openings cost you, and the mistakes you repeat, with a weekly plan built from your own games.',
    facts: ['chess.com & Lichess', 'Your weak spots', 'Weekly study plan'],
    href: '/insights',
    cta: 'Analyse my games',
    icon: 'bulb',
    match: ['/insights'],
  },
  {
    id: 'guru',
    short: 'Chess Guru',
    title: 'Chess Guru, your AI coach',
    promise: 'Lessons, game reviews and stories from your own coach, at your level, whenever you want, in English, Hindi or Marathi.',
    facts: ['Lessons & stories', 'Reviews your games', 'English · हिन्दी · मराठी'],
    href: '/coach',
    cta: 'Meet Guru',
    icon: 'coach',
    match: ['/coach'],
  },
];

/**
 * The short "what it is and how to use it" videos (15–20 s), one per feature in
 * English, Hindi and Marathi, made by scripts/videos/make.mjs into
 * static/videos/<id>-<lang>.mp4. The button in the top bar shows the one for the
 * page you are on, in your content language.
 */
import type { Lang } from '$lib/coach/i18n';

export interface FeatureVideo {
  id: string;
  name: Record<Lang, string>;
  /** Matched against the page's path plus query, first match wins. */
  match: RegExp;
}

export const FEATURE_VIDEOS: FeatureVideo[] = [
  { id: 'database', name: { en: '5M game database', hi: '5M game database', mr: '5M game database' }, match: /^\/analysis\?tab=database/ },
  { id: 'review', name: { en: 'Game Report', hi: 'Game Report', mr: 'Game Report' }, match: /^\/analysis/ },
  { id: 'fide-play', name: { en: 'Play at FIDE level', hi: 'FIDE level पर खेलो', mr: 'FIDE level वर खेळा' }, match: /^\/play(\/fide|\?.*)?$/ },
  { id: 'puzzles', name: { en: 'Puzzles', hi: 'Puzzles', mr: 'Puzzles' }, match: /^\/puzzles/ },
  { id: 'courses', name: { en: 'Opening courses', hi: 'Opening courses', mr: 'Opening courses' }, match: /^\/learn\/study/ },
  { id: 'trainer', name: { en: 'Opening trainer', hi: 'Opening trainer', mr: 'Opening trainer' }, match: /^\/learn\/openings/ },
  { id: 'masters', name: { en: 'Endgames with the masters', hi: 'Masters के endgames', mr: 'Masters चे endgames' }, match: /^\/learn\/masters/ },
  { id: 'guru', name: { en: 'Chess Guru', hi: 'Chess Guru', mr: 'Chess Guru' }, match: /^\/coach/ },
  { id: 'blindfold', name: { en: 'Blindfold Gym', hi: 'Blindfold Gym', mr: 'Blindfold Gym' }, match: /^\/vision/ },
  { id: 'watch', name: { en: 'Watch', hi: 'Watch', mr: 'Watch' }, match: /^\/watch/ },
  { id: 'insights', name: { en: 'Game Insights', hi: 'Game Insights', mr: 'Game Insights' }, match: /^\/insights/ },
  { id: 'books', name: { en: 'Library', hi: 'Library', mr: 'Library' }, match: /^\/books/ },
];

export const featureVideoFor = (pathAndQuery: string): FeatureVideo | undefined => FEATURE_VIDEOS.find((f) => f.match.test(pathAndQuery));
export const videoSrc = (id: string, lang: Lang) => `/videos/${id}-${lang}.mp4`;
export const videoPoster = (id: string) => `/videos/${id}.jpg`;

/**
 * Chess Castles' own titles, given by the owner on the admin page (they are
 * not FIDE titles): the grandmaster, international master, FIDE master and
 * candidate master tiers, and the same for women and girls.
 */
export type Title = 'CGM' | 'CIM' | 'CFM' | 'CCM' | 'CWGM' | 'CWIM' | 'CWFM' | 'CWCM';
export const TITLES: Title[] = ['CGM', 'CIM', 'CFM', 'CCM', 'CWGM', 'CWIM', 'CWFM', 'CWCM'];
export const TITLE_NAME: Record<Title, string> = {
  CGM: 'Castle Grandmaster',
  CIM: 'Castle International Master',
  CFM: 'Castle Master',
  CCM: 'Castle Candidate Master',
  CWGM: 'Castle Woman Grandmaster',
  CWIM: 'Castle Woman International Master',
  CWFM: 'Castle Woman Master',
  CWCM: 'Castle Woman Candidate Master',
};
/** The tier, for the badge's colour: gold, silver, bronze, teal. */
export const TITLE_TIER: Record<Title, 1 | 2 | 3 | 4> = { CGM: 1, CWGM: 1, CIM: 2, CWIM: 2, CFM: 3, CWFM: 3, CCM: 4, CWCM: 4 };
export const isTitle = (t: unknown): t is Title => typeof t === 'string' && (TITLES as string[]).includes(t);

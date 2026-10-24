import { describe, expect, it } from 'vitest';
import { isPublicPath } from './gate';

describe('the sign-in wall', () => {
  it('leaves the home page, the pages about the site, the legal pages and the sign-in return open', () => {
    for (const p of ['/', '/legal/privacy', '/legal/terms', '/about', '/blog', '/blog/some-post', '/features', '/parents', '/help', '/contact', '/wishes', '/auth/callback', '/auth/callback/', '/g/abc123']) expect(isPublicPath(p), p).toBe(true);
  });
  it('closes everything you play, learn or see about players', () => {
    for (const p of ['/play', '/play/fide', '/puzzles', '/puzzles/rush', '/learn', '/analysis', '/games', '/profile', '/leaderboard', '/players/lichess:x', '/friends', '/cups', '/shop', '/admin', '/castleclass', '/settings', '/plans']) expect(isPublicPath(p), p).toBe(false);
  });
  it('does not open a page just because its name starts like a public one', () => {
    for (const p of ['/aboutus', '/helpers', '/gallery', '/authx']) expect(isPublicPath(p), p).toBe(false);
  });
});

/**
 * The sign-in wall (owner, 2026-10-24: "make it compulsory to sign in, remove the guest login"): everything needs an
 * account except the home page, the pages that tell people what Chess Castles is and the legal pages (Google and the
 * app stores must be able to read those), the sign-in return pages and a shared game's link.
 */
const PUBLIC = ['/legal', '/about', '/contact', '/blog', '/features', '/parents', '/help', '/wishes', '/journey', '/auth', '/g'];

export function isPublicPath(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return p === '/' || p === '' || PUBLIC.some((x) => p === x || p.startsWith(`${x}/`));
}

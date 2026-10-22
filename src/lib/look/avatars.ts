/**
 * The pictures a player can choose (static/avatars, made with Runway on 2026-10-22): chess mascots, no faces, the
 * same list as the server's AVATARS (server/api-worker src/social.ts). Names: look.a.<id> in src/lib/i18n.
 */
export const AVATARS = ['knight', 'rook', 'astronaut', 'tiger', 'elephant', 'peacock', 'owl', 'panda', 'lion', 'robot', 'fox', 'dragon', 'cricket', 'wizard', 'turtle', 'queen'] as const;
export const avatarSrc = (id: string) => `/avatars/${id}.webp`;

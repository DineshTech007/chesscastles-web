import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // A single-page app: every route is drawn in the browser, so the site is
    // plain static files (Cloudflare serves index.html for unknown paths).
    adapter: adapter({ fallback: 'index.html', precompress: false }),
    // Checks for a new deploy every 5 minutes (see beforeNavigate in +layout.svelte).
    version: { pollInterval: 300_000 },
    // The first screen's small style files go inside the page (PageSpeed, 2026-10-21: seven of them blocked the
    // first paint on a phone for about 0.6 s). style-src allows inline styles, so the CSP needs nothing more.
    inlineStyleThreshold: 10_240,
    // Content Security Policy (as a <meta> tag; SvelteKit adds the hash of its own
    // start-up script). Scripts only from this site; data only to the services
    // Chess Castles uses. The engines' workers have their own files.
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        // Cloudflare Web Analytics (cookieless) adds its beacon on the live site.
        // Google sign-in loads Google's helper script (apis.google.com) only when used.
        'script-src': ['self', 'wasm-unsafe-eval', 'https://static.cloudflareinsights.com', 'https://apis.google.com', 'sha256-qT4VqrVgPLdR1cMtG7ofsfzNPJAVw6VY7pSXWwXk3CM='],
        'style-src': ['self', 'unsafe-inline'],
        'font-src': ['self', 'data:'],
        'img-src': ['self', 'data:', 'blob:', 'https:'],
        'media-src': ['self', 'data:', 'blob:'],
        'worker-src': ['self', 'blob:'],
        'connect-src': [
          'self',
          'data:',
          'blob:',
          'https://api.chesscastles.com',
          // The Classroom's live rooms (src/lib/classroom).
          'wss://api.chesscastles.com',
          'https://auth.chesscastles.com',
          'https://book.chesscastles.com',
          'https://book2.chesscastles.com',
          'https://book3.chesscastles.com',
          'https://games.chesscastles.com',
          'https://refs.chesscastles.com',
          'https://coach.chesscastles.com',
          'https://lichess.org',
          'https://explorer.lichess.ovh',
          'https://tablebase.lichess.ovh',
          'https://api.chess.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://firestore.googleapis.com',
          'https://firebaseinstallations.googleapis.com',
          'https://www.googleapis.com',
          'https://apis.google.com',
          'https://cloudflareinsights.com',
          // A local API for tests (VITE_API, never set for the live site).
          ...(process.env.VITE_API ? [process.env.VITE_API, process.env.VITE_API.replace(/^http/, 'ws')] : []),
        ],
        'frame-src': ['https://knigh24-af271.firebaseapp.com', 'https://accounts.google.com'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
      },
    },
  },
};

export default config;

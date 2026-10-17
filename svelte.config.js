import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // A single-page app: every route is drawn in the browser, so the site is
    // plain static files (Cloudflare serves index.html for unknown paths).
    adapter: adapter({ fallback: 'index.html', precompress: false }),
    // Content Security Policy (as a <meta> tag; SvelteKit adds the hash of its own
    // start-up script). Scripts only from this site; data only to the services
    // Chess Castles uses. The engines' workers have their own files.
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        // Cloudflare Web Analytics (cookieless) adds its beacon on the live site.
        // Google sign-in loads Google's helper script (apis.google.com) only when used.
        'script-src': ['self', 'wasm-unsafe-eval', 'https://static.cloudflareinsights.com', 'https://apis.google.com', 'sha256-j5nPqXMCNoeedITcSNEBD2Y2h3DlzcSvdUqQLJBUQlg='],
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
          'https://auth.chesscastles.com',
          'https://book.chesscastles.com',
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

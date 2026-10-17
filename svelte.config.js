import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // A single-page app: every route is drawn in the browser, so the site is
    // plain static files (Cloudflare serves index.html for unknown paths).
    adapter: adapter({ fallback: 'index.html', precompress: false }),
  },
};

export default config;

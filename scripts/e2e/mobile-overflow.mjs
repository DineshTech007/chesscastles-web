// Sideways scrolling on phones (owner, 2026-10-23: "left-right scroll is coming in mobile view, also on Home"): every main page,
// signed in as a kid, at 360 and 390 px wide: the page must not be wider than the screen. Lists what sticks out.
//   node scripts/e2e/mobile-overflow.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';

const API_PORT = 8795, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const PAGES = ['/', '/play', '/puzzles', '/puzzles/themes', '/puzzles/rush', '/puzzles/racer', '/learn', '/coach', '/analysis', '/vision', '/books', '/cups', '/shop', '/rewards', '/profile', '/leaderboard', '/friends', '/more', '/settings', '/help', '/games', '/features'];
const LANGX = process.env.LANGX || 'en';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { startWorker } = await import('file:///C:/dev/knight24/server/api-worker/test/harness.mjs');
const server = await startWorker('test/full-entry.ts', API_PORT);
const site = spawn('npx', ['vite', 'dev', '--port', '5173', '--strictPort'], { shell: true, env: { ...process.env, VITE_API: API }, stdio: 'ignore' });
const stopAll = () => (server.stop(), process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(site.pid), '/T', '/F']) : site.kill());
for (let i = 0; !(await fetch(SITE).then((r) => r.ok).catch(() => false)); i++) {
  if (i > 120) (stopAll(), process.exit(2));
  await sleep(500);
}
const api = (method, path, uid, body) => fetch(API + path, { method, headers: { Origin: SITE, Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json().catch(() => ({})));
const uid = 'lichess:overflowkid';
await api('GET', '/social/me', uid);
await api('PUT', '/social/me', uid, { name: 'Overflow Kid' });
await api('GET', '/social/wallet', uid);
const browser = await chromium.launch();
const bad = [];
for (const width of (process.env.WIDTHS || '360,390').split(',').map(Number)) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(([u, LANGX]) => {
    localStorage.setItem('cc.devUid', u);
    localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
    localStorage.setItem('cc.lang', LANGX);
    localStorage.setItem('cc.shopAd.' + u, '1');
    localStorage.setItem('cc.waAsked.' + u, String(Date.now()));
  }, [uid, LANGX]);
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(SITE + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(2500);
    for (let i = 0; i < 3; i++) {
      const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
      if (!(await dlg.isVisible().catch(() => false))) break;
      const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
      else await page.keyboard.press('Escape');
      await sleep(400);
    }
    const r = await page.evaluate(() => {
      const w = innerWidth;
      const doc = document.documentElement;
      const over = doc.scrollWidth - w;
      const out = [];
      if (over > 1) {
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0 || b.right <= w + 1) continue;
          // Inside a scroller of its own (a row that scrolls on purpose): fine.
          let p = el.parentElement, scroller = false;
          while (p && p !== document.body) {
            const o = getComputedStyle(p).overflowX;
            if ((o === 'auto' || o === 'scroll' || o === 'hidden') && p.getBoundingClientRect().right <= w + 1) {
              scroller = true;
              break;
            }
            p = p.parentElement;
          }
          if (scroller) continue;
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed') continue;
          out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter((c) => !c.startsWith('s-')).slice(0, 2).join('.') : ''} → right ${Math.round(b.right)} (+${Math.round(b.right - w)})`);
          if (out.length >= 6) break;
        }
      }
      return { over, out };
    });
    if (r.over > 1) {
      bad.push({ width, path, ...r });
      console.log(`${width}px ${path}: sticks out by ${r.over}px  ${r.out.join(' | ')}`);
    }
  }
  await ctx.close();
}
await browser.close();
stopAll();
console.log(bad.length ? `\n${bad.length} page(s) scroll sideways` : '\nAll good: no page scrolls sideways at 360 or 390 px.');
process.exit(bad.length ? 1 : 0);

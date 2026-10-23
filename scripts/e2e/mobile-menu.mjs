// The phone's menu drawer (owner, 2026-10-23): opens from the header button, the last tab and Home's "All"; lists every page
// by short names; closes when a page is chosen; the Shop is lit on Home; nothing sticks out sideways. 360 and 390 px, signed in.
//   node scripts/e2e/mobile-menu.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('reports/mobile-menu', { recursive: true });
const API_PORT = 8795, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const issues = [];
const issue = (s) => (issues.push(s), console.log('ISSUE: ' + s));
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
const uid = 'lichess:menukid';
await api('GET', '/social/me', uid);
await api('PUT', '/social/me', uid, { name: 'Menu Kid' });
await api('GET', '/social/wallet', uid);
const browser = await chromium.launch();
try {
  for (const width of [360, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript((u) => {
      localStorage.setItem('cc.devUid', u);
      localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
      localStorage.setItem('cc.lang', 'en');
      localStorage.setItem('cc.shopAd.' + u, '1');
      localStorage.setItem('cc.waAsked.' + u, String(Date.now()));
    }, uid);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => issue(`${width}: ${String(e).slice(0, 200)}`));
    await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('.shop-banner, a.banner[href="/shop"]').first().waitFor({ timeout: 60000 }).catch(() => issue(`${width}: no Shop banner on Home`));
    await sleep(3000);
    for (let i = 0; i < 3; i++) {
      const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
      if (!(await dlg.isVisible().catch(() => false))) break;
      const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
      else await page.keyboard.press('Escape');
      await sleep(400);
    }
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sideways > 1) issue(`${width}: Home scrolls sideways by ${sideways}px`);
    // The header's buttons are all on the screen.
    const out = await page.evaluate(() => [...document.querySelectorAll('header.top button, header.top a')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); }).length);
    if (out) issue(`${width}: ${out} header controls are off the screen`);
    await page.screenshot({ path: `reports/mobile-menu/home-${width}.png` });
    // The Shop banner leads to the Shop.
    if (!(await page.locator('a.banner[href="/shop"]').count())) issue(`${width}: the Shop banner is missing`);
    // The header's menu button opens the drawer.
    await page.locator('.menu-btn').click();
    const drawer = page.locator('aside.drawer');
    await drawer.waitFor({ timeout: 5000 }).catch(() => issue(`${width}: the menu button does not open the drawer`));
    await sleep(500);
    const names = await drawer.locator('a.row .nm, button.row .nm').allInnerTexts();
    for (const must of ['Home', 'Shop', 'Play', 'Puzzles', 'Learn', 'Profile', 'Settings', 'Leaderboard', 'Audio Books', 'Blindfold Gym']) if (!names.some((n) => n.trim() === must)) issue(`${width}: the menu has no "${must}" (${names.length} entries)`);
    const longest = Math.max(...names.map((n) => n.length));
    if (longest > 30) issue(`${width}: a menu name is long (${longest} characters)`);
    console.log(`${width}px: menu has ${names.length} entries; longest name ${longest} characters`);
    await page.screenshot({ path: `reports/mobile-menu/menu-${width}.png` });
    // Choosing a page closes it.
    await drawer.getByRole('link', { name: /^Puzzles/ }).first().click();
    await page.waitForURL('**/puzzles', { timeout: 15000 }).catch(() => issue(`${width}: a menu link did not open its page`));
    await sleep(800);
    if (await page.locator('aside.drawer').count()) issue(`${width}: the menu stays open after choosing a page`);
    // The last tab opens it too.
    await page.locator('nav.tabs .tab-btn').click();
    await page.locator('aside.drawer').waitFor({ timeout: 5000 }).catch(() => issue(`${width}: the last tab does not open the drawer`));
    await page.keyboard.press('Escape');
    await sleep(500);
    if (await page.locator('aside.drawer').count()) issue(`${width}: Escape does not close the menu`);
    // Home's "All".
    await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('.all-btn').click({ timeout: 30000 }).catch(() => issue(`${width}: no "All" button on Home`));
    await page.locator('aside.drawer').waitFor({ timeout: 5000 }).catch(() => issue(`${width}: "All" does not open the drawer`));
    await ctx.close();
  }
} catch (e) {
  issue('the test stopped: ' + String(e.stack ?? e).slice(0, 500));
}
await browser.close();
stopAll();
console.log(issues.length ? `${issues.length} issue(s)` : 'All good: the phone menu works at 360 and 390 px.');
process.exit(issues.length ? 1 : 0);

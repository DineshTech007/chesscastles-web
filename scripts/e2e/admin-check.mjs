// The admin page, every tab, as an admin on a computer and on a phone: no errors in the console or from the server, nothing
// sticks out sideways, every tab draws something. Our server (the test setup) and the site run on this PC.
//   node scripts/e2e/admin-check.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('reports/admin', { recursive: true });
const API_PORT = 8795, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const TABS = ['dashboard', 'registrations', 'players', 'castleclass', 'fairplay', 'plans', 'reports', 'feedback', 'wishes', 'whatsapp', 'team'];
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
const uid = 'lichess:owner-test';
const api = (method, path, body) => fetch(API + path, { method, headers: { Origin: SITE, Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json().catch(() => ({})));
await api('GET', '/social/me');
await api('PUT', '/social/me', { name: 'Owner Test' });
// A few players and some activity, so the tabs have something to show.
for (const [i, n] of ['lichess:adminkid1', 'lichess:adminkid2', 'lichess:adminkid3'].entries()) {
  await fetch(API + '/social/me', { headers: { Origin: SITE, Authorization: `Bearer ${n}` } });
  await fetch(API + '/social/me', { method: 'PUT', headers: { Origin: SITE, Authorization: `Bearer ${n}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Admin Kid ${i + 1}` }) });
}
const browser = await chromium.launch();
try {
  for (const view of [{ label: 'computer', viewport: { width: 1366, height: 860 } }, { label: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
    const { label, ...opts } = view;
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript((u) => {
      localStorage.setItem('cc.devUid', u);
      localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
      localStorage.setItem('cc.lang', 'en');
      localStorage.setItem('cc.shopAd.' + u, '1');
      localStorage.setItem('cc.waAsked.' + u, String(Date.now()));
    }, uid);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('page error: ' + String(e).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && !/CORS|ERR_FAILED|firebase|googleapis|lichess|onnxruntime|Failed to load resource: net::ERR/i.test(m.text()) && errs.push('console: ' + m.text().slice(0, 200)));
    page.on('response', (r) => r.status() >= 500 && errs.push(`${r.status()} ${r.url().replace(API, '')}`));
    await page.goto(SITE + '/admin', { waitUntil: 'domcontentloaded' });
    await page.locator('main').waitFor({ timeout: 60000 });
    await sleep(4000);
    for (let i = 0; i < 3; i++) {
      const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
      if (!(await dlg.isVisible().catch(() => false))) break;
      const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
      else await page.keyboard.press('Escape');
      await sleep(400);
    }
    for (const tab of TABS) {
      const before = errs.length;
      await page.goto(`${SITE}/admin#${tab}`, { waitUntil: 'domcontentloaded' });
      await sleep(2500);
      const text = (await page.locator('main').innerText().catch(() => '')).trim();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const cut = await page.evaluate(() => [...document.querySelectorAll('main button, main .chip, main .pill, main th, main td')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && getComputedStyle(e).textOverflow !== 'ellipsis').length);
      if (text.length < 40) issue(`${label}/${tab}: the tab is nearly empty ("${text.slice(0, 60)}")`);
      if (over > 1) issue(`${label}/${tab}: scrolls sideways by ${over}px`);
      if (cut) issue(`${label}/${tab}: ${cut} controls cut their text`);
      for (const e of errs.slice(before)) issue(`${label}/${tab}: ${e}`);
      await page.screenshot({ path: `reports/admin/${label}-${tab}.png` });
      console.log(`${label}/${tab}: ${text.length} characters${over > 1 ? ` SIDEWAYS ${over}` : ''}`);
    }
    await ctx.close();
  }
} catch (e) {
  issue('the test stopped: ' + String(e.stack ?? e).slice(0, 500));
}
await browser.close();
stopAll();
console.log(issues.length ? `${issues.length} issue(s)` : 'All good: every admin tab draws, with no errors.');
process.exit(issues.length ? 1 : 0);

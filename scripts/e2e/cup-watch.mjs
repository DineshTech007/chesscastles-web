// Watching a Castle Cup (owner, 2026-10-23): a spectator who is not playing sees every board, engine bars on the live ones, in
// the pairings and on the big board; a player does not see a bar for their own game. Our server and the site run on this PC.
//   node scripts/e2e/cup-watch.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('reports/cup-watch', { recursive: true });
const API_PORT = 8792, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
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
const OWNER = 'lichess:owner-test';
const KIDS = ['lichess:watchk1', 'lichess:watchk2', 'lichess:watchk3', 'lichess:watchk4'];
const SPEC = 'lichess:watchspec';
for (const u of [OWNER, SPEC, ...KIDS]) await api('GET', '/social/me', u);
for (const [i, u] of KIDS.entries()) await api('PUT', '/social/me', u, { name: `Watch Kid ${i + 1}` });
await api('PUT', '/social/me', SPEC, { name: 'Spectator' });
const made = await api('POST', '/cup/flash', OWNER, { minutes: 3, inc: 0, startIn: 2 });
const id = made.id;
for (const u of KIDS) await api('POST', `/cup/${id}/join`, u);
// The kids' pages must be open for them to be paired: sockets from here.
const sockets = KIDS.map((u) => new WebSocket(`ws://127.0.0.1:${API_PORT}/cup/${id}/live`, ['cc', encodeURIComponent(u)]));
await sleep(1500);
await api('POST', `/cup/${id}/start`, OWNER);
await sleep(1500);
// A few moves in each game, so the boards are not the start position.
const views = [];
sockets.forEach((ws, i) => (ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'cup') views[i] = m; }));
for (const ws of sockets) ws.send(JSON.stringify({ t: 'sync' }));
await sleep(1000);
const view = views.find(Boolean);
for (const g of view.games.filter((g) => g.round === view.round && g.black && !g.bot && !g.result && KIDS.includes(g.white) && KIDS.includes(g.black))) {
  const wi = KIDS.indexOf(g.white), bi = KIDS.indexOf(g.black);
  const seq = [[wi, 'e2e4'], [bi, 'e7e5'], [wi, 'g1f3'], [bi, 'b8c6'], [wi, 'f1c4'], [bi, 'g8f6']];
  for (const [k, uci] of seq) { sockets[k].send(JSON.stringify({ t: 'move', game: g.id, uci })); await sleep(150); }
}
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((u) => {
    localStorage.setItem('cc.devUid', u);
    localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
    localStorage.setItem('cc.lang', 'en');
    localStorage.setItem('cc.shopAd.' + u, '1');
    localStorage.setItem('cc.waAsked.' + u, String(Date.now()));
  }, SPEC);
  const page = await ctx.newPage();
  await page.goto(`${SITE}/cups/${id}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.sidetabs').waitFor({ timeout: 60000 }).catch(() => issue('no tabs on the cup page for a spectator'));
  await sleep(2000);
  for (let i = 0; i < 3; i++) {
    const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
    if (!(await dlg.isVisible().catch(() => false))) break;
    const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
    else await page.keyboard.press('Escape');
    await sleep(400);
  }
  await sleep(9000);
  const boards = await page.locator('.side .card .eb').count();
  const live = await page.locator('.side .card .live').count();
  if (!boards) issue('no engine bars on the small boards');
  const withValue = await page.locator('.side .card .eb:not(.wait)').count();
  console.log(`small boards: ${live} live, ${boards} bars, ${withValue} already looked at`);
  await page.screenshot({ path: 'reports/cup-watch/boards.png' });
  await page.locator('.sidetabs button', { hasText: 'Pairings' }).click();
  await sleep(6000);
  const pb = await page.locator('.side li .eb').count();
  if (!pb) issue('no engine bars in the pairings');
  console.log(`pairings: ${pb} bars`);
  await page.screenshot({ path: 'reports/cup-watch/pairings.png' });
  // The big board: the bar between the players.
  const big = await page.locator('.board .gb .eb').count();
  if (!big) issue('no engine bar on the big board of a watched game');
  console.log(`big board bar: ${big}`);
  await page.screenshot({ path: 'reports/cup-watch/main.png' });
  await ctx.close();
  // A player: no bar for their own game.
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx2.addInitScript((u) => {
    localStorage.setItem('cc.devUid', u);
    localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
    localStorage.setItem('cc.lang', 'en');
    localStorage.setItem('cc.shopAd.' + u, '1');
    localStorage.setItem('cc.waAsked.' + u, String(Date.now()));
  }, KIDS[0]);
  const p2 = await ctx2.newPage();
  await p2.goto(`${SITE}/cups/${id}`, { waitUntil: 'domcontentloaded' });
  await p2.locator('.sidetabs').waitFor({ timeout: 60000 });
  await sleep(9000);
  const own = await p2.locator('.board .gb .eb').count();
  const mineBars = await p2.locator('.side .card.mine .eb').count();
  if (own || mineBars) issue(`a player sees an engine bar for their own game (${own} big, ${mineBars} small)`);
  await ctx2.close();
} catch (e) {
  issue('the test stopped: ' + String(e.stack ?? e).slice(0, 400));
}
sockets.forEach((s) => s.close());
await browser.close();
stopAll();
console.log(issues.length ? `${issues.length} issue(s)` : 'All good: bars for watchers, none in a player’s own game.');
process.exit(issues.length ? 1 : 0);

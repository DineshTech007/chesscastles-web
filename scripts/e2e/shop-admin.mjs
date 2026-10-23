// The Shop for an admin and for a kid (owner, 2026-10-23): an admin buys anything with no gold or gems and can unlock a
// Royal item; wearing an item shows a note in the middle saying where it shows; a Guru is locked for a kid (the chooser
// leads to the Shop) and, once bought, can be chosen; the earn hint shows on the puzzles page.
//   node scripts/e2e/shop-admin.mjs [--out dir]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'reports/shop-admin';
mkdirSync(OUT, { recursive: true });
const API_PORT = 8795, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const ADMIN = { uid: 'lichess:owner-test', name: 'Owner Test', view: { viewport: { width: 1280, height: 860 } } };
const KID = { uid: 'lichess:shopkid1', name: 'Shop Kid', view: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const issues = [];
const issue = (s) => {
  issues.push(s);
  console.log('ISSUE: ' + s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { startWorker } = await import('file:///C:/dev/knight24/server/api-worker/test/harness.mjs');
const server = await startWorker('test/full-entry.ts', API_PORT);
const site = spawn('npx', ['vite', 'dev', '--port', '5173', '--strictPort'], { shell: true, env: { ...process.env, VITE_API: API }, stdio: 'ignore' });
const stopAll = () => {
  server.stop();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(site.pid), '/T', '/F']);
  else site.kill();
};
for (let i = 0; ; i++) {
  if (await fetch(SITE).then((r) => r.ok).catch(() => false)) break;
  if (i > 120) {
    stopAll();
    throw new Error('the site did not start');
  }
  await sleep(500);
}
const api = async (method, path, uid, body) => {
  const r = await fetch(API + path, { method, headers: { Origin: SITE, Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => undefined) };
};
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
async function session(k) {
  await api('GET', '/social/me', k.uid);
  await api('PUT', '/social/me', k.uid, { name: k.name });
  await api('GET', '/social/wallet', k.uid);
  const ctx = await browser.newContext(k.view);
  await ctx.addInitScript((uid) => {
    localStorage.setItem('cc.devUid', uid);
    localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
    localStorage.setItem('cc.lang', 'en');
  }, k.uid);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => issue(`${k.name}: ${String(e).slice(0, 200)}`));
  return { ctx, page };
}
async function closePopups(page) {
  for (let i = 0; i < 4; i++) {
    const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
    if (!(await dlg.isVisible().catch(() => false))) break;
    const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
    if (await close.isVisible().catch(() => false)) await close.click();
    else await page.keyboard.press('Escape');
    await sleep(500);
  }
}
try {
  // ---- the admin
  const a = await session(ADMIN);
  await a.page.goto(SITE + '/shop?tab=gurus', { waitUntil: 'domcontentloaded' });
  await a.page.locator('main').waitFor({ timeout: 60000 });
  await sleep(4000);
  await closePopups(a.page);
  const guruCards = await a.page.locator('main [class*="card"], main button').filter({ hasText: /Anjali|Arjun|Sheru/ }).count();
  if (!guruCards) issue('admin: no Gurus in the Shop');
  await a.page.getByText('Coach Anjali').first().click();
  const buy = a.page.locator('.sheet button.primary').first();
  await buy.waitFor({ timeout: 10000 }).catch(() => issue('admin: no Buy button on a 50-gem Guru with no gems to spare'));
  await buy.click();
  await a.page.locator('.sheet .confirm button.primary').click().catch(() => issue('admin: no confirm step'));
  await sleep(1500);
  const owned = (await api('GET', '/social/wallet', ADMIN.uid)).json?.wallet?.owned ?? [];
  if (!owned.includes('g-anjali')) issue(`admin: the Guru was not bought (owned: ${owned.join(',')})`);
  // Choose it.
  await a.page.getByRole('button', { name: /choose as my guru/i }).click().catch(() => issue('admin: no "Choose as my Guru" after buying'));
  await sleep(800);
  const note = await a.page.locator('.worn').innerText().catch(() => '');
  if (!/Guru/i.test(note)) issue(`admin: no note in the middle after choosing a Guru ("${note.slice(0, 80)}")`);
  await a.page.screenshot({ path: join(OUT, '1-admin-guru.png') });
  // A frame: wear it, the note says where it shows.
  await a.page.goto(SITE + '/shop?tab=frame', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await a.page.getByText('Golden Laurel').first().click();
  await a.page.locator('.sheet button.primary').first().click();
  await a.page.locator('.sheet .confirm button.primary').click();
  await sleep(1500);
  await a.page.getByRole('button', { name: /^wear/i }).first().click().catch(() => issue('admin: no Wear button after buying a frame'));
  await sleep(800);
  const note2 = await a.page.locator('.worn').innerText().catch(() => '');
  if (!/profile picture/i.test(note2)) issue(`admin: the note does not say where a frame shows ("${note2.slice(0, 120)}")`);
  await a.page.screenshot({ path: join(OUT, '2-admin-frame-note.png') });
  // A Royal item, for testing.
  await a.page.goto(SITE + '/shop?tab=frame&item=centurion', { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await a.page.getByRole('button', { name: /unlock it \(admin test\)/i }).click().catch(() => issue('admin: no "Unlock it (admin test)" on a Royal item'));
  await sleep(1500);
  if (!((await api('GET', '/social/wallet', ADMIN.uid)).json?.wallet?.owned ?? []).includes('centurion')) issue('admin: the Royal item was not taken');
  // Give a kid gems from the admin API (the Players page uses the same call).
  await api('GET', '/social/me', KID.uid);
  const give = await api('POST', '/social/wallet/give', ADMIN.uid, { to: KID.uid, gems: 60 });
  if (give.status !== 200) issue('admin: giving gems failed ' + JSON.stringify(give.json));

  // ---- the kid
  const k = await session(KID);
  await k.page.goto(SITE + '/coach', { waitUntil: 'domcontentloaded' });
  await k.page.locator('main').waitFor({ timeout: 60000 });
  await sleep(4000);
  await closePopups(k.page);
  const earn = await k.page.locator('.earn').first().innerText().catch(() => '');
  if (!/earn here/i.test(earn)) issue('kid: no "You earn here" hint on the Coach page');
  await k.page.getByRole('button', { name: /change coach/i }).click();
  const locks = await k.page.locator('.vtag.lock').count();
  if (locks < 8) issue(`kid: only ${locks} locked Gurus in the chooser (want 9)`);
  await k.page.locator('.face.locked').first().click();
  await k.page.waitForURL('**/shop**', { timeout: 10000 }).catch(() => issue('kid: a locked Guru does not lead to the Shop'));
  await k.page.screenshot({ path: join(OUT, '3-kid-locked-guru.png') });
  const shopText = (await k.page.locator('.sheet').innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (!/Guru|Hoot|Gaja|Robo|Knight|Rohan|Meera|Sheru|Anjali|Arjun/.test(shopText)) issue('kid: the Shop did not open on the Guru');
  console.log('kid sheet:', shopText.slice(0, 140));
  await k.page.goto(SITE + '/puzzles', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const earn2 = await k.page.locator('.earn').first().innerText().catch(() => '');
  if (!/earn here/i.test(earn2) || !/today/i.test(earn2)) issue(`kid: no earn hint with today's count on Puzzles ("${earn2.replace(/\s+/g, ' ').slice(0, 100)}")`);
  console.log('puzzles hint:', earn2.replace(/\s+/g, ' ').slice(0, 160));
} catch (e) {
  issue('the test stopped: ' + String(e.stack ?? e).slice(0, 500));
}
await browser.close();
stopAll();
console.log(issues.length ? `\n${issues.length} issue(s)` : '\nAll good: the Shop works for an admin and a kid.');
process.exit(issues.length ? 1 : 0);

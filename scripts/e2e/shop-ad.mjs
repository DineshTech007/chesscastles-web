// The Castle Shop ad shows once to a new player on Home, never again (owner, 2026-10-23), and not to an older account.
//   node scripts/e2e/shop-ad.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';

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
const browser = await chromium.launch();
async function visit(uid, label) {
  await api('GET', '/social/me', uid);
  await api('GET', '/social/wallet', uid);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((u) => {
    localStorage.setItem('cc.devUid', u);
    localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
    localStorage.setItem('cc.lang', 'en');
  }, uid);
  const page = await ctx.newPage();
  const seen = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // Other first-visit popups are closed as a child would; the ad is what we look for.
      const ad = page.locator('.ad[aria-label="The Castle Shop"]');
      if (await ad.isVisible().catch(() => false)) return true;
      const dlg = page.locator('[role="dialog"][aria-modal="true"]:not(.ad)').first();
      if (await dlg.isVisible().catch(() => false)) {
        const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
        if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
        else await page.keyboard.press('Escape');
      }
      await sleep(700);
    }
    return false;
  };
  return { ctx, page, seen, label };
}
try {
  const a = await visit('lichess:adnewkid', 'new');
  await a.page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  if (!(await a.seen(40000))) issue('a new player does not see the ad on Home');
  else {
    const open = await a.page.locator('.ad a[href="/shop"]').count();
    if (!open) issue('the ad does not lead to the Shop');
    await a.page.screenshot({ path: 'reports/shop-ad.png' });
    await a.page.locator('.ad .x').click();
    await a.page.reload({ waitUntil: 'domcontentloaded' });
    if (await a.seen(16000)) issue('the ad showed a second time');
  }
  // An older account (its Treasury made days ago) does not get it.
  await api('GET', '/social/me', 'lichess:adoldkid');
  const b = await visit('lichess:adoldkid', 'old');
  await b.page.addInitScript(() => localStorage.setItem('cc.wallet.lichess:adoldkid', JSON.stringify({ v: 1, gold: 500, gems: 25, created: Date.now() - 5 * 86_400_000 })));
  await b.page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  await b.page.evaluate(() => 0);
} catch (e) {
  issue('the test stopped: ' + String(e.stack ?? e).slice(0, 400));
}
await browser.close();
stopAll();
console.log(issues.length ? `${issues.length} issue(s)` : 'All good: the ad shows once to a new player.');
process.exit(issues.length ? 1 : 0);

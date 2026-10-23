// Home's "Richest castles" (owner, 2026-10-23): the gold and gems boards and the Castle Shop progress, for a signed-in
// kid, on a phone and a computer. Our server (the test setup) and the site run on this PC.
//   node scripts/e2e/home-boards.mjs [--out dir]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'reports/home-boards';
mkdirSync(OUT, { recursive: true });
const API_PORT = 8794, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const KIDS = [
  { uid: 'lichess:boardkid1', name: 'Board Kid One', view: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { uid: 'lichess:boardkid2', name: 'Board Kid Two', view: { viewport: { width: 1366, height: 860 } } },
];
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
const day = new Date().toISOString().slice(0, 10);
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
try {
  for (const k of KIDS) {
    await api('GET', '/social/me', k.uid);
    await api('PUT', '/social/me', k.uid, { name: k.name });
    await api('GET', '/social/wallet', k.uid);
  }
  // Kid One has earned a lot of gold; Kid Two a little.
  const events = Array.from({ length: 20 }, (_, i) => ({ kind: 'win', ref: `g:${i}` }));
  await api('POST', '/social/wallet/earn', KIDS[0].uid, { day, events });
  await api('POST', '/social/wallet/earn', KIDS[1].uid, { day, events: [{ kind: 'win', ref: 'g:x' }] });
  // Kid One has gems (levels pay them).
  for (const k of KIDS) {
    const ctx = await browser.newContext(k.view);
    await ctx.addInitScript((uid) => {
      localStorage.setItem('cc.devUid', uid);
      localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'minor' }));
    }, k.uid);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
    await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('section.tb').waitFor({ timeout: 60000 }).catch(() => issue(`${k.name}: no "Richest castles" card on Home`));
    await page.locator('section.tb ol li').first().waitFor({ timeout: 20000 }).catch(() => issue(`${k.name}: the gold board is empty`));
    const names = await page.locator('section.tb ol li .n').allInnerTexts();
    if (names[0] !== KIDS[0].name) issue(`${k.name}: the gold board's first is "${names[0]}", not ${KIDS[0].name} (${names.join(', ')})`);
    const mine = (await page.locator('section.tb .mine').innerText().catch(() => '')).trim();
    if (!/#\d/.test(mine)) issue(`${k.name}: no own place shown ("${mine}")`);
    const shop = (await page.locator('section.tb .shop').innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (!/items collected/i.test(shop) || !/Next goal/i.test(shop)) issue(`${k.name}: the Shop progress is missing ("${shop.slice(0, 160)}")`);
    await page.locator('section.tb .tabs button').nth(1).click();
    await sleep(1500);
    const gemsText = (await page.locator('section.tb ol, section.tb .empty').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log(`${k.name}: gold board [${names.join(', ')}]; ${mine}; shop: ${shop.slice(0, 110)}; gems tab: ${gemsText.slice(0, 80)}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (wide) issue(`${k.name}: the page scrolls sideways`);
    await page.locator('section.tb').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, `${k.uid.split(':')[1]}.png`) });
    for (const e of errors) issue(`${k.name}: ${e}`);
    await ctx.close();
  }
} catch (e) {
  issue('the test stopped: ' + String(e.stack ?? e).slice(0, 500));
}
await browser.close();
stopAll();
console.log(issues.length ? `\n${issues.length} issue(s)` : '\nAll good: Home shows the boards and the Shop progress.');
process.exit(issues.length ? 1 : 0);

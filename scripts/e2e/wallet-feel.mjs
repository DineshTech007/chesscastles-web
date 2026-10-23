// Does a reward feel earned? A win is recorded (the dev hook window.__treasury, as the Racer page's __race) and the
// corner wallet is watched on a phone: its number must climb through values in between (not jump), and a toast and
// flying coins must show. Run against `vite dev` (the hook exists only there).
//   node scripts/e2e/wallet-feel.mjs [base-url]
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://localhost:5175').replace(/\/$/, '');
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
  localStorage.setItem('cc.lang', 'en');
});
const page = await ctx.newPage();
await page.goto(BASE + '/puzzles', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__treasury, null, { timeout: 30000 });
await page.waitForTimeout(4000);
for (let i = 0; i < 4; i++) {
  const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
  if (!(await dlg.isVisible().catch(() => false))) break;
  const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}
const read = () => page.evaluate(() => document.querySelector('[data-coin-target] .num')?.textContent ?? '');
const before = await read();
await page.evaluate(() => window.__treasury.record([{ kind: 'win', ref: 'feel:' + Date.now() }]));
const seen = [];
for (let i = 0; i < 10; i++) {
  seen.push(await read());
  await page.waitForTimeout(50);
}
const deltaNow = await page.evaluate(() => [...document.querySelectorAll('.wallet .d')].map((e) => e.textContent).join(' ')); 
const toast = await page.locator('.toast').count();
const flyers = await page.evaluate(() => document.querySelectorAll('.cc-flyer').length);
await page.screenshot({ path: 'reports/wallet-feel.png' });
console.log(`before ${before}; then ${[...new Set(seen)].join(' → ')}; toasts ${toast}; flying coins now ${flyers}; floating delta: "${deltaNow}"`);
await browser.close();

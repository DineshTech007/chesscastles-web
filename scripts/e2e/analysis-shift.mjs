// The analysis board on a phone must not move when the engine's lines come and go (owner, 2026-10-23: "if I click on
// next move the screen blinks"). Plays a few moves on the board, steps through it with "Next move" and samples
// the board's top edge and the evaluation bar every 40 ms: the board may not shift, the bar may not jump to the middle.
//   node scripts/e2e/analysis-shift.mjs [base-url]
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '');
const MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
  localStorage.setItem('cc.lang', 'en');
});
const page = await ctx.newPage();
await page.goto(`${BASE}/analysis`, { waitUntil: 'domcontentloaded' });
await page.locator('cg-board').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(6000);
// Popups of a first visit, closed as a child would.
for (let i = 0; i < 4; i++) {
  const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
  if (!(await dlg.isVisible().catch(() => false))) break;
  const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}
// The moves, tapped on the board (white at the bottom).
for (const u of MOVES) {
  const box = await page.locator('.board-col cg-board').first().boundingBox();
  const sq = (name) => ({ x: box.x + (box.width / 8) * (name.charCodeAt(0) - 97 + 0.5), y: box.y + (box.height / 8) * (8 - Number(name[1]) + 0.5) });
  const a = sq(u.slice(0, 2)), b = sq(u.slice(2, 4));
  await page.touchscreen.tap(a.x, a.y);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(b.x, b.y);
  await page.waitForTimeout(500);
}
await page.screenshot({ path: 'reports/analysis-shift.png' });
const first = page.getByRole('button', { name: 'First move' });
const next = page.getByRole('button', { name: 'Next move' });
await first.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(800);
if (!(await next.isEnabled().catch(() => false))) {
  console.log('FAIL: the game did not load (Next move is disabled)');
  await page.screenshot({ path: 'reports/analysis-shift.png' });
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.__s = [];
  const t = setInterval(() => {
    const b = document.querySelector('.board-col cg-board')?.getBoundingClientRect();
    const w = document.querySelector('.h-white')?.getBoundingClientRect();
    const bar = document.querySelector('.h-bar')?.getBoundingClientRect();
    window.__s.push({ y: b ? Math.round(b.top * 10) / 10 : -1, share: w && bar ? Math.round((w.width / bar.width) * 100) : -1 });
  }, 40);
  window.__stop = () => clearInterval(t);
});
for (let i = 0; i < 8; i++) {
  await next.click();
  await page.waitForTimeout(900);
}
const s = await page.evaluate(() => {
  window.__stop();
  return window.__s;
});
const ys = s.map((x) => x.y).filter((y) => y >= 0);
const shift = Math.max(...ys) - Math.min(...ys);
// The bar may move by an evaluation, never to the middle (50) and back at each step: count passes through 49-51 from far away.
const shares = s.map((x) => x.share).filter((x) => x >= 0);
let jumps = 0;
for (let i = 1; i < shares.length; i++) if (Math.abs(shares[i] - shares[i - 1]) > 25) jumps++;
console.log(`${s.length} samples: board top moved ${shift}px (${Math.min(...ys)}–${Math.max(...ys)}); eval bar jumped ${jumps} time(s)`);
await page.screenshot({ path: 'reports/analysis-shift.png' });
await browser.close();
if (shift > 1 || jumps > 0) {
  console.log('FAIL: the screen still moves');
  process.exit(1);
}
console.log('All good: the board and the bar stay still while the engine thinks.');

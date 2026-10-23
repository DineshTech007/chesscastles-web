// Does a solved Themed puzzle pay gold? (owner, 2026-10-23: "in theme puzzles the coins are not getting"). The theme's
// puzzle file is replaced by one known puzzle, solved by tapping its answer, and the wallet and the study log are read.
// Run against `vite dev` (window.__treasury exists only there).
//   node scripts/e2e/theme-coins.mjs [base-url]
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://localhost:5175').replace(/\/$/, '');
const list = await (await fetch(`${BASE}/data/puzzles/fork.json`)).json();
const p = list.find((x) => x[2].split(' ').length === 4) ?? list[0];
const moves = p[2].split(' ');
console.log('puzzle', p[0], p[1], moves.join(' '));
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
  localStorage.setItem('cc.lang', 'en');
});
const page = await ctx.newPage();
await page.route('**/data/puzzles/fork.json', (r) => r.fulfill({ json: [p] }));
await page.goto(BASE + '/puzzles/themes?theme=fork', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__treasury, null, { timeout: 30000 });
await page.locator('cg-board piece').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(5000);
for (let i = 0; i < 4; i++) {
  const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
  if (!(await dlg.isVisible().catch(() => false))) break;
  const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}
const gold = () => page.evaluate(() => document.querySelector('[data-coin-target] .num')?.textContent ?? '');
const before = await gold();
const orientation = (await page.locator('.cg-wrap.orientation-black').count()) ? 'black' : 'white';
const tap = async (sq) => {
  const box = await page.locator('cg-board').first().boundingBox();
  const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1;
  const s = box.width / 8;
  await page.mouse.click(box.x + s * ((orientation === 'black' ? 7 - f : f) + 0.5), box.y + s * ((orientation === 'black' ? r : 7 - r) + 0.5));
};
await page.waitForTimeout(2500);
for (let i = 1; i < moves.length; i += 2) {
  await tap(moves[i].slice(0, 2));
  await page.waitForTimeout(250);
  await tap(moves[i].slice(2, 4));
  await page.waitForTimeout(2000);
}
await page.waitForTimeout(3000);
const msg = (await page.locator('.msg[role="status"]').first().innerText().catch(() => '')).trim();
const log = await page.evaluate(() => JSON.parse(localStorage.getItem('k24.study') ?? '[]').map((a) => `${a.kind}:${a.label}`));
console.log(`gold before ${before}, after ${await gold()}; page says "${msg}"; study log: ${JSON.stringify(log)}`);
await page.screenshot({ path: 'reports/theme-coins.png' });
await browser.close();

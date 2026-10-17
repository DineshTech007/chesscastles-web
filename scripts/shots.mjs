// Screenshots of every page at desktop and phone size, plus a short game
// against the FIDE-rated bot, for checking the UI. Needs `vite preview`:
//   PLAYWRIGHT_BROWSERS_PATH=F:/dev/.pw-browsers node scripts/shots.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

const pages = ['/', '/play', '/play?mode=computer', '/analysis', '/puzzles', '/watch', '/games', '/learn', '/more'];
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

const browser = await chromium.launch();
const errors = [];
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} ${page.url()}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} ${page.url()} console: ${m.text()}`));
  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const file = `${OUT}/${name}-${path.replace(/[/?=]/g, '_') || 'home'}.png`;
    await page.screenshot({ path: file, fullPage: name === 'phone' ? false : true });
  }

  if (name === 'desktop') {
    // A FIDE-rated game: play 1.e4 by clicking, wait for the bot.
    await page.goto(`${BASE}/play/fide?r=1800&tc=0&c=white`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const board = await page.locator('cg-board').boundingBox();
    const sq = (file, rank) => ({
      x: board.x + (file + 0.5) * (board.width / 8),
      y: board.y + (7 - rank + 0.5) * (board.height / 8),
    });
    const e2 = sq(4, 1);
    const e4 = sq(4, 3);
    await page.mouse.click(e2.x, e2.y);
    await page.mouse.click(e4.x, e4.y);
    await page.waitForTimeout(4500);
    const g1 = sq(6, 0);
    const f3 = sq(5, 2);
    await page.mouse.click(g1.x, g1.y);
    await page.mouse.click(f3.x, f3.y);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/desktop-game-after-e4.png` });
    const moves = await page.locator('.moves .mv').allInnerTexts();
    console.log('moves on the board:', moves.filter(Boolean).join(' '));
    const note = await page.locator('.note').allInnerTexts();
    console.log('source note:', note.join(' | '));
  }
  if (name === 'desktop') {
    // The database tab on the analysis board, and the light theme.
    await page.goto(`${BASE}/analysis`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'FIDE games' }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/desktop-analysis-database.png` });
    await page.getByRole('button', { name: 'Light theme' }).click();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/desktop-home-light.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');

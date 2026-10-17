// Screens the game review's "Every move" report on a sample game (the Fried Liver).
// Run: node scripts/flow-review.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  localStorage.setItem('k24.myGames', JSON.stringify([{ id: 'test-game', playedAt: Date.now(), kind: 'computer', white: 'You', black: 'Stockfish', userSide: 'white', result: '1-0', reason: 'resignation', timeControl: '10+0', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','f3g5','d7d5','e4d5','f6d5','g5f7','e8f7','d1f3','f7e6','b1c3','c6b4','e1g1','c7c6','d2d4','b4c2','c4d5','c6d5','f3f5','e6d6','d4e5','d6c7','e5e6','c2a1','f5f7','c7b8'] }]));
});
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
const t0 = Date.now();
await page.goto(base + '/coach/review/test-game');
await page.waitForSelector('.report', { timeout: 240000 });
console.log('analysed in', Math.round((Date.now() - t0) / 1000), 's');
const badges = await page.$$eval('.mv', (els) => els.map((e) => e.textContent.trim() + ':' + (e.querySelector('svg')?.getAttribute('aria-label') ?? 'good')));
console.log(badges.join('  '));
await page.click('[data-move="10"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/review-moves.png` });
// A fresh phone-sized load.
const phone = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
const p2 = await phone.newPage();
await p2.addInitScript((g) => localStorage.setItem('k24.myGames', g), await page.evaluate(() => localStorage.getItem('k24.myGames')));
await p2.goto(base + '/coach/review/test-game');
await p2.waitForSelector('.report', { timeout: 240000 });
await p2.click('[data-move="12"]');
await p2.waitForTimeout(500);
await p2.screenshot({ path: `${out}/review-mobile.png` });
await b.close();

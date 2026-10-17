// Screens the Community page, Learn (study plan and courses), a junior's FIDE page and Analyse with move badges.
// Run: node scripts/flow-wave3.mjs https://knight24-web.knight24.workers.dev out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  if (localStorage.getItem('k24.myGames')) return;
  localStorage.setItem('k24.myGames', JSON.stringify([{ id: 'fried', playedAt: Date.now(), kind: 'computer', white: 'You', black: 'Stockfish', userSide: 'white', result: '1-0', reason: '', timeControl: '10+0', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','f3g5','d7d5','e4d5','f6d5','g5f7','e8f7','d1f3','f7e6','b1c3','c6b4','e1g1','c7c6','d2d4','b4c2','c4d5','c6d5','f3f5','e6d6','d4e5','d6c7','e5e6','c2a1','f5f7','c7b8'] }]));
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const shot = async (url, name, wait = 2500, fn) => {
  await page.goto(base + url);
  await page.waitForTimeout(wait);
  if (fn) await fn();
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
};
await shot('/community', 'community', 4000);
console.log('community:', (await page.locator('.count').innerText().catch(() => 'none')));
await shot('/community?tab=coaches', 'coaches', 3000);
await shot('/learn', 'learn', 2500);
await shot('/ratings/player/48779431', 'junior', 4000);
console.log('junior:', (await page.locator('h1').innerText().catch(() => 'none')));
await page.goto(base + '/analysis?game=fried');
await page.waitForSelector('.report', { timeout: 120000 }).catch(() => console.log('no report'));
await page.keyboard.press('Home');
for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/analysis.png` });
await b.close();

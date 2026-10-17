// Screenshots of the new coach: node scripts/flow-coach2.mjs <outDir>
import { chromium } from 'playwright';
const out = process.argv[2];
const base = process.env.BASE ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('NaN') && console.log('console:', m.text().slice(0, 160)));
await page.goto(base + '/');
// A saved game to review: a quick loss with a blunder.
await page.evaluate(() => {
  localStorage.setItem('k24.coach.v2', JSON.stringify({ lang: 'mr', voice: false, voices: {}, done: {}, rating: 1200 }));
  localStorage.setItem('k24.myGames', JSON.stringify([{ id: 'test-game', playedAt: Date.now(), kind: 'computer', white: 'You', black: 'Stockfish', userSide: 'white', result: '0-1', reason: 'checkmate', timeControl: '10+0', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','f3g5','d7d5','e4d5','f6d5','g5f7','e8f7','d1f3','f7e6','b1c3','c6b4','e1g1','c7c6','d2d4','b4c2','c4d5','c6d5','f3f5','e6d6','d4e5','d6c7','e5e6','c2a1','f5f7','c7b8'] }]));
});
const shot = async (path, name, wait = 2500) => {
  await page.goto(base + path);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'ok');
};
await shot('/coach', 'c-index');
await shot('/coach/knight-forks', 'c-forks');
await page.getByRole('button', { name: 'Next' }).click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Next' }).click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Next' }).click(); await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/c-forks-move.png` });
await shot('/coach/lucena', 'c-lucena');
await page.getByRole('button', { name: 'Next' }).click(); await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/c-lucena-line.png` });
await shot('/coach/najdorf', 'c-najdorf', 4000);
await page.getByRole('button', { name: 'Next' }).click(); await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/c-najdorf-move.png` });
await shot('/coach/practice?fen=' + encodeURIComponent('8/8/8/4k3/8/8/8/3QK3 w - - 0 1') + '&side=white&from=queen-mate', 'c-practice');
await page.goto(base + '/coach/review/test-game');
await page.waitForFunction(() => !document.querySelector('[role=progressbar]'), null, { timeout: 180000 }).catch(() => console.log('review timeout'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/c-review.png` });
for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Next' }).click(); await page.waitForTimeout(2500); }
await page.screenshot({ path: `${out}/c-review-3.png` });
await browser.close();

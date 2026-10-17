// Screens the coach chooser, the profile page (KFIDE, photo) and move navigation in a FIDE game.
// Run: node scripts/flow-profile.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  if (localStorage.getItem('k24.myGames')) return;
  const g = (i, result, opp) => ({ id: 'k' + i, playedAt: Date.now() - (10 - i) * 3600e3, kind: 'fide', white: 'You', black: `FIDE ${opp}`, userSide: 'white', result, reason: '', timeControl: '15+10', opponentRating: opp, startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4', 'e7e5'] });
  localStorage.setItem('k24.myGames', JSON.stringify([g(1, '1-0', 1800), g(2, '1/2-1/2', 1800), g(3, '0-1', 1900), g(4, '1-0', 1700), g(5, '1-0', 1600), g(6, '0-1', 2000)]));
  localStorage.setItem('k24.playSetup', JSON.stringify({ mode: 'fide', rating: 1800, myRating: 1600, tc: 2 }));
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(base + '/coach');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/coach-chooser.png` });
await page.goto(base + '/profile');
await page.waitForTimeout(800);
await page.setInputFiles('#photo-file', process.argv[4] ?? `${out}/../ph-check.png`);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/profile.png`, fullPage: true });
// A FIDE game: play two moves, then look back.
await page.goto(base + '/play/fide?r=1800&tc=0&c=white');
await page.waitForSelector('cg-board');
const board = page.locator('cg-board');
const at = async (f, r) => { const box = await board.boundingBox(); const s = box.width / 8; return { x: s * (f + 0.5), y: s * (7 - r + 0.5) }; };
const move = async (a, c) => { await board.click({ position: await at(...a) }); await page.waitForTimeout(120); await board.click({ position: await at(...c) }); };
await move([4, 1], [4, 3]);
page.on('console', (m) => m.type() !== 'debug' && console.log('console:', m.text().slice(0, 160)));
await page.waitForFunction(() => document.querySelectorAll('.moves .mv:not(:empty)').length >= 2, null, { timeout: 30000 }).catch(async () => {
  console.log('no reply; moves:', await page.locator('.moves').innerText());
  await page.screenshot({ path: `${out}/game-fail.png` });
});
await move([6, 0], [5, 2]);
await page.waitForFunction(() => document.querySelectorAll('.moves .mv:not(:empty)').length >= 4, null, { timeout: 60000 }).catch(async () => {
  console.log('no 2nd reply; moves:', (await page.locator('.moves').innerText()).replace(/\s+/g, ' '));
  await page.screenshot({ path: `${out}/game-fail.png` });
});
await page.getByRole('button', { name: 'Previous move' }).click();
await page.getByRole('button', { name: 'Previous move' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/game-nav.png` });
await b.close();

// Sharing: a game in My games is shared (signed out: the game travels in the link); the link opens the game page.
// Also: the My games page shows the browser's games. Run: node scripts/flow-share.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 860 }, colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.addInitScript(() => {
  if (localStorage.getItem('k24.myGames')) return;
  localStorage.setItem('k24.myGames', JSON.stringify([{ id: 'sh1', playedAt: Date.now(), kind: 'fide', white: 'You', black: 'FIDE 1800', userSide: 'white', result: '1-0', reason: 'Checkmate', timeControl: '5+0', opponentRating: 1800, startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'] }]));
});
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/games');
await p.waitForSelector('.item');
console.log('my games listed:', await p.locator('.item').count());
await p.evaluate(() => { navigator.share = undefined; });
await p.getByRole('button', { name: /Share/ }).first().click();
await p.waitForTimeout(800);
const link = await p.evaluate(() => navigator.clipboard.readText());
console.log('link:', link.slice(0, 70) + '…', '| button:', await p.getByRole('button', { name: /Link copied|Share/ }).first().innerText());
const v = await ctx.newPage();
v.on('pageerror', (e) => console.log('pageerror:', e.message));
await v.goto(link.replace(/^https?:\/\/[^/]+/, base));
await v.waitForSelector('cg-board', { timeout: 15000 });
await v.waitForTimeout(800);
console.log('viewer:', (await v.locator('.head').innerText()).replace(/\s+/g, ' '), '| moves', await v.locator('.moves button').filter({ hasText: /\S/ }).count());
await v.screenshot({ path: `${out}/shared.png` });
await v.getByRole('button', { name: /Review every move/ }).click();
await v.waitForSelector('.tree .mv', { timeout: 15000 });
console.log('opened in analysis:', await v.locator('.page-title').innerText());
await b.close();

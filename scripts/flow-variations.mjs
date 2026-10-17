// Analysis variations: a different move keeps the rest of the game; promote and delete work.
// Run: node scripts/flow-variations.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  localStorage.setItem('k24.myGames', JSON.stringify([{ id: 'fried', playedAt: Date.now(), kind: 'computer', white: 'You', black: 'Stockfish', userSide: 'white', result: '1-0', reason: '', timeControl: '10+0', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','f3g5','d7d5','e4d5','f6d5','g5f7','e8f7','d1f3','f7e6','b1c3','c6b4','e1g1','c7c6','d2d4','b4c2','c4d5','c6d5','f3f5','e6d6','d4e5','d6c7','e5e6','c2a1','f5f7','c7b8'] }]));
});
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/analysis?game=fried');
await p.waitForSelector('.tree .mv');
const count = async () => p.locator('.tree .row .mv:not(.dots)').filter({ hasText: /\S/ }).count();
console.log('main line moves', await count());
// Go to after 5...d5 (10 plies) and play 6.Bxd5 instead? Click the 10th move: d5... use keyboard Home + 10 x ArrowRight.
await p.keyboard.press('Home');
for (let i = 0; i < 8; i++) await p.keyboard.press('ArrowRight');
// After 4...d5: play Nxf7?? no: instead of 5.exd5 play 5.Bxd5? Use d2-d3 by clicking squares.
const board = p.locator('cg-board');
const at = async (sq) => { const box = await board.boundingBox(); const s = box.width / 8; const f = sq.charCodeAt(0) - 97; const r = Number(sq[1]) - 1; return { x: s * (f + 0.5), y: s * (7 - r + 0.5) }; };
await board.click({ position: await at('d2') }); await p.waitForTimeout(150); await board.click({ position: await at('d3') });
await p.waitForTimeout(500);
console.log('after a new move: main line moves', await count(), '| variation text:', await p.locator('.tree .vars').first().innerText().catch(() => 'none'));
console.log('variation bar:', await p.locator('.var-bar').count());
await p.screenshot({ path: `${out}/variation.png` });
await p.getByRole('button', { name: 'Make main line' }).click(); await p.waitForTimeout(300);
console.log('after promote: first rows', (await p.locator('.tree .row').nth(4).innerText()).replace(/\s+/g, ' '), '| vars:', (await p.locator('.tree .vars').first().innerText()).slice(0, 60));
await p.getByRole('button', { name: 'Delete variation' }).count().then((n) => console.log('delete button now', n));
// The old main line is now a variation: click into it, then delete it.
await p.locator('.tree .vars .mv').nth(1).click(); await p.waitForTimeout(200);
await p.getByRole('button', { name: 'Delete variation' }).click(); await p.waitForTimeout(300);
console.log('after delete: vars', await p.locator('.tree .vars').count(), 'moves', await count());
console.log('pgn-able:', await p.evaluate(() => document.querySelector('.tree')?.textContent?.slice(0, 80)));
await b.close();

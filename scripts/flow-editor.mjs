// Analysis board: clear the board and set up a position; import a PGN and a FEN.
// Run: node scripts/flow-editor.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1300, height: 860 }, colorScheme: 'dark' });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/analysis');
await p.waitForSelector('cg-board');
await p.getByRole('button', { name: /Clear \/ set up/ }).click();
await p.getByRole('button', { name: 'Clear board' }).click();
const sq = (s) => p.locator(`.editor .sq[aria-label^="${s}"]`);
await p.getByRole('radio', { name: 'white king' }).click(); await sq('e1').click();
await p.getByRole('radio', { name: 'black king' }).click(); await sq('e8').click();
await p.getByRole('radio', { name: 'white queen' }).click(); await sq('d1').click();
console.log('fen:', await p.locator('.editor .fen').innerText(), '| problem:', await p.locator('.editor .err').innerText().catch(() => 'none'));
await p.screenshot({ path: `${out}/editor.png` });
await p.getByRole('button', { name: 'Analyse this position' }).click();
await p.waitForSelector('cg-board');
await p.waitForTimeout(800);
console.log('pieces after set up:', await p.locator('cg-board piece').count());
// Import a PGN.
await p.getByRole('button', { name: /^Import$/ }).first().click();
await p.fill('#import-text', '[White "Morphy"]\n[Black "Duke & Count"]\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 *');
await p.locator('.import').getByRole('button', { name: 'Import' }).click();
await p.waitForTimeout(800);
console.log('after PGN:', await p.locator('.page-title').innerText(), '| moves', await p.locator('.tree .mv:not(.dots)').filter({ hasText: /\S/ }).count());
// Import a FEN.
await p.getByRole('button', { name: /^Import$/ }).first().click();
await p.fill('#import-text', '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1');
await p.locator('.import').getByRole('button', { name: 'Import' }).click();
await p.waitForTimeout(800);
console.log('after FEN: pieces', await p.locator('cg-board piece').count());
await b.close();

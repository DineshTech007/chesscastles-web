// Books: shelves, and a Wikisource diagram drawn on a board in the reader.
// Run: node scripts/flow-books.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark' });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/books');
await p.waitForSelector('.book');
for (const t of ['Opening', 'Middlegame', 'Endgame', 'General']) {
  await p.getByRole('tab', { name: new RegExp(t) }).click();
  console.log(t, (await p.locator('.book h3').allInnerTexts()).join(' | '));
}
await p.getByRole('tab', { name: /Endgame/ }).click();
await p.screenshot({ path: `${out}/books-endgame.png` });
await p.goto(base + '/books/my-chess-career');
await p.waitForSelector('article.page .pager');
await p.locator('.tools select').first().selectOption('3');
await p.waitForTimeout(1200);
console.log('diagram boards:', await p.locator('figure.k24-diagram cg-board').count(), 'pieces in first:', await p.locator('figure.k24-diagram').first().locator('piece').count());
await p.locator('figure.k24-diagram').first().scrollIntoViewIfNeeded();
await p.screenshot({ path: `${out}/reader-diagram.png` });
await b.close();

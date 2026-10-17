// Analyse layout: the move buttons stay on screen with a long database panel, and arrow keys never scroll the page.
// Run: node scripts/flow-layout.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, name] of [[1600, 900, 'desk'], [1280, 720, 'laptop'], [390, 844, 'phone']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(base + '/analysis?db=1385838&key=830eb9b20758d1de');
  await p.waitForSelector('.tree .mv', { timeout: 20000 });
  await p.waitForTimeout(2500);
  const y0 = await p.evaluate(() => scrollY);
  await p.keyboard.press('Home');
  for (let i = 0; i < 25; i++) await p.keyboard.press('ArrowRight');
  for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(400);
  const y1 = await p.evaluate(() => scrollY);
  const nav = await p.locator('.moves-card .nav').boundingBox();
  console.log(name, 'page scroll before/after arrows', y0, y1, '| nav top/bottom', Math.round(nav.y), Math.round(nav.y + nav.height), 'of', h, nav.y + nav.height <= h ? 'VISIBLE' : 'off screen');
  await p.screenshot({ path: `${out}/layout-${name}.png` });
  await p.close();
}
const p = await b.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: 'dark' });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/books');
await p.waitForSelector('.book');
console.log('books', await p.locator('.book').count());
await p.screenshot({ path: `${out}/books.png` });
await p.goto(base + '/books/chess-fundamentals');
await p.waitForSelector('article.page h2, article.page p');
await p.locator('select').first().selectOption('2');
await p.waitForTimeout(500);
console.log('chapter text', (await p.locator('article.page').innerText()).slice(0, 120).replace(/\s+/g, ' '), '| images', await p.locator('article.page img').count());
await p.screenshot({ path: `${out}/reader.png` });
await p.goto(base + '/books/notation');
await p.waitForSelector('.board .sq');
await p.screenshot({ path: `${out}/notation.png`, fullPage: true });
await b.close();

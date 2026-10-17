// The opening trainer in a real browser: build an opening from the book,
// answer wrong (taken back, "try again"), and the Learn page after.
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const log = (...a) => console.log('•', ...a);

await page.goto(`${BASE}/learn/openings/italian`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '4 moves' }).click();
const t0 = Date.now();
await page.getByRole('button', { name: /Build and start training/ }).click();
await page.waitForSelector('.prompt', { timeout: 60000 });
log(`built in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, await page.locator('.stats').innerText().then((s) => s.replace(/\s+/g, ' ')));
await page.waitForFunction(() => document.querySelector('.prompt')?.textContent?.includes('Your move'), null, { timeout: 10000 });
log('prompt:', await page.locator('.prompt').innerText());

// A move no strong player chooses here: h2-h4.
const box = await page.locator('cg-board').boundingBox();
const click = (f, r) => page.mouse.click(box.x + (f + 0.5) * (box.width / 8), box.y + (7 - r + 0.5) * (box.height / 8));
await click(7, 1);
await click(7, 3);
await page.waitForTimeout(150);
log('after a wrong move:', await page.locator('.prompt').innerText());
await page.waitForTimeout(900);
const h2 = await page.evaluate(() => !!document.querySelector('cg-board piece.white.pawn[style*="translate"]'));
await page.screenshot({ path: 'shots/trainer.png' });
log('line:', await page.locator('.line').innerText().then((s) => s.replace(/\s+/g, ' ')));

await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/learn.png', fullPage: true });
log('italian card:', await page.locator('.o-card').first().innerText().then((s) => s.replace(/\s+/g, ' ')));
await browser.close();
console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no page errors');

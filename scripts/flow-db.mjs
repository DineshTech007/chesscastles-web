// The analysis Database tab: node scripts/flow-db.mjs <outFile>
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto((process.env.BASE ?? 'http://localhost:4173') + '/analysis?fen=rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR%20w%20KQkq%20-%200%202');
await page.getByRole('button', { name: 'Database' }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: process.argv[2] });
// Open the first reference game at this position.
await page.locator('button.ref').first().click();
await page.waitForTimeout(4000);
console.log('opened:', page.url());
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: process.argv[2].replace('.png', '-game.png') });
await browser.close();

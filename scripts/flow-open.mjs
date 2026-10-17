// Opens a database game on the analysis board: node scripts/flow-open.mjs <outFile> <query>
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 200)));
await page.goto((process.env.BASE ?? 'http://localhost:4173') + '/analysis?' + process.argv[3]);
await page.waitForTimeout(5000);
await page.screenshot({ path: process.argv[2], fullPage: true });
await browser.close();

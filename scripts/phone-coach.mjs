// Phone-size screenshots of the coach: node scripts/phone-coach.mjs <outDir>
import { chromium } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const base = process.env.BASE ?? 'http://localhost:4173';
await page.goto(base + '/');
await page.evaluate(() => localStorage.setItem('k24.coach.v1', JSON.stringify({ lang: 'hi', level: 'kid', voice: false, stars: { 'italian-game': 2 } })));
await page.goto(base + '/coach');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/phone-coach.png`, fullPage: true });
await page.goto(base + '/coach/back-rank-mate');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /आगे/ }).click();
await page.waitForTimeout(500);
await page.waitForFunction(() => !document.querySelector('.thinking'), null, { timeout: 30000 }).catch(() => {});
await page.screenshot({ path: `${out}/phone-lesson.png`, fullPage: true });
await browser.close();

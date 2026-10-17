// The Coach page with Marathi selected: node scripts/coach-mr-shot.mjs <outFile>
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const base = process.env.BASE ?? 'http://localhost:4173';
await page.goto(base + '/');
await page.evaluate(() => localStorage.setItem('k24.coach.v1', JSON.stringify({ lang: 'mr', level: 'kid', voice: true, voices: {}, stars: {} })));
await page.goto(base + '/coach');
await page.waitForTimeout(2500);
await page.screenshot({ path: process.argv[2] });
await browser.close();

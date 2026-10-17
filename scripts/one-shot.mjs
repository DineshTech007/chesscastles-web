// One screenshot: node scripts/one-shot.mjs <path> <file> [width] [height]
import { chromium } from 'playwright';
const [path, file, w = '1440', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto((process.env.BASE ?? 'http://localhost:4173') + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: file });
await browser.close();

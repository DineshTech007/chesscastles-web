import { chromium } from 'playwright';
const [path, file, w = '1440', h = '900', theme = ''] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
if (theme) await page.addInitScript((t) => localStorage.setItem('k24.theme', t), theme);
await page.goto((process.env.BASE ?? 'http://localhost:4173') + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: file, fullPage: true });
await browser.close();

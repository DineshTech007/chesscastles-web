// Screenshots of several pages, with console errors: node scripts/pages.mjs <outDir> <path>...
import { chromium } from 'playwright';
const [out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && console.log('  console:', m.text().slice(0, 200)));
page.on('pageerror', (e) => console.log('  pageerror:', e.message.slice(0, 200)));
for (const p of paths) {
  console.log(p);
  await page.goto((process.env.BASE ?? 'http://localhost:4173') + p, { waitUntil: 'networkidle' }).catch((e) => console.log('  goto:', e.message));
  await page.waitForTimeout(2500);
  const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('  url now:', page.url());
}
await browser.close();

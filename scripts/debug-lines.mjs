// Which SVG lines got NaN coordinates: node scripts/debug-lines.mjs <query>
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  const set = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (k, v) {
    if (this.tagName === 'line' && String(v).includes('NaN')) console.log('NaN line', k, new Error().stack.split('\n').slice(2, 6).join(' | '));
    return set.call(this, k, v);
  };
});
page.on('console', (m) => (m.type() === 'error' || m.text().startsWith('NaN')) && console.log(m.type(), m.text().slice(0, 600)));
await page.goto('http://localhost:4173/analysis?' + process.argv[2]);
await page.waitForTimeout(5000);
console.log('-- full-page screenshot now');
await page.screenshot({ path: process.argv[3], fullPage: true });
await page.waitForTimeout(500);
await browser.close();

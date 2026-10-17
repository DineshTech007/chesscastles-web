// Plays 1.e4 and 2.Nf3 several times in the browser and prints the bot's
// replies, to check its choices look like real players'.
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const browser = await chromium.launch();
const lines = [];
for (let i = 0; i < 5; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/fide?r=1800&tc=0&c=white`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const box = await page.locator('cg-board').boundingBox();
  const click = async (f, r) => page.mouse.click(box.x + (f + 0.5) * (box.width / 8), box.y + (7 - r + 0.5) * (box.height / 8));
  await click(4, 1);
  await click(4, 3);
  await page.waitForFunction(() => document.querySelectorAll('.moves .mv').length >= 2 && document.querySelectorAll('.moves .mv')[1].textContent.trim(), null, { timeout: 15000 });
  const sans = await page.locator('.moves .mv').allInnerTexts();
  lines.push(sans.filter((s) => s.trim()).join(' '));
  await ctx.close();
}
await browser.close();
console.log(lines.join('\n'));

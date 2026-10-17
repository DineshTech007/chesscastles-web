// Phone screenshots of pages, for a visual check. Run: node scripts/shot-pages.mjs base out-dir /path1 /path2 …
import { chromium } from 'playwright';
const [base, out, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'dark' });
for (const r of paths) {
  const p = await ctx.newPage();
  await p.goto(base + r);
  await p.waitForTimeout(3000);
  if (r === '/help') { await p.fill('input[aria-label="Your question"]', 'how do I import a game'); await p.keyboard.press('Enter'); await p.waitForTimeout(500); }
  await p.screenshot({ path: `${out}/m${r.replace(/[/?=&]/g, '_')}.png` });
  await p.close();
}
await b.close();

// Practice against Maia-3: download it, play 1.e4 and check it answers.
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 200)));
page.on('worker', (w) => { console.log('worker:', w.url()); w.on('console', (m) => console.log('  worker console:', m.text().slice(0, 200))); });
// The rating to practise against (RATING=2000 also exercises the Stockfish check of Maia's moves).
const rating = Number(process.env.RATING ?? 1200);
await page.addInitScript((r) => localStorage.setItem('k24.coach.v2', JSON.stringify({ lang: 'en', voice: false, voices: {}, done: {}, rating: r })), rating);
await page.goto(base + '/coach/practice?side=white');
await page.waitForTimeout(2000);
const dl = page.getByRole('button', { name: /Download Maia-3/ });
if (await dl.count()) {
  const t = Date.now();
  await dl.click();
  for (let i = 0; i < 48; i++) {
    await page.waitForTimeout(5000);
    const txt = await page.locator('.opponent').innerText();
    if (i % 4 === 0) console.log('  status:', txt.replace(/\s+/g, ' ').slice(0, 120));
    if (txt.includes('learned from millions') || txt.includes('could not start')) break;
  }
  console.log('downloaded and started in', Math.round((Date.now() - t) / 1000), 's');
}
// Play e2-e4 by clicking.
const box = await page.locator('cg-board').boundingBox();
const s = box.width / 8;
const at = (f, r) => ({ x: box.x + s * (f + 0.5), y: box.y + s * (7 - r + 0.5) });
let p = at(4, 1); await page.mouse.click(p.x, p.y); await page.waitForTimeout(150);
p = at(4, 3); await page.mouse.click(p.x, p.y);
const t2 = Date.now();
await page.waitForFunction(() => document.querySelectorAll('.moves span').length >= 2, null, { timeout: 60000 }).catch(() => console.log('no reply'));
console.log('reply in', Date.now() - t2, 'ms; moves:', await page.locator('.moves').innerText().catch(() => ''));
await page.screenshot({ path: process.argv[2] });
await browser.close();

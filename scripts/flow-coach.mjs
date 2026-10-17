// A lesson with Grandmaster Guru: node scripts/flow-coach.mjs <outDir> <lessonId> <lang> [moves...]
// Each move is "wrong:e2e4" or "e2e4"; "next", "quiz:0", "hint" and "ask:text" are actions.
import { chromium } from 'playwright';
const [out, lesson, lang, ...actions] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('NaN') && console.log('console:', m.text().slice(0, 200)));
const base = process.env.BASE ?? 'http://localhost:4173';
await page.goto(base + '/');
await page.evaluate((lang) => localStorage.setItem('k24.coach.v1', JSON.stringify({ lang, level: 'kid', voice: false, stars: {} })), lang);
await page.goto(`${base}/coach/${lesson}`);
await page.waitForTimeout(1500);
const lastGuru = () => page.locator('.line.guru p').last().innerText();
const settle = async () => {
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !document.querySelector('.thinking'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
};
async function square(sq) {
  const box = await page.locator('cg-board').boundingBox();
  const flipped = await page.locator('.cg-wrap.orientation-black').count();
  let f = sq.charCodeAt(0) - 97;
  let r = Number(sq[1]) - 1;
  if (flipped) [f, r] = [7 - f, 7 - r];
  const s = box.width / 8;
  return { x: box.x + s * (f + 0.5), y: box.y + s * (7 - r + 0.5) };
}
let n = 0;
for (const a of actions) {
  n++;
  if (a === 'next') await page.getByRole('button', { name: /Next|आगे|पुढे/ }).first().click();
  else if (a.startsWith('quiz:')) await page.locator('.option').nth(Number(a.slice(5))).click();
  else if (a === 'hint') await page.locator('.hint').click();
  else if (a.startsWith('click:')) await page.getByRole('button', { name: new RegExp(a.slice(6)) }).first().click();
  else if (a.startsWith('ask:')) {
    await page.locator('.ask input').fill(a.slice(4));
    await page.locator('.ask button[type=submit]').click();
  } else {
    const uci = a.replace('wrong:', '');
    const p1 = await square(uci.slice(0, 2));
    const p2 = await square(uci.slice(2, 4));
    await page.mouse.click(p1.x, p1.y);
    await page.waitForTimeout(150);
    await page.mouse.click(p2.x, p2.y);
  }
  await settle();
  if (a.startsWith('wrong:')) await page.waitForTimeout(1800);
  console.log(`[${n}] ${a} -> ${(await lastGuru()).replace(/\s+/g, ' ')}`);
  await page.screenshot({ path: `${out}/coach-${lesson}-${lang}-${n}.png` });
}
await browser.close();

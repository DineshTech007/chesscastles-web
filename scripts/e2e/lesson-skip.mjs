// A lesson must be read, not skipped (owner, 2026-10-23: "I just pressed next next and got the rewards"). Opens a lesson,
// taps Next at once (it must stay on slide 1 and say to listen), waits for the slide's time (Next then works), jumps with
// the progress dots to the last slide (refused), and checks no study reward was logged for the lesson by tapping through.
//   node scripts/e2e/lesson-skip.mjs [base-url]
import { chromium } from 'playwright';

const BASE = (process.argv[2] ?? 'http://localhost:5175').replace(/\/$/, '');
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await ctx.addInitScript(() => {
  localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
  localStorage.setItem('cc.lang', 'en');
  // Voice off: the page does not wait for a speech engine.
  localStorage.setItem('k24.coach', JSON.stringify({ lang: 'en', voice: false, voices: {}, done: {} }));
});
const page = await ctx.newPage();
const problems = [];
const bad = (s) => {
  problems.push(s);
  console.log('ISSUE: ' + s);
};
await page.goto(BASE + '/coach', { waitUntil: 'domcontentloaded' });
const link = page.locator('a[href^="/coach/"]:not([href^="/coach/practice"]):not([href^="/coach/review"])').first();
await link.waitFor({ timeout: 30000 });
const href = await link.getAttribute('href');
await page.goto(BASE + href, { waitUntil: 'domcontentloaded' });
await page.locator('.lesson .nav .next').waitFor({ timeout: 30000 });
const count = async () => (await page.locator('.lesson .count').innerText()).replace(/\s+/g, '');
const first = await count();
console.log('before click:', await page.locator('.lesson .nav .next').evaluate((e) => e.className + ' ' + e.textContent));
await page.locator('.lesson .nav .next').click({ force: true });
await page.waitForTimeout(300);
if ((await count()) !== first) bad(`Next moved on at once (${first} → ${await count()})`);
if (!(await page.locator('.lesson .nudge').count())) bad('no "listen to Guru first" word after an early Next');
// Jump to the last slide by its dot: refused.
const dots = page.locator('.lesson .progress button');
const n = await dots.count();
await dots.nth(n - 1).click({ force: true });
await page.waitForTimeout(300);
if ((await count()).startsWith(`${n}/`)) bad('the last dot opened the last slide at once');
// After the slide's time Next works.
await page.waitForFunction(() => !document.querySelector('.lesson .next.wait'), null, { timeout: 30000 }).catch(() => bad('Next never became ready'));
await page.locator('.lesson .nav .next').click({ force: true });
await page.waitForTimeout(300);
if ((await count()) === first) bad('Next still refused after the slide was read');
// Tapping through every slide as fast as possible must not finish the lesson.
for (let i = 0; i < n + 3; i++) {
  await page.locator('.lesson .nav .next').click({ force: true }).catch(() => {});
  await page.waitForTimeout(120);
}
const done = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('k24.coach') ?? '{}').done ?? {}).length);
if (done) bad('the lesson was marked done by tapping Next');
const study = await page.evaluate(() => (JSON.parse(localStorage.getItem('k24.study') ?? '[]') || []).filter((a) => a.kind === 'lesson').length);
if (study) bad('a lesson reward was logged by tapping Next');
await browser.close();
console.log(problems.length ? `${problems.length} issue(s)` : 'All good: the lesson cannot be finished by tapping Next.');
process.exit(problems.length ? 1 : 0);

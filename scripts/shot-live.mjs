// Screenshots of the live site: laptop dark, laptop light, phone. Run: node scripts/shot-live.mjs https://chesscastles.com out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, name, theme] of [[1366, 768, 'laptop-dark', 'dark'], [1366, 768, 'laptop-light', 'light'], [390, 844, 'phone-dark', 'dark']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((t) => localStorage.setItem('k24.theme', t), theme);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/');
  await p.waitForTimeout(3500);
  console.log(name, 'title:', await p.title(), errs.length ? '| errors: ' + errs.join('; ') : '');
  await p.screenshot({ path: `${out}/live-${name}.png` });
  await ctx.close();
}
await b.close();

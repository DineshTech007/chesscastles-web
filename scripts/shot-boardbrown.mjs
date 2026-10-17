// Preview: the Lichess board brown as the brand colour (buttons, links and logo). The live site is unchanged.
// Run: node scripts/shot-boardbrown.mjs base brand-dir out-dir
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [base, brandDir, out] = process.argv.slice(2);
const css = {
  dark: ':root{--action:#b58863!important;--action-hover:#c39770!important;--on-action:#0b1426!important;--brand:#b58863!important;--accent:#c9a079!important;--gold:#c9a079!important}',
  light: ':root{--accent:#7a5534!important;--gold:#7a5534!important}',
};
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, size, theme] of [[1366, 768, 'laptop', 'dark'], [1366, 768, 'laptop', 'light'], [390, 844, 'phone', 'dark']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((t) => localStorage.setItem('k24.theme', t), theme);
  await ctx.route('**/brand/*.svg', (route) => {
    const name = route.request().url().split('/').pop();
    route.fulfill({ contentType: 'image/svg+xml', body: readFileSync(`${brandDir}/${name}`) });
  });
  const p = await ctx.newPage();
  await p.goto(base + '/');
  await p.addStyleTag({ content: css[theme] });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/bb-${size}-${theme}.png` });
  if (size === 'laptop' && theme === 'dark') {
    await p.goto(base + '/play/fide?r=1600&tc=2');
    await p.addStyleTag({ content: css[theme] });
    await p.waitForSelector('cg-board');
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/bb-game.png` });
  }
  await ctx.close();
}
await b.close();
console.log('ok');

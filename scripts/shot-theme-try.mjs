// Tries other accent colours on the home page (CSS override only; the site is unchanged).
// Run: node scripts/shot-theme-try.mjs base out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const TRIES = {
  amber: { action: '#f0a53a', hover: '#f5b558', on: '#0b1426', accent: '#f0a53a', gold: '#f0a53a' },
  sunset: { action: '#e8892f', hover: '#f09a46', on: '#0b1426', accent: '#ee9a45', gold: '#ee9a45' },
};
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, c] of Object.entries(TRIES)) {
  for (const [w, h, size] of [[1366, 768, 'laptop'], [390, 844, 'phone']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => localStorage.setItem('k24.theme', 'dark'));
    const p = await ctx.newPage();
    await p.goto(base + '/');
    await p.addStyleTag({ content: `:root{--action:${c.action}!important;--action-hover:${c.hover}!important;--on-action:${c.on}!important;--brand:${c.action}!important;--accent:${c.accent}!important;--gold:${c.gold}!important}` });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `${out}/try-${name}-${size}.png` });
    await ctx.close();
  }
}
await b.close();
console.log('ok');

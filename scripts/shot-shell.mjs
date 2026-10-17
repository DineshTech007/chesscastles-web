// The site's frame: sidebar (no scrollbar, one account block), top-right photo and flag, home greeting flag.
// Run: node scripts/shot-shell.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, name] of [[1280, 720, 'laptop'], [1536, 864, 'desk'], [390, 844, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', timezoneId: 'Asia/Kolkata' });
  await ctx.addInitScript(() => {
    if (localStorage.getItem('k24.photo')) return;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#b45309'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fde68a'; g.beginPath(); g.arc(32, 26, 14, 0, 7); g.fill(); g.fillRect(14, 44, 36, 20);
    localStorage.setItem('k24.photo', c.toDataURL('image/jpeg').split(',')[1]);
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(base + '/');
  await p.waitForTimeout(2500);
  const rail = await p.locator('nav.rail').evaluate((n) => ({ scroll: n.scrollHeight > n.clientHeight, navScroll: (n.querySelector('.nav')?.scrollHeight ?? 0) > (n.querySelector('.nav')?.clientHeight ?? 0) })).catch(() => 'no rail');
  console.log(name, 'rail overflow:', JSON.stringify(rail), '| top avatar img:', await p.locator('.top-me img').count(), '| greeting flag:', await p.locator('.h-flag').count());
  await p.screenshot({ path: `${out}/shell-${name}.png` });
  await ctx.close();
}
await b.close();

// Opens every page at laptop and phone size: script errors, failed requests, and pages wider than the screen.
// Run: node scripts/smoke.mjs http://localhost:4173
import { chromium } from 'playwright';
const [base] = process.argv.slice(2);
const ROUTES = ['/', '/play', '/play?mode=online', '/play/tournament', '/play/lichess-tournaments', '/puzzles', '/puzzles/themes', '/learn', '/coach', '/vision', '/vision/blind', '/vision/sprint', '/vision/memory',
  '/books', '/books/chess-fundamentals', '/books/my-chess-career', '/books/notation', '/analysis', '/games', '/insights', '/insights/mistakes', '/watch', '/leaderboard', '/ratings', '/community',
  '/friends', '/profile', '/more', '/about', '/help', '/legal/terms', '/legal/privacy', '/legal/fair-play', '/play/fide?r=1600&tc=2', '/play/computer?l=1600'];
const b = await chromium.launch({ channel: 'chrome' });
let problems = 0;
for (const [w, h, size] of [[1366, 768, 'laptop'], [390, 844, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  for (const r of ROUTES) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 140)));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|ERR_|net::/.test(m.text())) errs.push('console ' + m.text().slice(0, 140)); });
    p.on('response', (res) => { if (res.status() >= 500 && res.url().startsWith(base)) errs.push(`HTTP ${res.status()} ${res.url().replace(base, '')}`); });
    try {
      await p.goto(base + r, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(2500);
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (wide > 2) errs.push(`page is ${wide}px wider than the screen`);
    } catch (e) {
      errs.push('load ' + e.message.slice(0, 120));
    }
    if (errs.length) { problems++; console.log(`${size} ${r}:`, [...new Set(errs)].join(' | ')); }
    await p.close();
  }
  await ctx.close();
}
console.log(problems ? `${problems} page(s) with problems` : 'all pages fine');
await b.close();

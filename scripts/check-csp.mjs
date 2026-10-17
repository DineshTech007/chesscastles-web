// Opens the main pages and lists anything the Content Security Policy blocks
// (and any page error). Run against a build: node scripts/check-csp.mjs [base]
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:4173';
const PAGES = ['/', '/play', '/play?mode=online', '/play/fide?r=1500&tc=0&c=white', '/play/computer?l=1350&c=white', '/analysis', '/analysis?tab=database',
  '/puzzles', '/puzzles/themes', '/learn', '/coach', '/insights', '/vision', '/vision/blind', '/vision/sprint', '/books', '/watch', '/leaderboard',
  '/ratings', '/plans', '/features', '/friends', '/community', '/help', '/about', '/games', '/profile', '/legal/refunds', '/play/lichess-tournaments'];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const problems = [];
let at = '';
page.on('console', (m) => {
  const t = m.text();
  if (/Content Security Policy|Refused to/i.test(t)) problems.push(`${at}: ${t.slice(0, 220)}`);
});
page.on('pageerror', (e) => problems.push(`${at}: page error: ${e.message.slice(0, 200)}`));
for (const p of PAGES) {
  at = p;
  await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch((e) => problems.push(`${p}: ${e.message.slice(0, 120)}`));
  await page.waitForTimeout(p.startsWith('/play/fide') || p.startsWith('/analysis') ? 6000 : 1500);
}
await browser.close();
console.log(problems.length ? [...new Set(problems)].join('\n') : 'no CSP problems on ' + PAGES.length + ' pages');

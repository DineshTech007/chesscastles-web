// The mobile check: opens every main page at phone size (Android 360×800) and
// lists pages wider than the screen, elements sticking out, small tap targets
// and small text, and console errors. Run: node scripts/check-mobile.mjs [base] [shots-folder]
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:4173';
const SHOTS = process.argv[3];
const PAGES = ['/', '/features', '/plans', '/play', '/play/fide?r=1200&tc=1&c=white', '/play/computer?l=1350&c=white', '/puzzles', '/puzzles/themes', '/learn', '/coach',
  '/analysis', '/insights', '/vision', '/vision/blind', '/vision/sprint', '/books', '/books/chess-fundamentals', '/watch', '/leaderboard', '/ratings', '/community',
  '/help', '/feedback', '/about', '/more', '/profile', '/legal/refunds', '/play/lichess-tournaments', '/play/tournament'];
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
let at = '';
const errors = [];
page.on('pageerror', (e) => errors.push(`${at}: ${e.message.slice(0, 160)}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`${at}: ${m.text().slice(0, 160)}`));
for (const p of PAGES) {
  at = p;
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const vw = innerWidth;
    const wide = document.documentElement.scrollWidth;
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
        // Only the outermost element sticking out, and not inside a scroll box.
        let p = el.parentElement, inScroll = false;
        while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) { inScroll = true; break; } p = p.parentElement; }
        if (!inScroll) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → ${Math.round(b.right)}px`);
      }
    }
    const small = [...document.querySelectorAll('a, button, [role=button], input, select')].filter((e) => {
      const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 32 || b.width < 32) && getComputedStyle(e).visibility !== 'hidden';
    }).length;
    const tiny = [...document.querySelectorAll('body *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).length;
    return { wide, vw, out: out.slice(0, 4), small, tiny };
  });
  const flag = r.wide > r.vw ? `  ⚠ page ${r.wide}px wide` : '';
  console.log(`${p}${flag}${r.out.length ? `\n    sticking out: ${r.out.join('; ')}` : ''}  (small targets ${r.small}, text <12px ${r.tiny})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/m${p.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: false });
}
await browser.close();
if (errors.length) console.log('\nErrors:\n' + [...new Set(errors)].slice(0, 20).join('\n'));

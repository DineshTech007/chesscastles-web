// My games at phone and laptop size (seeded games). Run: node scripts/shot-games.mjs base out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, name] of [[390, 844, 'phone'], [1300, 800, 'laptop']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  await ctx.addInitScript(() => {
    const g = (i, res, opp, kind = 'fide') => ({ id: 'x' + i, playedAt: Date.now() - i * 3e6, kind, white: 'You', black: opp, userSide: 'white', result: res, reason: res === '1-0' ? 'Checkmate' : res === '0-1' ? 'Resignation' : 'Threefold repetition', timeControl: '5+0', opponentRating: 1800, startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6'] });
    localStorage.setItem('k24.myGames', JSON.stringify([g(1, '1-0', 'FIDE 2500'), g(2, '0-1', 'Grandmaster Katuru Viyaan Krishna'), g(3, '1/2-1/2', 'FIDE 2000'), g(4, '1-0', 'mariposa_62', 'lichess')]));
  });
  const p = await ctx.newPage();
  await p.goto(base + '/games');
  await p.waitForSelector('.item');
  await p.waitForTimeout(800);
  const overlaps = await p.evaluate(() => [...document.querySelectorAll('.item')].some((li) => {
    const r = [...li.querySelectorAll('.open, .acts > *')].map((e) => e.getBoundingClientRect());
    return r.some((a, i) => r.some((c, j) => i < j && a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1));
  }));
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(name, 'overlapping:', overlaps, '| wider than screen by', wide);
  await p.screenshot({ path: `${out}/games-${name}.png` });
  await ctx.close();
}
await b.close();

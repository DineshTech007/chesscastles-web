// Chess.com Insights tabs + review link, KFIDE speeds on the profile, and a live Lichess game.
// Run: node scripts/flow-insights-live.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  if (localStorage.getItem('k24.myGames')) return;
  const g = (i, tc, res, opp) => ({ id: 'k' + i, playedAt: Date.now() - (10 - i) * 1e6, kind: 'fide', white: 'You', black: 'FIDE ' + opp, userSide: 'white', result: res, reason: '', timeControl: tc, opponentRating: opp, startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', uci: ['e2e4', 'e7e5'] });
  localStorage.setItem('k24.myGames', JSON.stringify([g(1, '5+0', '1-0', 1700), g(2, '5+0', '0-1', 1600), g(3, '5+0', '1-0', 1650), g(4, '15+10', '1/2-1/2', 1800), g(5, '90+30', '0-1', 1900)]));
});
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/profile');
await p.waitForSelector('.kspeed');
console.log('KFIDE cards:', (await p.locator('.kspeeds').innerText()).replace(/\s+/g, ' '));
await p.locator('.kcard').screenshot({ path: `${out}/kfide.png` });
console.log('sidebar chip:', (await p.locator('.me-sub').first().innerText()));

// Live game from Lichess TV.
const tv = await (await fetch('https://lichess.org/api/tv/channels')).json();
await p.goto(base + '/watch/live/' + tv.blitz.gameId);
await p.waitForSelector('cg-board', { timeout: 15000 });
await p.waitForTimeout(4000);
console.log('live:', (await p.locator('.side').innerText()).replace(/\s+/g, ' ').slice(0, 120), '| clocks', await p.locator('.clock').allInnerTexts());
await p.screenshot({ path: `${out}/live.png` });

// Insights.
await p.goto(base + '/insights');
await p.fill('#ins-user', 'hikaru');
await p.selectOption('#ins-count', '10');
await p.getByRole('button', { name: /Analyse my games/ }).click();
await p.waitForSelector('.tabs', { timeout: 240000 });
await p.waitForFunction(() => !document.querySelector('.prog'), null, { timeout: 400000 });
await p.screenshot({ path: `${out}/ins-overview.png`, fullPage: true });
for (const t of ['Weaknesses', 'Games', 'Weekly plan']) {
  await p.getByRole('tab', { name: new RegExp(t) }).click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/ins-${t.split(' ')[0].toLowerCase()}.png`, fullPage: true });
}
await p.getByRole('tab', { name: /Games/ }).click();
await p.getByRole('button', { name: 'Review' }).first().click();
await p.waitForSelector('.tree .mv', { timeout: 20000 });
await p.waitForTimeout(8000);
console.log('analysis title:', await p.locator('.page-title').innerText(), '| moves', await p.locator('.tree .row').count(), '|', (await p.locator('.reviewing, .report').first().innerText().catch(() => '')).replace(/\s+/g, ' '));
await p.screenshot({ path: `${out}/ins-review.png` });
await b.close();

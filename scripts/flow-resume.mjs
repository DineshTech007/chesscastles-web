// A FIDE game survives a closed browser: reopening Knight24 goes straight back to it, moves and clock kept.
// Also: a FIDE tournament starts and opens round 1.
// Run: node scripts/flow-resume.mjs http://localhost:4173 out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1300, height: 860 }, colorScheme: 'dark' });
let p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/play/fide?r=1500&tc=1&c=white');
await p.waitForSelector('cg-board');
const board = p.locator('cg-board');
const at = async (sq) => { const box = await board.boundingBox(); const s = box.width / 8; const f = sq.charCodeAt(0) - 97; const r = Number(sq[1]) - 1; return { x: s * (f + 0.5), y: s * (7 - r + 0.5) }; };
const move = async (a, c) => { await board.click({ position: await at(a) }); await p.waitForTimeout(150); await board.click({ position: await at(c) }); };
await move('e2', 'e4');
await p.waitForFunction(() => document.querySelectorAll('.moves .mv, .move-list button, [class*="mv"]').length >= 2, null, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(6000);
await move('g1', 'f3');
await p.waitForTimeout(6000);
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('k24.resume') ?? 'null'));
console.log('saved moves:', saved?.snapshot.moves.map((m) => m.uci).join(' '), '| route', saved?.route);
const clocksBefore = await p.locator('.clock').allInnerTexts();
await p.close(); // the browser tab is closed mid-game
await new Promise((r) => setTimeout(r, 4000));
p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/');
await p.waitForURL(/resume=1/, { timeout: 15000 }).catch(() => {});
console.log('reopened at:', p.url().replace(base, ''));
await p.waitForSelector('cg-board');
await p.waitForTimeout(2500);
console.log('pieces on board:', await p.locator('cg-board piece').count(), '| clocks before', clocksBefore, 'after', await p.locator('.clock').allInnerTexts());
await p.screenshot({ path: `${out}/resume.png` });
// Leave to Home inside the site: the return bar shows.
await p.goto(base + '/books');
await p.waitForTimeout(800);
console.log('return bar:', (await p.locator('.resume-bar').innerText().catch(() => 'none')).replace(/\s+/g, ' '));
// Tournament (the bot game is finished first, or reopening a page goes back to it).
await p.evaluate(() => localStorage.removeItem('k24.resume'));
await p.goto(base + '/play/tournament');
await p.getByRole('button', { name: /Start the tournament/ }).click();
await p.waitForSelector('.stand', { timeout: 30000 });
console.log('tournament:', (await p.locator('.thead').innerText()).replace(/\s+/g, ' '), '| players', await p.locator('.stand tbody tr').count(), '| next:', (await p.locator('.next').innerText().catch(() => 'bye')).replace(/\s+/g, ' ').slice(0, 120));
await p.screenshot({ path: `${out}/tournament.png`, fullPage: true });
await p.getByRole('button', { name: /Play round 1/ }).click().catch(() => {});
await p.waitForSelector('cg-board', { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(1500);
console.log('round page:', p.url().replace(base, ''), (await p.locator('.round').innerText().catch(() => '')), '| opponent bar:', (await p.locator('.bar .name').first().innerText().catch(() => '')).replace(/\s+/g, ' '));
await p.screenshot({ path: `${out}/tournament-game.png` });
await b.close();

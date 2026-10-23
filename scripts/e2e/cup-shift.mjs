// The cup page must stay still while a game is played (owner, 2026-10-23: "the screen moves up and down for each move").
// Two kids meet in round 1: one in a browser (a phone, then a tablet) taps moves, the other plays from a socket here. After
// each move the board's place on the page and the scroll position are read: neither may jump.
//   node scripts/e2e/cup-shift.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci, makeUci } from 'chessops/util';

mkdirSync('reports/cup-shift', { recursive: true });
const API_PORT = 8792, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const issues = [];
const issue = (s) => (issues.push(s), console.log('ISSUE: ' + s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { startWorker } = await import('file:///C:/dev/knight24/server/api-worker/test/harness.mjs');
const server = await startWorker('test/full-entry.ts', API_PORT);
const site = spawn('npx', ['vite', 'dev', '--port', '5173', '--strictPort'], { shell: true, env: { ...process.env, VITE_API: API }, stdio: 'ignore' });
const stopAll = () => (server.stop(), process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(site.pid), '/T', '/F']) : site.kill());
for (let i = 0; !(await fetch(SITE).then((r) => r.ok).catch(() => false)); i++) {
  if (i > 120) (stopAll(), process.exit(2));
  await sleep(500);
}
const api = (method, path, uid, body) => fetch(API + path, { method, headers: { Origin: SITE, Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json().catch(() => ({})));
const OWNER = 'lichess:owner-test';
const browser = await chromium.launch();
const position = (g) => {
  const pos = Chess.fromSetup(parseFen(g.root).unwrap()).unwrap();
  for (const u of g.moves) pos.play(parseUci(u));
  return pos;
};
const legal = (pos) => {
  const out = [];
  for (const [from, dests] of pos.allDests()) for (const to of dests) out.push({ from, to });
  return out;
};
async function run(label, view, A, B) {
  for (const u of [A, B]) {
    await api('GET', '/social/me', u);
    await api('PUT', '/social/me', u, { name: u.split(':')[1] });
  }
  const made = await api('POST', '/cup/flash', OWNER, { minutes: 5, inc: 0, startIn: 3 });
  const id = made.id;
  for (const u of [A, B]) await api('POST', `/cup/${id}/join`, u);
  const ctx = await browser.newContext(view);
  await ctx.addInitScript((u) => {
    localStorage.setItem('cc.devUid', u);
    localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
    localStorage.setItem('cc.lang', 'en');
    localStorage.setItem('cc.shopAd.' + u, '1');
    localStorage.setItem('cc.waAsked.' + u, String(Date.now()));
  }, A);
  const page = await ctx.newPage();
  await page.goto(`${SITE}/cups/${id}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.wait .in').waitFor({ timeout: 60000 });
  for (let i = 0; i < 3; i++) {
    const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
    if (!(await dlg.isVisible().catch(() => false))) break;
    const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
    else await page.keyboard.press('Escape');
    await sleep(400);
  }
  // A spectator at the same size watches the same game.
  const SPEC = 'lichess:spec' + label;
  await api('GET', '/social/me', SPEC);
  const ctxS = await browser.newContext(view);
  await ctxS.addInitScript((u) => {
    localStorage.setItem('cc.devUid', u);
    localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'adult' }));
    localStorage.setItem('cc.lang', 'en');
    localStorage.setItem('cc.shopAd.' + u, '1');
    localStorage.setItem('cc.waAsked.' + u, String(Date.now()));
  }, SPEC);
  const spec = await ctxS.newPage();
  await spec.goto(`${SITE}/cups/${id}`, { waitUntil: 'domcontentloaded' });
  // B plays from a socket.
  let cup;
  const ws = new WebSocket(`ws://127.0.0.1:${API_PORT}/cup/${id}/live`, ['cc', encodeURIComponent(B)]);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'cup') cup = m;
    else if (m.t === 'move' && cup) {
      const g = cup.games.find((x) => x.id === m.game);
      if (g) (g.moves = [...g.moves, m.uci]), (g.clock = m.clock);
    }
  };
  await sleep(1200);
  await api('POST', `/cup/${id}/start`, OWNER);
  await page.locator('.board cg-board').first().waitFor({ timeout: 30000 });
  await sleep(2500);
  const game = () => cup?.games.find((g) => g.round === 1 && g.black && (g.white === A || g.black === A) && !g.bot);
  const board = page.locator('.board cg-board').first();
  const tap = async (sq, black) => {
    await board.scrollIntoViewIfNeeded();
    const box = await board.boundingBox();
    const f = sq & 7, r = sq >> 3, s = box.width / 8;
    const x = box.x + s * ((black ? 7 - f : f) + 0.5), y = box.y + s * ((black ? r : 7 - r) + 0.5);
    if (view.hasTouch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  await spec.locator('.board cg-board').first().waitFor({ timeout: 30000 }).catch(() => {});
  const specSamples = [];
  const samples = [];
  const sample = async (tag) => samples.push({ tag, ...(await page.evaluate(() => { const b = document.querySelector('.board cg-board').getBoundingClientRect(); return { doc: Math.round((b.top + scrollY) * 10) / 10, scrollY: Math.round(scrollY), h: Math.round(document.documentElement.scrollHeight) }; })) });
  let n = 0;
  for (let step = 0; step < 24 && n < 14; step++) {
    const g = game();
    if (!g || g.result) break;
    const pos = position(g);
    const mover = pos.turn === 'white' ? g.white : g.black;
    const moves = legal(pos);
    const m = moves[Math.floor(Math.random() * moves.length)];
    if (mover === B) {
      ws.send(JSON.stringify({ t: 'move', game: g.id, uci: makeUci(m) }));
      await sleep(700);
    } else {
      await tap(m.from, g.black === A);
      await sleep(150);
      await tap(m.to, g.black === A);
      await sleep(700);
    }
    n++;
    await sample('move ' + n);
    specSamples.push(await spec.evaluate(() => { const b = document.querySelector('.board cg-board')?.getBoundingClientRect(); return b ? { doc: Math.round((b.top + scrollY) * 10) / 10, scrollY: Math.round(scrollY), h: Math.round(document.documentElement.scrollHeight) } : { doc: -1, scrollY: 0, h: 0 }; }));
  }
  ws.close();
  await page.screenshot({ path: `reports/cup-shift/${label}.png` });
  await spec.screenshot({ path: `reports/cup-shift/${label}-spectator.png` });
  await ctxS.close();
  await ctx.close();
  { const d = specSamples.map((s) => s.doc), y = specSamples.map((s) => s.scrollY), h = specSamples.map((s) => s.h); const sp = (a) => Math.max(...a) - Math.min(...a); console.log(`${label} spectator: board moved ${sp(d)} px, scroll ${sp(y)} px, page height changed ${sp(h)} px (${[...new Set(h)].join(', ')})`); if (sp(d) > 2) issue(`${label} spectator: the board moved ${sp(d)} px`); if (sp(h) > 2) issue(`${label} spectator: the page height changed by ${sp(h)} px`); }
  const docs = samples.map((s) => s.doc), ys = samples.map((s) => s.scrollY), hs = samples.map((s) => s.h);
  const spread = (a) => Math.max(...a) - Math.min(...a);
  console.log(`${label}: ${samples.length} moves; board position on the page moved ${spread(docs)} px, scroll moved ${spread(ys)} px, page height changed ${spread(hs)} px`);
  if (spread(docs) > 2) issue(`${label}: the board moved ${spread(docs)} px while playing (${[...new Set(docs)].join(', ')})`);
  if (spread(ys) > 2) issue(`${label}: the page scrolled by itself by ${spread(ys)} px (${[...new Set(ys)].join(', ')})`);
}
try {
  await run('phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'lichess:shiftA', 'lichess:shiftB');
  await run('tablet', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'lichess:shiftC', 'lichess:shiftD');
} catch (e) {
  issue('the test stopped: ' + String(e.stack ?? e).slice(0, 500));
}
await browser.close();
stopAll();
console.log(issues.length ? `${issues.length} issue(s)` : 'All good: the page stays still while a game is played.');
process.exit(issues.length ? 1 : 0);

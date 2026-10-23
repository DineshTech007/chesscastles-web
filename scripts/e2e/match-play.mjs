// A friendly bullet game between two players, played for real on our own server (owner, 2026-10-23: "never redirect
// to Lichess"). Our server and the site run on this PC (the server's test setup). One player (a phone) sends a 1+0
// invite and waits on the game's page; the other (a computer) gets the popup on Home, taps Accept, and both play
// moves by tapping the board; clocks must run, the bar back to the game shows when a page is left, and a resignation ends it.
// Nothing may open lichess.org.
//   node scripts/e2e/match-play.mjs [--out dir]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const OUT = arg('out', 'reports/match-play');
mkdirSync(OUT, { recursive: true });
const API_PORT = 8793, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const P1 = { uid: 'lichess:matchkid1', name: 'Phone Kid', view: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const P2 = { uid: 'lichess:matchkid2', name: 'Computer Kid', view: { viewport: { width: 1366, height: 860 } } };
const issues = [];
const note = (s) => console.log(`${new Date().toISOString().slice(11, 19)} ${s}`);
const issue = (s) => {
  issues.push(s);
  note(`ISSUE: ${s}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { startWorker } = await import('file:///C:/dev/knight24/server/api-worker/test/harness.mjs');
const server = await startWorker('test/full-entry.ts', API_PORT);
note('server up');
const site = spawn('npx', ['vite', 'dev', '--port', '5173', '--strictPort'], { shell: true, env: { ...process.env, VITE_API: API }, stdio: ['ignore', 'pipe', 'pipe'] });
let siteLog = '';
site.stdout.on('data', (d) => (siteLog += d));
site.stderr.on('data', (d) => (siteLog += d));
const stopAll = () => {
  server.stop();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(site.pid), '/T', '/F']);
  else site.kill();
};
for (let i = 0; ; i++) {
  if (await fetch(SITE).then((r) => r.ok).catch(() => false)) break;
  if (i > 120) {
    stopAll();
    throw new Error('the site did not start\n' + siteLog.slice(-1000));
  }
  await sleep(500);
}
note('site up');

const api = async (method, path, uid, body) => {
  const r = await fetch(API + path, { method, headers: { Origin: SITE, Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: r.status, json, text };
};
function watch(uid, id) {
  const state = { game: undefined, status: '' };
  const ws = new WebSocket(`ws://127.0.0.1:${API_PORT}/cup/${id}/live`, ['cc', encodeURIComponent(uid)]);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'cup') {
      state.status = m.status;
      state.game = m.games[0] ?? state.game;
    } else if (m.t === 'game') state.game = m.game;
    else if (m.t === 'move' && state.game) {
      state.game = { ...state.game, moves: [...state.game.moves, m.uci], clock: m.clock, result: m.result ?? state.game.result, reason: m.reason ?? state.game.reason };
    }
  };
  return state;
}
const position = (g) => {
  const pos = Chess.fromSetup(parseFen(g.root).unwrap()).unwrap();
  for (const u of g.moves) pos.play(parseUci(u));
  return pos;
};
async function tapSquare(page, sq, touch) {
  const board = page.locator('.board cg-board').first();
  const box = await board.boundingBox();
  if (!box) throw new Error('no board on the page');
  const black = await page.locator('.board .cg-wrap').first().evaluate((el) => el.classList.contains('orientation-black'));
  const s = box.width / 8;
  const x = box.x + s * ((black ? 7 - (sq & 7) : sq & 7) + 0.5), y = box.y + s * ((black ? sq >> 3 : 7 - (sq >> 3)) + 0.5);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let fail = '';
try {
  for (const k of [P1, P2]) {
    await api('GET', '/social/me', k.uid);
    await api('PUT', '/social/me', k.uid, { name: k.name });
  }
  const pages = [];
  for (const k of [P1, P2]) {
    const ctx = await browser.newContext(k.view);
    await ctx.addInitScript((uid) => {
      localStorage.setItem('cc.devUid', uid);
      localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'minor' }));
    }, k.uid);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
    page.on('console', (m) => m.type() === 'error' && !/CORS|Failed to load resource|ERR_FAILED|firebase|googleapis|lichess|onnxruntime/i.test(m.text()) && errors.push('console: ' + m.text().slice(0, 300)));
    const opened = [];
    ctx.on('page', (p) => opened.push(p.url()));
    page.on('request', (r) => /lichess\.org\/(?!api)/.test(r.url()) && !/\.(png|svg|css|js|woff2?)/.test(r.url()) && opened.push('request ' + r.url()));
    pages.push({ ...k, page, errors, opened, touch: !!k.view.hasTouch });
  }
  const [a, b] = pages;
  // The computer kid is on Home, waiting (the invite shows as a popup there).
  await b.page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  // The phone kid invites exactly as the site does: the room, then the invite, then the game's page.
  const mk = await api('POST', '/cup/match', P1.uid, { to: P2.uid, minutes: 1, inc: 0 });
  if (mk.status !== 200) throw new Error('could not make the game: ' + mk.text);
  const id = mk.json.id;
  const inv = await api('POST', '/social/invites', P1.uid, { to: P2.uid, game: id, tc: '1+0', rated: false, color: mk.json.white === P2.uid ? 'white' : 'black' });
  if (inv.status !== 200) throw new Error('could not send the invite: ' + inv.text);
  await a.page.goto(`${SITE}/play/match/${id}`, { waitUntil: 'domcontentloaded' });
  await a.page.locator('.spinner').waitFor({ timeout: 30000 }).catch(async () => issue(`the inviter does not see "waiting": "${JSON.stringify((await a.page.locator('main').innerText().catch(() => '')).slice(0, 300))}" ${a.errors.join(' | ')}`));
  note(`${P1.name} waits on /play/match/${id}`);
  await a.page.screenshot({ path: join(OUT, '1-waiting-phone.png') });

  // The invited player's popup.
  const popup = b.page.locator('.cp');
  await popup.waitFor({ timeout: 40000 }).catch(() => issue('the invite popup did not show on Home'));
  const facts = (await popup.innerText().catch(() => '')).replace(/\s+/g, ' ');
  note(`popup: ${facts}`);
  if (/lichess/i.test(facts)) issue(`the popup mentions Lichess: ${facts}`);
  if (!/1\+0/.test(facts)) issue('the popup does not say 1+0');
  await b.page.screenshot({ path: join(OUT, '2-popup-computer.png') });
  await popup.getByRole('button', { name: /accept/i }).click();
  await b.page.waitForURL(`**/play/match/${id}`, { timeout: 20000 }).catch(() => issue('Accept did not open the game'));
  const sa = watch(P1.uid, id), sb = watch(P2.uid, id);
  await a.page.locator('.board cg-board').first().waitFor({ timeout: 20000 }).catch(() => issue('the inviter sees no board after the accept'));
  await b.page.locator('.board cg-board').first().waitFor({ timeout: 20000 }).catch(() => issue('the invited player sees no board'));
  note('both on the board');

  // Play eight plies by tapping, as children do.
  let plies = 0;
  const started = Date.now();
  while (plies < 8 && Date.now() - started < 60_000) {
    const g = sa.game;
    if (!g || g.result) break;
    const pos = position(g);
    const mover = pos.turn === 'white' ? g.white : g.black;
    const k = mover === P1.uid ? a : b;
    const moves = [];
    for (const [from, dests] of pos.allDests()) for (const to of dests) moves.push({ from, to });
    const m = moves[Math.floor(Math.random() * moves.length)];
    await tapSquare(k.page, m.from, k.touch);
    await sleep(150);
    await tapSquare(k.page, m.to, k.touch);
    const n = g.moves.length;
    for (let i = 0; i < 30 && (sa.game?.moves.length ?? 0) <= n; i++) await sleep(150);
    if ((sa.game?.moves.length ?? 0) <= n) issue(`${k.name}: the tapped move ${plies + 1} did not reach the server`);
    else plies++;
  }
  note(`${plies} plies played`);
  if (plies < 8) issue(`only ${plies} of 8 plies were played`);
  const clock = sa.game?.clock;
  if (!clock || clock.white > 60_000 || clock.black > 60_000) issue(`the clocks look wrong: ${JSON.stringify(clock)}`);
  await a.page.screenshot({ path: join(OUT, '3-playing-phone.png') });
  await b.page.screenshot({ path: join(OUT, '3-playing-computer.png') });

  // The phone kid taps away to Home: the bar back to the game shows, and works.
  await a.page.locator('a.back').first().click();
  await a.page.waitForURL('**/play', { timeout: 15000 });
  const bar = a.page.locator('.resume-bar.live');
  await bar.waitFor({ timeout: 10000 }).catch(() => issue('no bar back to the game after leaving it'));
  note(`bar: ${(await bar.innerText().catch(() => '')).replace(/\s+/g, ' ')}`);
  // A first visit to Play may ask the language: answered as a child would.
  for (let i = 0; i < 5; i++) {
    await sleep(1200);
    const dlg = a.page.locator('[role="dialog"][aria-modal="true"]').first();
    if (!(await dlg.isVisible().catch(() => false))) break;
    const close = dlg.getByRole('button', { name: /english|not now|got it|later|skip|close/i }).first();
    if (await close.isVisible().catch(() => false)) await close.click();
    else await a.page.keyboard.press('Escape');
  }
  await bar.click({ timeout: 8000, force: true }).catch((e) => issue('bar click: ' + String(e).slice(0, 400)));
  await a.page.screenshot({ path: join(OUT, '3b-after-bar.png') });
  await a.page.waitForURL(`**/play/match/${id}`, { timeout: 15000 }).catch(() => issue('the bar did not lead back to the game'));
  await a.page.locator('.board cg-board').first().waitFor({ timeout: 20000 }).catch(() => issue('the board is gone after coming back'));

  // The computer kid resigns; both pages say so.
  await b.page.getByRole('button', { name: /resign/i }).first().click();
  await b.page.getByRole('button', { name: /yes/i }).first().click();
  await sleep(1500);
  for (const k of [a, b]) {
    const text = await k.page.locator('main').innerText().catch(() => '');
    if (!/resign/i.test(text)) issue(`${k.name}: the page does not say it ended by resignation`);
    await k.page.screenshot({ path: join(OUT, `4-over-${k.uid.split(':')[1]}.png`) });
  }
  // After the end, the bar is gone.
  await a.page.goto(SITE + '/play', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  if (await a.page.locator('.resume-bar.live').count()) issue('the bar back to the game stays after it ended');

  for (const k of pages) {
    if (k.opened.length) issue(`${k.name}: lichess.org was opened or asked: ${k.opened.join(', ')}`);
    for (const e of k.errors) issue(`${k.name}: ${e}`);
  }
} catch (e) {
  fail = String(e.stack ?? e).slice(0, 600);
  issue('the test stopped: ' + fail);
}
await browser.close();
stopAll();
console.log(issues.length ? `\n${issues.length} issue(s):\n- ${issues.join('\n- ')}` : '\nAll good: the friendly bullet game worked end to end.');
process.exit(issues.length ? 1 : 0);

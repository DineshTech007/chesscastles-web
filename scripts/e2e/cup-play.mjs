// Castle Cups, played for real (owner, 2026-10-23: "test by playing it and fix the issues"): our server and the site
// run on this PC (the server's test setup: no real accounts, no live data), an admin puts an on-demand cup on Home,
// two kids join from Home in real browsers (a phone and a computer), and play every round by tapping the board while
// their pages play the computer opponents, as in a real cup. Every step, page error and the final results are logged.
//   node scripts/e2e/cup-play.mjs [--minutes 1 --inc 1] [--out dir]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci, makeUci, parseSquare } from 'chessops/util';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const MINUTES = Number(arg('minutes', 1)), INC = Number(arg('inc', 1));
const OUT = arg('out', 'reports/cup-play');
mkdirSync(OUT, { recursive: true });
const API_PORT = 8792, SITE = 'http://localhost:5173', API = `http://127.0.0.1:${API_PORT}`;
const OWNER = 'lichess:owner-test';
const KIDS = [
  { uid: 'lichess:cupkid1', name: 'Kid One (phone)', view: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { uid: 'lichess:cupkid2', name: 'Kid Two (computer)', view: { viewport: { width: 1366, height: 860 } } },
];
const log = [];
const note = (s) => {
  const line = `${new Date().toISOString().slice(11, 19)} ${s}`;
  log.push(line);
  console.log(line);
};
const issues = [];
const issue = (s) => {
  issues.push(s);
  note(`ISSUE: ${s}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- our server (the test setup) and the site
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

/** The cup as one kid's live connection sees it (games with their moves). */
function watch(uid, id) {
  const state = { cup: undefined, games: new Map() };
  const ws = new WebSocket(`ws://127.0.0.1:${API_PORT}/cup/${id}/live`, ['cc', encodeURIComponent(uid)]);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'cup') {
      state.cup = m;
      for (const g of m.games) state.games.set(g.id, g);
    } else if (m.t === 'game') state.games.set(m.game.id, m.game);
    else if (m.t === 'move') {
      const g = state.games.get(m.game);
      if (g) {
        g.moves = [...g.moves, m.uci];
        g.clock = m.clock;
        g.result = m.result ?? g.result;
        g.reason = m.reason ?? g.reason;
      }
    }
  };
  return { state, ws, sync: () => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'sync' })) };
}

/** The position after a game's moves. */
function position(g) {
  const pos = Chess.fromSetup(parseFen(g.root).unwrap()).unwrap();
  for (const u of g.moves) pos.play(parseUci(u));
  return pos;
}

/** A kid's move: a mate if there is one, a capture now and then, else any legal move (a beginner's game). */
function pickMove(pos) {
  const moves = [];
  for (const [from, dests] of pos.allDests()) for (const to of dests) moves.push({ from, to, ...(pos.board.get(from)?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0) ? { promotion: 'queen' } : {}) });
  for (const m of moves) {
    const p = pos.clone();
    p.play(m);
    if (p.isCheckmate()) return m;
  }
  const caps = moves.filter((m) => pos.board.get(m.to));
  if (caps.length && Math.random() < 0.6) return caps[Math.floor(Math.random() * caps.length)];
  return moves[Math.floor(Math.random() * moves.length)];
}

/** Taps a square on the kid's board (as a child does: the piece, then where it goes). */
async function tapSquare(page, sq, touch) {
  const board = page.locator('.play .board cg-board').first();
  const box = await board.boundingBox();
  if (!box) throw new Error('no board on the page');
  const black = await page.locator('.play .board .cg-wrap').first().evaluate((el) => el.classList.contains('orientation-black'));
  const file = sq & 7, rank = sq >> 3;
  const s = box.width / 8;
  const x = box.x + s * ((black ? 7 - file : file) + 0.5), y = box.y + s * ((black ? rank : 7 - rank) + 0.5);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let cupId = '';
try {
  for (const u of [OWNER, ...KIDS.map((k) => k.uid)]) await api('GET', '/social/me', u);
  for (const k of KIDS) await api('PUT', '/social/me', k.uid, { name: k.name });

  // 1. An admin puts an on-demand cup on Home, starting in 2 minutes.
  const made = await api('POST', '/cup/flash', OWNER, { minutes: MINUTES, inc: INC, startIn: 2 });
  if (made.status !== 200) throw new Error('could not make the cup: ' + made.text);
  cupId = made.json.id;
  note(`cup ${cupId} (${MINUTES}+${INC}) on Home, starts ${new Date(made.json.startAt).toISOString().slice(11, 19)}`);

  // 2. Both kids open Home, see it, join, and open their cup page.
  const pages = [];
  for (const k of KIDS) {
    const ctx = await browser.newContext(k.view);
    // The test kid, who agreed to the terms already (with a parent: under 18).
    await ctx.addInitScript((uid) => {
      localStorage.setItem('cc.devUid', uid);
      localStorage.setItem('cc.consent', JSON.stringify({ version: '2026-10-20', at: Date.now(), age: 'minor' }));
    }, k.uid);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
    page.on('console', (m) => m.type() === 'error' && !/CORS|Failed to load resource|ERR_FAILED|firebase|googleapis|lichess|onnxruntime/i.test(m.text()) && errors.push('console: ' + m.text().slice(0, 300)));
    await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('section.cups .chip').first().waitFor({ timeout: 60000 });
    const chips = await page.locator('section.cups .chip').allInnerTexts();
    if (!chips.some((c) => c.includes('✨'))) issue(`${k.name}: the on-demand cup is not among Home's chips (${chips.join(' | ').replace(/\s+/g, ' ')})`);
    const cut = await page.evaluate(() => [...document.querySelectorAll('section.cups .chip')].filter((c) => c.scrollHeight > c.clientHeight + 1).length);
    if (cut) issue(`${k.name}: ${cut} chips cut their text`);
    const big = await page.locator('section.cups .next .big').first().innerText().catch(() => '');
    if (!big.includes(`${MINUTES}+${INC}`)) issue(`${k.name}: Home's next cup is "${big}", not the on-demand one`);
    // A first visit may open a popup (language, install, welcome): it is noted, then closed as a child would.
    for (let i = 0; i < 4; i++) {
      const dlg = page.locator('[role="dialog"][aria-modal="true"]').first();
      if (!(await dlg.isVisible().catch(() => false))) break;
      note(`${k.name}: popup over Home: "${(await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 160)}"`);
      await page.screenshot({ path: join(OUT, `0-popup-${k.uid.split(':')[1]}-${i}.png`) });
      const close = dlg.getByRole('button', { name: /got it|close|continue|ok\b|not now|later|skip|✕|×|english|start/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click();
      else await page.keyboard.press('Escape');
      await sleep(600);
    }
    await page.locator('section.cups .acts button').first().click();
    await page.locator('section.cups .acts a', { hasText: '✓' }).waitFor({ timeout: 15000 }).catch(() => issue(`${k.name}: no "You're in" after Join on Home`));
    await page.screenshot({ path: join(OUT, `1-home-${k.uid.split(':')[1]}.png`) });
    await page.locator('section.cups .acts a').first().click();
    await page.waitForURL(`**/cups/${cupId}`, { timeout: 20000 });
    await page.locator('.wait .in').waitFor({ timeout: 20000 }).catch(() => issue(`${k.name}: the cup page doesn't say "You're in"`));
    pages.push({ ...k, page, errors, touch: !!k.view.hasTouch, mon: watch(k.uid, cupId) });
    note(`${k.name} joined from Home and waits on the cup page`);
  }
  await pages[0].page.screenshot({ path: join(OUT, '2-waiting-phone.png') });

  // 3. The admin starts it now (no need to wait the 2 minutes).
  const st = await api('POST', `/cup/${cupId}/start`, OWNER);
  if (st.status !== 200) issue('start now failed: ' + st.text.slice(0, 200));
  note('started');

  // 4. Every round: each kid plays their own moves by tapping; their page plays the computer's.
  const started = Date.now();
  let lastRound = 0, moves = 0, shots = 0;
  const stuck = new Map();
  while (Date.now() - started < 40 * 60_000) {
    const cup = pages[0].mon.state.cup;
    if (cup?.status === 'over') break;
    if (cup && cup.round !== lastRound) {
      lastRound = cup.round;
      note(`round ${cup.round} of ${cup.rounds}: ${cup.games.filter((g) => g.round === cup.round).map((g) => `${g.whiteName} – ${g.blackName || 'bye'}`).join(', ')}`);
      if (shots < 6) for (const k of pages) await k.page.screenshot({ path: join(OUT, `3-round${cup.round}-${k.uid.split(':')[1]}.png`) }).then(() => shots++);
    }
    for (const k of pages) {
      const g = [...k.mon.state.games.values()].find((x) => x.round === k.mon.state.cup?.round && !x.result && (x.white === k.uid || x.black === k.uid) && x.black);
      if (!g) continue;
      const pos = position(g);
      const mine = (pos.turn === 'white' ? g.white : g.black) === k.uid;
      if (!mine) {
        // The computer's move comes from this kid's page: it must come within the clock.
        const key = `${g.id}:${g.moves.length}`;
        const since = stuck.get(key) ?? Date.now();
        stuck.set(key, since);
        if (Date.now() - since > 45_000 && !stuck.has(key + ':told')) {
          stuck.set(key + ':told', 1);
          issue(`${k.name}: the opponent's move in ${g.id} didn't come for 45 s (move ${g.moves.length})`);
        }
        continue;
      }
      const m = pickMove(pos);
      if (!m) continue;
      try {
        await tapSquare(k.page, m.from, k.touch);
        await sleep(150);
        await tapSquare(k.page, m.to, k.touch);
        moves++;
      } catch (e) {
        issue(`${k.name}: could not tap a move (${String(e).slice(0, 120)})`);
      }
      // The move must reach the server (else the board didn't take the tap).
      const n = g.moves.length;
      for (let i = 0; i < 20 && (k.mon.state.games.get(g.id)?.moves.length ?? 0) <= n; i++) await sleep(150);
      if ((k.mon.state.games.get(g.id)?.moves.length ?? 0) <= n && !k.mon.state.games.get(g.id)?.result) {
        k.mon.sync();
        await sleep(500);
        if ((k.mon.state.games.get(g.id)?.moves.length ?? 0) <= n) {
          issue(`${k.name}: the tapped move ${makeUci(m)} didn't reach the server (move ${n + 1} of ${g.id})`);
          // Not stuck for ever: the move goes the same way the page sends it.
          k.mon.ws.send(JSON.stringify({ t: 'move', game: g.id, uci: makeUci(m) }));
        }
      }
    }
    await sleep(300);
  }
  const end = pages[0].mon.state.cup;
  note(`the cup is ${end?.status} after ${Math.round((Date.now() - started) / 60000)} min; ${moves} moves tapped`);
  if (end?.status !== 'over') issue('the cup did not finish in 40 minutes');

  // 5. The end: results on both pages, the podium, and Home's card.
  for (const k of pages) {
    await sleep(1500);
    await k.page.screenshot({ path: join(OUT, `4-results-${k.uid.split(':')[1]}.png`), fullPage: true });
    const text = await k.page.locator('main').innerText().catch(() => '');
    if (!/🥇|1st|podium|Podium/i.test(text)) issue(`${k.name}: the results page shows no podium`);
  }
  if (end) note(`standings: ${end.standings.map((r) => `${r.rank}. ${r.name}${r.bot ? ' (computer)' : ''} ${r.score}`).join(', ')}`);
  const awards = await api('GET', '/social/me', KIDS[0].uid);
  note(`kid one's cup awards: played ${awards.json?.progress?.cupPlayed ?? 0}, podiums ${awards.json?.progress?.cupPodiums ?? 0}, awards ${(awards.json?.progress?.awards ?? []).filter((a) => a.startsWith('cup')).join(' ') || 'none'}`);
  const home = await api('GET', '/cup/today', KIDS[0].uid);
  const listed = home.json?.cups?.find((c) => c.id === cupId);
  note(`Home lists it afterwards: ${listed ? `${listed.status}, podium ${(listed.podium ?? []).map((p) => p.name).join(', ')}` : 'no'}`);
  for (const k of pages) for (const e of [...new Set(k.errors)]) issue(`${k.name} page error: ${e}`);
} catch (e) {
  issue(`the test stopped: ${String(e.stack ?? e).slice(0, 500)}`);
} finally {
  await browser.close();
  stopAll();
  writeFileSync(join(OUT, 'report.md'), `# Castle Cup played for real (${new Date().toISOString().slice(0, 16)})\n\n## Issues (${issues.length})\n\n${issues.map((i) => `- ${i}`).join('\n') || '- none'}\n\n## Log\n\n${log.map((l) => `    ${l}`).join('\n')}\n`);
  console.log(`\n${issues.length} issues. Report: ${join(OUT, 'report.md')}`);
  process.exit(0);
}

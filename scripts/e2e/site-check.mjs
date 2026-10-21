// Site check: uses Chess Castles the way players do, on a computer, a phone and
// a tablet, and reports what is broken: pages that fail or scroll sideways,
// menus that don't open, slow taps on a phone connection, big downloads a
// phone never asked for, move buttons missing under the board, and a real
// game against the computer and a step through an analysis.
//
//   node scripts/e2e/site-check.mjs [base-url] [--out dir] [--only phone,desktop]
//
// base-url: https://chesscastles.com by default (or http://localhost:4199 for a
// build). CHANNEL=msedge uses the installed Edge; else Playwright's Chromium.
// Writes <out>/report.md and results.json, with a screenshot of every failure;
// exits with 1 when anything failed.
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = (args[0] && !args[0].startsWith('--') ? args[0] : 'https://chesscastles.com').replace(/\/$/, '');
const OUT = flag('--out') ?? 'site-check-report';
const ONLY = flag('--only')?.split(',');
mkdirSync(OUT, { recursive: true });

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: devices['Pixel 7'],
  tablet: devices['iPad Mini'],
};
/** Pages every player can open without signing in. */
const PAGES = ['/', '/play', '/puzzles', '/puzzles?tab=daily', '/puzzles/themes', '/learn', '/learn?tab=openings', '/learn?tab=tactics', '/learn?tab=endgames', '/learn?tab=plan', '/learn/study', '/learn/study/caro-kann', '/learn/masters', '/analysis', '/games', '/profile', '/watch', '/live', '/leaderboard', '/ratings', '/more', '/help', '/insights', '/coach', '/books', '/vision'];
/** A tap must open its page within this long. */
const TAP_MS = 6000;
/** A phone should never download more than this in one file by itself. */
const BIG_BYTES = 5 * 1024 * 1024;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GAME = 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4 b1c3 f6e4 e1g1 e4c3'.split(' ');

const results = [];
let shots = 0;

async function check(device, page, name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ device, name, ok: true, ms: Date.now() - t0, detail: detail ?? '' });
    console.log(`  ok   ${device.padEnd(8)} ${name}${detail ? ` (${detail})` : ''}`);
  } catch (e) {
    const shot = `fail-${++shots}-${device}.png`;
    await page.screenshot({ path: join(OUT, shot) }).catch(() => {});
    results.push({ device, name, ok: false, ms: Date.now() - t0, detail: String(e?.message ?? e).split('\n')[0].slice(0, 300), shot });
    console.log(`  FAIL ${device.padEnd(8)} ${name}: ${String(e?.message ?? e).split('\n')[0].slice(0, 200)}`);
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

/** Opens a page and waits for it to settle a little (some pages keep a connection open). */
async function open(page, path) {
  const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  return res;
}

/** The centre of a square on the board (White at the bottom). */
async function square(page, sq) {
  const box = await page.locator('cg-board').first().boundingBox();
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  const s = box.width / 8;
  return { x: box.x + s * (file + 0.5), y: box.y + s * (7 - rank + 0.5) };
}

async function run(name, options) {
  console.log(`\n== ${name}`);
  const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const touch = !!options.hasTouch;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const big = [];
  page.on('response', async (r) => {
    const len = Number((await r.headerValue('content-length').catch(() => null)) ?? 0);
    if (len > BIG_BYTES && r.request().method() === 'GET') big.push(`${Math.round(len / 1048576)} MB ${r.url().replace(BASE, '')}`);
  });
  const tap = (loc) => (touch ? loc.tap() : loc.click());

  // 1. Every page opens, without errors, and nothing scrolls sideways.
  for (const path of PAGES) {
    await check(name, page, `page ${path}`, async () => {
      errors.length = 0;
      const res = await open(page, path);
      expect(!res || res.status() < 400, `HTTP ${res?.status()}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow <= 1, `scrolls sideways by ${overflow}px`);
      const text = await page.locator('main').innerText().catch(() => '');
      expect(text.trim().length > 40, 'the page looks empty');
      expect(!errors.length, `page error: ${errors[0]}`);
    });
  }

  // 2. The menus: every item opens its page.
  await open(page, '/');
  if (name === 'phone') {
    for (const label of ['Play', 'Puzzles', 'Analyse', 'More', 'Home']) {
      await check(name, page, `bottom bar: ${label}`, async () => {
        const before = page.url();
        const t0 = Date.now();
        await tap(page.locator('nav.tabs a', { hasText: label }));
        await page.waitForURL((u) => u.href !== before, { timeout: TAP_MS });
        return `${Date.now() - t0} ms`;
      });
    }
    await check(name, page, 'More > Learn', async () => {
      await open(page, '/more');
      const t0 = Date.now();
      await tap(page.locator('main a[href="/learn"]').first());
      await page.waitForURL(/\/learn/, { timeout: TAP_MS });
      return `${Date.now() - t0} ms`;
    });
  } else {
    const items = await page.locator('aside a.item').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const href of items) {
      await check(name, page, `sidebar: ${href}`, async () => {
        await open(page, href === '/' ? '/more' : '/');
        const t0 = Date.now();
        await tap(page.locator(`aside a.item[href="${href}"]`).first());
        await page.waitForURL((u) => new URL(u).pathname === href.split('?')[0], { timeout: TAP_MS });
        return `${Date.now() - t0} ms`;
      });
    }
  }

  // 3. Learn: each tab opens.
  await check(name, page, 'Learn tabs', async () => {
    await open(page, '/learn');
    for (const t of ['Openings', 'Tactics', 'Strategy', 'Endgames', 'My plan', 'Start']) {
      await tap(page.locator('.tabs .tab', { hasText: t }));
      await page.waitForTimeout(300);
      expect((await page.locator('.tabs .tab[aria-pressed="true"]').innerText()).includes(t), `the ${t} tab did not open`);
    }
  });

  // 3b. The Analysis board stays in the menu (it was once hidden by mistake): the sidebar on a computer,
  // the bottom tabs on a phone.
  await check(name, page, 'the Analysis board is in the menu', async () => {
    await open(page, '/');
    const n = await page.locator('a[href="/analysis"]').count();
    expect(n > 0, 'no link to the Analysis board on the home page menu');
  });

  // 3d. A first visit: the Sandstone & slate board and Merida pieces everywhere (the owner's default).
  await check(name, page, 'default board and pieces: sandstone & slate, merida', async () => {
    await page.evaluate(() => {
      localStorage.removeItem('k24.board');
      localStorage.removeItem('cc.pieces');
      delete document.documentElement.dataset.board;
      delete document.documentElement.dataset.pieces;
    });
    await open(page, '/analysis');
    await page.locator('cg-board piece').first().waitFor({ timeout: 15000 });
    const look = await page.evaluate(() => ({
      board: getComputedStyle(document.querySelector('cg-board')).backgroundImage,
      piece: getComputedStyle(document.querySelector('cg-board piece')).backgroundImage,
    }));
    expect(look.board.includes('stone.webp'), `the board is ${look.board.slice(0, 80)}`);
    expect(look.piece.includes('/pieces/merida/'), `the pieces are ${look.piece.slice(0, 80)}`);
  });

  // 3c. On phones the top bar hides the palette button: the board and pieces are in the More menu.
  if (touch)
    await check(name, page, 'board and pieces can be picked from More', async () => {
      await open(page, '/more');
      const btn = page.getByRole('button', { name: /board and pieces/i });
      expect((await btn.count()) > 0, 'no Board and pieces button on the More page');
      await btn.first().click();
      await page.getByRole('heading', { name: /board and pieces/i }).waitFor({ timeout: 5000 });
      await page.keyboard.press('Escape');
    });

  // 4. Analysis: a game steps forward, and on a phone the move buttons sit right under the board.
  await check(name, page, 'analysis: step through a game', async () => {
    await open(page, '/');
    await page.evaluate(([uci, start]) => {
      localStorage.setItem('k24.myGames', JSON.stringify([{ id: 'site-check', playedAt: Date.now(), kind: 'computer', white: 'You', black: 'Computer', userSide: 'white', result: '0-1', reason: '', timeControl: '10+0', startFen: start, uci }]));
    }, [GAME, START]);
    await open(page, '/analysis?game=site-check');
    const board = await page.locator('cg-board').first().boundingBox();
    expect(board, 'no board');
    const next = page.getByRole('button', { name: 'Next move' }).locator('visible=true').first();
    const nb = await next.boundingBox();
    expect(nb, 'no visible Next move button');
    if (name === 'phone') expect(nb.y - (board.y + board.height) < 120, `the move buttons are ${Math.round(nb.y - board.y - board.height)}px below the board`);
    const fen0 = await page.locator('cg-board piece').count();
    for (let i = 0; i < 6; i++) await tap(next);
    await page.waitForTimeout(400);
    const moved = await page.locator('cg-board .last-move').count();
    expect(moved > 0, 'the board did not move');
    return `${fen0} pieces, stepped 6 moves`;
  });

  // 3c'. Phones: a finger that drags a piece, or lands just beside one, never steps the game back (2026-10-21: the
  // board's swipe through the moves took quick sideways drags, and touches on the edge of a piece's next square, as
  // swipes). A swipe from the middle of an empty square still steps back.
  if (touch) {
    await check(name, page, 'phone drags: a piece drag never steps the game back, a swipe still does', async () => {
      await open(page, '/');
      await page.evaluate(() => sessionStorage.setItem('k24.importPgn', '[White "A"]\n[Black "B"]\n\n1. e4 e5 2. Nf3 Nc6 *'));
      await open(page, '/analysis?import=1');
      await page.locator('.mv.cur').first().waitFor({ timeout: 8000 });
      const cdp = await page.context().newCDPSession(page);
      const s = (await page.locator('cg-board').first().boundingBox()).width / 8;
      const quick = async (from, dx) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
        for (let i = 1; i <= 5; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (dx * i) / 5, y: from.y }] });
          await page.waitForTimeout(30);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(600);
      };
      const current = async () => (await page.locator('.mv.cur').first().innerText()).trim();
      const d3 = await square(page, 'd3');
      await quick({ x: d3.x, y: d3.y + s * 0.3 }, 2 * s); // beside the d2 pawn
      expect((await current()) === 'Nc6', `a sideways drag beside a pawn stepped the game back to ${await current()}`);
      await quick(await square(page, 'a1'), 2 * s); // the a1 rook, dragged sideways
      expect((await current()) === 'Nc6', `a quick sideways rook drag stepped the game back to ${await current()}`);
      await quick(await square(page, 'd5'), 2 * s); // the middle of an empty square
      expect((await current()) === 'Nf3', `a swipe on an empty square no longer steps back (at ${await current()})`);
      await cdp.detach().catch(() => {});
    });
  }

  // 3d. Settings in the same place everywhere: the gear in the top bar, on screen, with "Always promote to
  // Queen" (off by default) and the rest; the board and pieces open from it.
  await check(name, page, 'settings: the gear in the top bar, with Always promote to Queen off by default', async () => {
    await page.evaluate(() => localStorage.removeItem('k24.autoQueen'));
    for (const path of ['/', '/puzzles', '/play/computer?l=1350&c=white']) {
      await open(page, path);
      const gear = page.getByRole('button', { name: 'Settings', exact: true }).locator('visible=true').first();
      await gear.waitFor({ timeout: 10000 });
      const box = await gear.boundingBox();
      const vw = await page.evaluate(() => innerWidth);
      expect(box && box.x >= 0 && box.x + box.width <= vw && box.y >= 0 && box.y < 120, `the settings gear is not on screen at the top of ${path}`);
    }
    await open(page, '/');
    await tap(page.getByRole('button', { name: 'Settings', exact: true }).locator('visible=true').first());
    const menu = page.getByRole('dialog', { name: 'Quick settings' });
    await menu.waitFor({ timeout: 5000 });
    const queen = menu.getByRole('checkbox', { name: /Always promote to Queen/ });
    expect(!(await queen.isChecked()), 'Always promote to Queen is on by default');
    await tap(queen);
    const saved = await page.evaluate(() => localStorage.getItem('k24.autoQueen'));
    expect(saved === '1', 'the switch did not save');
    await tap(queen);
    await tap(menu.getByRole('button', { name: /Board and pieces/ }));
    await page.getByRole('heading', { name: /board and pieces/i }).waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.evaluate(() => localStorage.removeItem('k24.autoQueen'));
    return 'gear on screen on 3 pages; off by default; saves; board and pieces';
  });

  // 4a. Promotion, like chess.com's "Always promote to Queen": on, a queen at once; off, the piece picker
  // (a knight is made; closing the picker puts the pawn back).
  await check(name, page, 'promotion: always a queen, or the piece you pick', async () => {
    const promote = async () => {
      await open(page, `/analysis?fen=${encodeURIComponent('8/4P3/8/8/8/8/k7/6K1 w - - 0 1')}`);
      await page.locator('cg-board').first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(600);
      for (const sq of ['e7', 'e8']) {
        const { x, y } = await square(page, sq);
        if (touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await page.waitForTimeout(250);
      }
    };
    const picker = page.getByRole('dialog', { name: 'Choose a piece' });
    await page.evaluate(() => localStorage.setItem('k24.autoQueen', '1'));
    await promote();
    await page.waitForTimeout(500);
    expect(!(await picker.count()), 'the piece picker opened with "Always promote to Queen" on');
    expect((await page.locator('body').innerText()).includes('e8=Q'), 'no queen with "Always promote to Queen" on');
    await page.evaluate(() => localStorage.setItem('k24.autoQueen', '0'));
    await promote();
    await picker.waitFor({ timeout: 5000 });
    await tap(picker.getByRole('button', { name: 'knight' }));
    await page.waitForTimeout(500);
    expect((await page.locator('body').innerText()).includes('e8=N'), 'the pawn did not become the knight picked');
    await promote();
    await picker.waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => !!document.querySelector('cg-board piece.pawn.white'));
    expect(back && !(await picker.count()), 'closing the picker did not put the pawn back');
    await page.evaluate(() => localStorage.removeItem('k24.autoQueen'));
    return 'queen; picker, knight; cancel';
  });

  // 4b. The Guru review: the move buttons right under the board on every screen.
  await check(name, page, 'review: move buttons under the board', async () => {
    await open(page, '/coach/review/site-check');
    await page.locator('.nav-card .nav').waitFor({ timeout: 120000 });
    const gap = await page.evaluate(() => {
      const b = document.querySelector('.board-col cg-board')?.getBoundingClientRect();
      const n = document.querySelector('.nav-card')?.getBoundingClientRect();
      return b && n ? Math.round(n.top - b.bottom) : 9999;
    });
    expect(gap < 60, `the move buttons are ${gap}px below the board`);
    return `${gap}px`;
  });

  // 4c. The daily puzzle: a wrong move costs rating once; another wrong move changes nothing.
  await check(name, page, 'puzzle rating: a miss counts once', async () => {
    await open(page, '/');
    await page.evaluate(() => ['k24.puzzleRating', 'k24.ratedPuzzles'].forEach((k) => localStorage.removeItem(k)));
    await open(page, '/puzzles?tab=daily');
    await page.locator('cg-board').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.locator('cg-board').first().scrollIntoViewIfNeeded();
    const box = await page.locator('cg-board').first().boundingBox();
    const white = (await page.locator('h1.h').innerText()).includes('White');
    const w = box.width / 8;
    const xy = (f, r) => ({ x: box.x + w * ((white ? f : 7 - f) + 0.5), y: box.y + w * ((white ? 7 - r : r) + 0.5) });
    const ratings = [];
    for (let f = 0; f < 8 && ratings.length < 2; f++)
      for (let r = 0; r < 8 && ratings.length < 2; r++)
        for (const [df, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          if (f + df < 0 || f + df > 7 || r + dr < 0 || r + dr > 7) continue;
          const a = xy(f, r);
          const c = xy(f + df, r + dr);
          if (touch) {
            await page.touchscreen.tap(a.x, a.y);
            await page.touchscreen.tap(c.x, c.y);
          } else {
            await page.mouse.click(a.x, a.y);
            await page.mouse.click(c.x, c.y);
          }
          await page.waitForTimeout(250);
          if ((await page.locator('h1.h').innerText()).includes('Not that one')) {
            await page.waitForTimeout(800);
            ratings.push(await page.evaluate(() => JSON.parse(localStorage.getItem('k24.puzzleRating') ?? 'null')?.attempted ?? 0));
            break;
          }
        }
    expect(ratings.length === 2, 'could not make two wrong moves');
    expect(ratings[0] === 1 && ratings[1] === 1, `rated ${ratings.join(' then ')} times`);
  });

  // 4d. Rated puzzles: one after another near the player's rating, never the same twice.
  await check(name, page, 'rated puzzles: no repeats', async () => {
    await open(page, '/puzzles');
    await page.locator('cg-board').first().waitFor({ timeout: 20000 });
    const ids = new Set();
    let last;
    for (let i = 0; i < 12; i++) {
      // The next puzzle may come from another difficulty band (the learning ladder), loaded from the network:
      // wait until it has really arrived, not a fixed moment.
      await page
        .waitForFunction(
          (prev) => {
            const s = JSON.parse(localStorage.getItem('k24.seenPuzzles') ?? '[]');
            return s.length > 0 && s[s.length - 1] !== prev;
          },
          last,
          { timeout: 8000 },
        )
        .catch(() => {});
      const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('k24.seenPuzzles') ?? '[]'));
      last = seen[seen.length - 1];
      ids.add(last);
      await tap(page.getByRole('button', { name: /next puzzle/i }));
    }
    expect(ids.size === 12, `only ${ids.size} different puzzles in 12`);
  });

  // 5. A game against the computer: play e4 by tapping, the computer answers.
  await check(name, page, 'play the computer: e4 and an answer', async () => {
    await open(page, '/play/computer?l=1350&c=white');
    await page.locator('cg-board').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    for (const sq of ['e2', 'e4']) {
      const { x, y } = await square(page, sq);
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await page.waitForTimeout(250);
    }
    await page.waitForFunction(() => document.querySelectorAll('.moves .mv').length >= 2 && [...document.querySelectorAll('.moves .mv')].filter((b) => b.textContent.trim()).length >= 2, null, { timeout: 25000 });
    const moves = await page.locator('.moves .mv').allInnerTexts();
    // On a phone the game page has a Back button at the top: it must leave the game
    // even when the game was opened directly (no page of the site before it).
    if (name === 'phone') {
      await tap(page.locator('.focus-back'));
      await page.waitForURL((u) => !new URL(u).pathname.startsWith('/play/computer'), { timeout: TAP_MS });
    }
    return moves.filter((m) => m.trim()).slice(0, 2).join(' ');
  });

  // 5b. Watching a live Lichess game: its moves, the move buttons under the board, the engine.
  await check(name, page, 'watch a live game: moves, buttons under the board, engine', async () => {
    const tv = await (await fetch('https://lichess.org/api/tv/channels')).json();
    await open(page, `/watch/live/${tv.blitz.gameId}`);
    await page.waitForFunction(() => document.querySelectorAll('.moves-card button').length > 0, null, { timeout: 20000 });
    const board = await page.locator('cg-board').first().boundingBox();
    const prev = await page.locator('.nav-card [aria-label="Previous move"]').boundingBox();
    expect(prev && prev.y > board.y + board.height - 2, 'the move buttons are not under the board');
    // The engine is on from the start: its best lines (up to three) appear under the moves.
    await page.locator('.radios label:has-text("Engine") input').check();
    await page.waitForFunction(() => document.querySelectorAll('.elines li').length > 0 || /Checkmate|Game over/.test(document.querySelector('.analysis')?.textContent ?? ''), null, { timeout: 20000 });
    return `${await page.locator('.moves-card button').count()} moves, ${await page.locator('.elines li').count()} engine lines`;
  });

  // 5c. Bullet (1+0) against the 2000 computer: it must move at a bullet pace, or it loses on time.
  if (name === 'desktop')
    await check(name, page, 'bullet: the computer keeps up with its clock', async () => {
      // Our moves are random, so a game can end quickly: up to three games, until the computer has made 8 timed moves.
      let timed = 0;
      let used = 0;
      for (let game = 0; game < 3 && timed < 8; game++) {
        await page.evaluate(() => localStorage.removeItem('k24.resume'));
        await open(page, '/play/fide?r=2000&tc=6&c=black');
        await page.locator('cg-board').first().waitFor({ timeout: 15000 });
        // The fair play promise, before the first rated game.
        const promise = page.getByRole('button', { name: /promise to play fair/i });
        if (await promise.count()) await promise.click();
        const snap = () => page.evaluate(() => JSON.parse(localStorage.getItem('k24.resume') ?? 'null')?.snapshot);
        let last;
        const until = Date.now() + 60000;
        while (Date.now() < until) {
          const s = await snap();
          if (s) last = s;
          else if (last) break; // the game ended
          const n = s?.moves.length ?? 0;
          if (n >= 24) break;
          if (n % 2 === 1) {
            // Our move (Black): a piece, then one of the squares the board offers for it.
            const before = n;
            const centre = (sel) =>
              page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })), sel);
            const pieces = (await centre('cg-board piece.black')).sort(() => Math.random() - 0.5);
            for (const p of pieces) {
              await page.mouse.click(p.x, p.y);
              const [d] = await centre('cg-board square.move-dest');
              if (!d) continue;
              await page.mouse.click(d.x, d.y);
              await page.waitForTimeout(150);
              if (((await snap())?.moves.length ?? 0) > before) break;
            }
          }
          await page.waitForTimeout(50);
        }
        // The computer's clock starts after its first move.
        const moves = Math.ceil((last?.moves.length ?? 0) / 2) - 1;
        if (moves > 0) {
          timed += moves;
          used += 60000 - last.white;
        }
      }
      await page.evaluate(() => localStorage.removeItem('k24.resume'));
      expect(timed >= 5, `only ${timed} timed computer moves were played`);
      const avg = Math.round(used / timed);
      expect(avg < 1500, `the computer took ${avg} ms a move: it would lose a 1-minute game on time`);
      return `${avg} ms a move over ${timed} moves`;
    });

  // 5e. Learn → Openings opens on the opening check-up (your games).
  await check(name, page, 'learn openings: the opening check-up is there', async () => {
    await open(page, '/learn?tab=openings');
    await page.locator('input[aria-label="chess.com username"]').waitFor({ timeout: 10000 });
    expect((await page.locator('button:has-text("Check my openings"), button:has-text("Check again")').count()) > 0, 'no check-up button');
  });

  // 5f. Learn → Openings → Courses lists every published course (the new ones were hidden as drafts), and one opens.
  await check(name, page, 'learn openings: every course is listed and opens', async () => {
    const reps = JSON.parse(readFileSync(new URL('../../src/lib/study/repertoires.json', import.meta.url), 'utf8'));
    const ids = Object.keys(reps).filter((id) => !reps[id].draft);
    await open(page, '/learn?tab=openings&sub=courses');
    await page.locator('a.s-card[href^="/learn/study/"]').first().waitFor({ timeout: 10000 });
    const missing = [];
    for (const id of ids) if (!(await page.locator(`a.s-card[href^="/learn/study/${id}"]`).count())) missing.push(id);
    expect(!missing.length, `missing courses: ${missing.join(', ')}`);
    await open(page, '/learn/study/ruy-lopez');
    await page.getByText('Ruy Lopez').first().waitFor({ timeout: 10000 });
  });

  // 5d. The "Get the Chess Castles app" popup opens (forced: automated visits never get it) and closes.
  await check(name, page, 'install the app: the popup opens and closes', async () => {
    await open(page, '/?install=show');
    await page.locator('#install-h').waitFor({ timeout: 8000 });
    const way = (await page.locator('.dialog .btn').allInnerTexts()).join(', ');
    await tap(page.locator('.dialog .btn').last());
    await page.waitForTimeout(300);
    expect((await page.locator('#install-h').count()) === 0, 'the popup did not close');
    return way;
  });

  // The game above is unfinished: opening the home page must not jump back into it.
  await check(name, page, 'home page opens as asked with a game unfinished', async () => {
    await open(page, '/');
    await page.waitForTimeout(2500);
    expect(new URL(page.url()).pathname === '/', `the home page jumped to ${page.url().replace(BASE, '')}`);
  });

  // 6. Nothing big downloaded by itself on a phone or tablet.
  if (touch) {
    await check(name, page, `no big downloads by themselves (over ${BIG_BYTES / 1048576} MB)`, async () => {
      big.length = 0;
      for (const path of ['/play', '/play/fide?r=1500&tc=0&c=white', '/learn/openings/italian', '/analysis']) {
        await open(page, path);
        await page.waitForTimeout(6000);
      }
      expect(!big.length, `downloaded ${big.join(', ')}`);
    });
  }

  // 7. On a slow phone connection, a tap still opens its page quickly.
  if (name === 'phone') {
    await check(name, page, 'slow connection: taps still open pages', async () => {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1048576) / 8, uploadThroughput: (750 * 1024) / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      // From the home page (a game in progress hides the bottom bar on phones).
      await open(page, '/');
      await page.waitForTimeout(3000);
      const times = [];
      // Each step: the thing to tap must show, and its page must open, within 12 s.
      const step = async (label, locator, url) => {
        const t0 = Date.now();
        await locator.waitFor({ timeout: 12000 }).catch(() => {
          throw new Error(`${label}: not on screen after 12 s (at ${page.url().replace(BASE, '')})`);
        });
        const before = page.url();
        await tap(locator);
        await page.waitForURL(url ?? ((u) => u.href !== before), { timeout: 12000 }).catch(() => {
          throw new Error(`${label}: tapped, but the page did not change in 12 s`);
        });
        times.push(`${label} ${Date.now() - t0} ms`);
      };
      await step('Puzzles tab', page.locator('nav.tabs a', { hasText: 'Puzzles' }));
      await step('More tab', page.locator('nav.tabs a', { hasText: 'More' }));
      await step('Learn on More', page.locator('main a[href="/learn"]').first(), /\/learn/);
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      return times.join(', ');
    });
  }

  await browser.close();
}

const t0 = Date.now();
for (const [name, options] of Object.entries(DEVICES)) {
  if (ONLY && !ONLY.includes(name)) continue;
  await run(name, options);
}

const failed = results.filter((r) => !r.ok);
const when = new Date().toISOString().replace('T', ' ').slice(0, 16);
const md = [
  `# Site check: ${failed.length ? `${failed.length} problem${failed.length === 1 ? '' : 's'}` : 'all good'}`,
  '',
  `${BASE} · ${when} UTC · ${results.length} checks in ${Math.round((Date.now() - t0) / 1000)} s`,
  '',
  ...(failed.length ? ['## Problems', '', ...failed.map((r) => `- **${r.device}** · ${r.name}: ${r.detail}${r.shot ? ` (screenshot: ${r.shot})` : ''}`), ''] : []),
  '## Every check',
  '',
  '| Device | Check | Result |',
  '| --- | --- | --- |',
  ...results.map((r) => `| ${r.device} | ${r.name} | ${r.ok ? `ok${r.detail ? ` · ${r.detail}` : ''}` : `**failed** · ${r.detail}`} |`),
  '',
].join('\n');
writeFileSync(join(OUT, 'report.md'), md);
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: BASE, when, results }, null, 2));
console.log(`\n${failed.length ? `${failed.length} FAILED` : 'All good'}: ${results.length} checks. Report: ${join(OUT, 'report.md')}`);
process.exit(failed.length ? 1 : 0);

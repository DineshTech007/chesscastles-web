// Aarav, a beginner who tests Chess Castles: one daily session of the routine
// in reports/TESTER.md. Signs in with the test account (through Lichess),
// plays games against the FIDE-rated opponents with a local engine at a
// beginner's level, opens each game's review and the profile, studies one of
// the opening courses (lines, a model game, then games from that line, rapid),
// tries one more feature, signs out, and writes reports/session-<date>.md and
// reports/bugs-master.md. Everything it writes is what it saw.
//
//   NIGHT24_TEST_PASSWORD=… node scripts/e2e/tester.mjs [--games 5] [--base https://chesscastles.com] [--headed]
//
// State (skill level, sessions, the browser session) lives in tester-data/ (not in git).
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSquare, parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = (flag('--base', 'https://chesscastles.com')).replace(/\/$/, '');
const GAMES = Number(flag('--games', 5));
const HEADED = args.includes('--headed') || args.includes('--login');
/** --login: only sign in (in a visible window, for Lichess's human check) and keep the session. */
const LOGIN_ONLY = args.includes('--login');
/** --only <section>: sign in and run just that Learn section (tactics, puzzles, strategy…), for checking the tester itself. */
const ONLY = flag('--only', '');
const USER = 'chesscastlesTester';
const PASSWORD = process.env.NIGHT24_TEST_PASSWORD;
/** A Lichess personal access token of the test account: signs in on /auth/token (Lichess's human check stops an automated browser at its form). */
const TOKEN = process.env.NIGHT24_TEST_TOKEN;
if (!PASSWORD && !TOKEN) {
  console.error('Set NIGHT24_TEST_TOKEN (a Lichess personal access token of the test account) or NIGHT24_TEST_PASSWORD.');
  process.exit(2);
}
const DATA = 'tester-data';
const REPORTS = 'reports';
const SHOTS = join(REPORTS, 'shots');
for (const d of [DATA, REPORTS, SHOTS]) mkdirSync(d, { recursive: true });
const STATE_FILE = join(DATA, 'state.json');
const SESSION_FILE = join(DATA, 'session.json');
const BUGS_FILE = join(DATA, 'bugs.json');
const SLOW_MS = 3000;
/** The opening courses, studied in turn; games from the studied line follow. */
// `line` is the curated line (the trainer and "Play it" take it); `chapter` the course's chapter
// with the same moves (what the Model games and Lines tabs take), looked up in chapters.json.
const CHAPTERS = JSON.parse(readFileSync('src/lib/study/chapters.json', 'utf8'));
const chapterOf = (id, sans) => CHAPTERS[id]?.chapters.find((c) => c.sans === sans)?.id ?? sans;
const COURSES = [
  { id: 'caro-kann', name: 'Caro-Kann Defence', side: 'black', line: 'advance', sans: 'e4 c6 d4 d5 e5', lineName: '3.e5' },
  { id: 'jobava-london', name: 'Jobava London', side: 'white', line: 'e6', sans: 'd4 Nf6 Bf4 d5 Nc3 e6', lineName: '3...e6' },
  { id: 'chebanenko', name: 'Chebanenko Slav', side: 'black', line: 'e3', sans: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 a6 e3', lineName: '5.e3' },
].map((c) => ({ ...c, chapter: chapterOf(c.id, c.sans) }));
/** The trainer's catalogue (src/lib/openings.ts): one a session for variety, trained and then played. */
const CATALOGUE = [
  { id: 'italian', side: 'white' }, { id: 'sicilian', side: 'black' }, { id: 'queens-gambit', side: 'white' }, { id: 'french', side: 'black' },
  { id: 'ruy-lopez', side: 'white' }, { id: 'nimzo', side: 'black' }, { id: 'scotch', side: 'white' }, { id: 'kings-indian', side: 'black' },
  { id: 'london', side: 'white' }, { id: 'scandinavian', side: 'black' }, { id: 'open-sicilian', side: 'white' }, { id: 'qgd', side: 'black' },
  { id: 'vienna', side: 'white' }, { id: 'najdorf', side: 'black' }, { id: 'catalan', side: 'white' }, { id: 'petrov', side: 'black' },
  { id: 'english', side: 'white' }, { id: 'grunfeld', side: 'black' }, { id: 'kings-gambit', side: 'white' }, { id: 'berlin', side: 'black' },
  { id: 'jobava', side: 'white' }, { id: 'dragon', side: 'black' }, { id: 'slav', side: 'black' }, { id: 'sveshnikov', side: 'black' },
  { id: 'pirc', side: 'black' }, { id: 'queens-indian', side: 'black' }, { id: 'semi-slav', side: 'black' }, { id: 'benoni', side: 'black' },
];
/** Other features, one a session. */
const FEATURES = ['/watch', '/vision', '/books', '/leaderboard', '/ratings', '/puzzles', '/coach', '/learn/masters', '/friends', '/insights', '/games', '/learn?tab=tactics'];
/** Rapid 15+10 (TIME_CONTROLS index 2): never blitz or bullet in this routine. */
const TC = 2;

const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { session: 0, skill: 0, gamesAtLevel: 0, used: [] };
state.session++;
const stamp = new Date();
const pad = (n) => String(n).padStart(2, '0');
const when = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

// ---- what the session records
const bugs = [];
const notes = [];
const slow = [];
const consoleErrors = [];
const failedRequests = [];
const pagesSeen = new Set();
const games = [];
const feedback = [];
let shots = 0;
function bug(title, severity, feature, steps, expected, actual, shot) {
  bugs.push({ title, severity, feature, steps, expected, actual, shot: shot ?? '' });
  log(`BUG [${severity}] ${title}: ${actual}`);
}
async function shot(page, name) {
  const file = `${when}-${++shots}-${name}.png`;
  await page.screenshot({ path: join(SHOTS, file), fullPage: false }).catch(() => {});
  return `shots/${file}`;
}

// ---- the local engine (a beginner: Stockfish's skill level, 0.1 s a move)
const require = createRequire(import.meta.url);
let waiting;
let ready;
const lines = [];
const sf = require('stockfish')('lite-single', (line) => {
  if (line === 'uciok' && ready) return ready();
  lines.push(line);
  if (waiting && line.startsWith('bestmove')) {
    const w = waiting;
    waiting = undefined;
    w(line.split(' ')[1]);
  }
});
await new Promise((r) => {
  ready = r;
  sf.processCommand('uci');
});
ready = undefined;
sf.processCommand(`setoption name Skill Level value ${Math.min(20, state.skill)}`);
const bestMove = (fen) =>
  new Promise((r) => {
    waiting = r;
    sf.processCommand(`position fen ${fen}`);
    sf.processCommand('go movetime 100');
  });

// ---- the browser
const browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...(existsSync(SESSION_FILE) ? { storageState: SESSION_FILE } : {}) });
const page = await ctx.newPage();
page.on('pageerror', (e) => consoleErrors.push({ url: page.url(), text: `Page error: ${String(e).slice(0, 300)}` }));
page.on('console', (m) => {
  // (The engines' own warnings, like onnxruntime's "Unknown CPU vendor", are not the site's errors.)
  if (m.type() === 'error' && !/favicon|ERR_BLOCKED_BY_CLIENT|onnxruntime/.test(m.text())) consoleErrors.push({ url: page.url(), text: m.text().slice(0, 300) });
});
page.on('requestfailed', (r) => {
  if (!/lichess\.org\/api\/(stream|board)|aborted/i.test(`${r.url()} ${r.failure()?.errorText}`)) failedRequests.push({ url: r.url().slice(0, 160), error: r.failure()?.errorText ?? '' });
});
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push({ url: r.url().slice(0, 160), error: `HTTP ${r.status()}`, page: page.url().replace(BASE, '') });
});

/** The site's consent dialog ("One quick thing", since 20 Oct 2026): answered as an adult tester, once. */
let consented = false;
async function consent() {
  const dlg = page.locator('[role="dialog"]:has-text("Agree and continue")').first();
  // It opens a moment after the page, once the account is known: wait for it until it has been answered once.
  const there = consented ? (await dlg.count().catch(() => 0)) > 0 : await dlg.waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (!there) return;
  await dlg.locator('input[type="radio"][value="adult"]').check({ timeout: 3000, force: true }).catch(() => {});
  await dlg.locator('input[type="checkbox"]').first().check({ timeout: 3000, force: true }).catch(() => {});
  await dlg.locator('button:has-text("Agree and continue")').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (await dlg.count().catch(() => 0)) {
    bug('The consent dialog does not close after agreeing', 'High', 'Consent dialog', 'Sign in, choose "I am 18 or older", tick the terms box, press "Agree and continue"', 'The dialog closes', 'It stays open', await shot(page, 'consent'));
    return;
  }
  consented = true;
  notes.push('Answered the consent dialog ("One quick thing") as an adult tester.');
  log('consent dialog answered');
}

async function open(path, what = path) {
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
  await consent();
  // The page's own load time (its load event), not the live connections some pages keep open.
  const ms = await page.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0]?.loadEventEnd ?? 0)).catch(() => 0);
  await page.waitForTimeout(1500);
  pagesSeen.add(path.split('?')[0]);
  if (ms > SLOW_MS) slow.push({ path, ms });
  const blank = (await page.locator('main').innerText().catch(() => '')).trim().length < 20;
  if (blank) bug(`Blank page: ${what}`, 'High', what, `Open ${BASE}${path}`, 'The page shows its content', 'The page was blank (under 20 characters of text) after loading', await shot(page, 'blank'));
  log(`open ${path} (${ms} ms)`);
  return ms;
}

// ---- sign in through Lichess
async function signIn() {
  await open('/');
  if (await page.locator('.me-name').filter({ hasText: /./ }).first().isVisible().catch(() => false)) {
    const name = await page.locator('.me-name').first().innerText();
    if (!/Profile/.test(name)) {
      log('already signed in as', name.trim());
      return name.trim();
    }
  }
  if (TOKEN) {
    await page.goto(`${BASE}/auth/token#token=${encodeURIComponent(TOKEN)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname === '/', { timeout: 30000 }).catch(() => {});
    const err = await page.locator('.error').first().innerText().catch(() => '');
    if (err) throw new Error(`Token sign-in failed: ${err}`);
    await page.waitForTimeout(2500);
    const name = (await page.locator('.me-name').first().innerText().catch(() => '')).trim();
    if (!name || /Profile/.test(name)) throw new Error('Token sign-in did not finish: the menu shows no account name.');
    await ctx.storageState({ path: SESSION_FILE });
    log('signed in with the token as', name);
    return name;
  }
  await page.locator('.btn.signin').first().click();
  await page.locator('.opt.lichess').click();
  await page.waitForURL(/lichess\.org/, { timeout: 30000 });
  if (/\/login/.test(page.url())) {
    await page.locator('#form3-username').fill(USER);
    await page.locator('#form3-password').fill(PASSWORD);
    // Lichess's sign-in has a Cloudflare "Verify you are human" check: the button stays off until
    // it passes (by itself in a visible browser, or with one click by a person). Never worked around.
    const submit = page.locator('form:has(#form3-password) button.submit:not([disabled])').first();
    const ok = await submit.waitFor({ timeout: HEADED ? 180_000 : 20_000 }).then(() => true, () => false);
    if (!ok) throw new Error('Lichess asks for a human check at sign-in (Cloudflare "Verify you are human"): stopping, as the rules say. Run once with --login and pass the check in the window.');
    await submit.click();
    await page.waitForLoadState('domcontentloaded');
    if (/\/login/.test(page.url())) throw new Error('Lichess did not accept the sign-in (wrong password, or the human check again).');
  }
  if (/\/oauth/.test(page.url())) {
    await page.locator('button:has-text("Authorize"), button:has-text("Authorise")').first().click({ timeout: 20000 });
  }
  await page.waitForURL((u) => u.origin === BASE, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const name = (await page.locator('.me-name').first().innerText().catch(() => '')).trim();
  if (!name || /Profile/.test(name)) throw new Error('Sign-in did not finish: the menu shows no account name.');
  await ctx.storageState({ path: SESSION_FILE });
  log('signed in as', name);
  return name;
}

/** The CC Rating in the menu ("CC Rating 1500 (new) · Rapid"). */
async function myRating() {
  const t = (await page.locator('.me-sub').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  const m = /CC Rating (\d+)( \(new\))? · (\w+)/.exec(t);
  return m ? { rating: Number(m[1]), provisional: !!m[2], speed: m[3], text: t } : { text: t };
}

/** The profile page: ratings, all-time stats, "how you play". */
async function profileSnapshot() {
  await open('/profile', 'Profile');
  const cc = (await page.locator('#cc-ratings').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
  const stats = (await page.locator('[aria-labelledby="stats-h"], .stats-card, section:has(#stats-h)').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 700);
  return { cc, stats };
}

// ---- a game against a FIDE-rated opponent
const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('k24.resume') ?? 'null')?.snapshot ?? null);
async function clickSquare(sq, color) {
  const box = await page.locator('cg-board').first().boundingBox();
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  const s = box.width / 8;
  const x = color === 'white' ? file : 7 - file;
  const y = color === 'white' ? 7 - rank : rank;
  await page.mouse.click(box.x + s * (x + 0.5), box.y + s * (y + 0.5));
}

async function playGame(n, opp, color, opening, fromLine = true) {
  const q = new URLSearchParams({ r: String(opp), tc: String(TC), c: color, ...(opening ? { o: opening, ...(fromLine ? { start: 'line' } : {}) } : {}) });
  const path = `/play/fide?${q}`;
  const g = { n, opp, color, opening: opening ?? '', path, moves: 0, result: '?', reason: '', ratingChange: '', review: '', mistakes: [], illegal: 0, problems: [] };
  games.push(g);
  await page.evaluate(() => localStorage.removeItem('k24.resume'));
  await open(path, 'FIDE-rated game');
  const board = page.locator('cg-board').first();
  await board.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const pos = Chess.default();
  let applied = 0;
  const t0 = Date.now();
  let lastMoveAt = Date.now();
  let stuck = 0;
  while (Date.now() - t0 < 25 * 60_000) {
    if (await page.locator('.reason').count()) break;
    const s = await snapshot();
    const uci = s?.moves.map((m) => m.uci) ?? [];
    for (; applied < uci.length; applied++) {
      const m = parseUci(uci[applied]);
      if (!m || !pos.isLegal(m)) {
        g.problems.push(`The game's move ${applied + 1} (${uci[applied]}) is not legal in the position the tester tracked.`);
        bug('A move in the game record is not legal', 'Critical', 'FIDE-rated game', `Play a game at ${path}; compare the saved moves (localStorage k24.resume) with a chess library`, 'Every move is legal', `Move ${applied + 1} ${uci[applied]} was not legal in the tracked position`, await shot(page, 'illegal'));
        break;
      }
      pos.play(m);
      lastMoveAt = Date.now();
    }
    g.moves = applied;
    if (pos.isEnd()) {
      // The game is over on the board: the site must say so within a few seconds.
      await page.locator('.reason').waitFor({ timeout: 8000 }).catch(async () => {
        bug('Game over on the board but the page did not end the game', 'Critical', 'FIDE-rated game', `Play ${path} until checkmate or stalemate`, 'The result card appears at once', 'No result card within 8 s', await shot(page, 'noend'));
      });
      break;
    }
    if (pos.turn === color) {
      if (!consented) await consent();
      const best = await bestMove(makeFen(pos.toSetup()));
      if (!best || best === '(none)') break;
      const m = parseUci(best);
      await clickSquare(makeSquare(m.from), color);
      await clickSquare(makeSquare(m.to), color);
      await page.waitForTimeout(200);
      // A promotion chooser, when auto-queen is off.
      const picker = page.locator('.promotion button, .promo button').first();
      if (await picker.count()) await picker.click().catch(() => {});
      let took = false;
      for (let i = 0; i < 40; i++) {
        const s2 = await snapshot();
        if ((s2?.moves.length ?? 0) > applied) {
          took = true;
          break;
        }
        await page.waitForTimeout(100);
      }
      if (!took) {
        stuck++;
        if (stuck >= 3) {
          g.illegal++;
          bug('A legal move could not be played by clicking', 'High', 'FIDE-rated game', `In ${path}, click ${makeSquare(m.from)} then ${makeSquare(m.to)} (a legal move)`, 'The move is played', `The move ${best} was not accepted after 3 tries`, await shot(page, 'move-refused'));
          break;
        }
        continue;
      }
      stuck = 0;
    } else {
      if (Date.now() - lastMoveAt > 90_000) {
        bug('The opponent did not move for 90 seconds', 'High', 'FIDE-rated game', `Play ${path} and wait for the computer's move`, 'The computer moves within its clock', 'No move for 90 s', await shot(page, 'opponent-stuck'));
        break;
      }
      await page.waitForTimeout(150);
    }
  }
  // Still not over (a long game): resign so the session goes on.
  if (!(await page.locator('.reason').count())) {
    const resign = page.locator('.actions.wide-only button:has-text("Resign")').first();
    if (await resign.count()) {
      await resign.click();
      await page.locator('button:has-text("Yes, resign")').click().catch(() => {});
      await page.locator('.reason').waitFor({ timeout: 8000 }).catch(() => {});
      g.problems.push('Resigned by the tester after 25 minutes or a stuck game.');
    }
  }
  g.result = (await page.locator('.tag.title').first().innerText().catch(() => '?')).trim();
  g.reason = (await page.locator('.reason').first().innerText().catch(() => '')).trim();
  g.ratingChange = (await page.locator('.kfide').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  g.minutes = Math.round((Date.now() - t0) / 6000) / 10;
  // The site's own verdict against the tester's board.
  if (pos.isCheckmate() && !/Checkmate/i.test(g.reason)) bug('Checkmate on the board, but the page gives another reason', 'Critical', 'FIDE-rated game', `Play ${path} to checkmate`, 'Reason: Checkmate', `Reason: "${g.reason}"`, await shot(page, 'mate-reason'));
  if (pos.isStalemate() && !/Stalemate/i.test(g.reason)) bug('Stalemate on the board, but the page gives another reason', 'Critical', 'FIDE-rated game', `Play ${path} to stalemate`, 'Reason: Stalemate', `Reason: "${g.reason}"`, await shot(page, 'stalemate-reason'));
  if (!g.ratingChange && !/aborted/i.test(g.reason)) bug('No CC Rating change shown after a FIDE-rated game', 'High', 'CC Rating', `Finish a game at ${path}`, 'The result card shows "CC Rating · Rapid 1520 (+20)"', 'No CC Rating line on the result card', await shot(page, 'no-rating'));
  log(`game ${n}: ${g.result} (${g.reason}) in ${g.moves} plies, ${g.ratingChange}`);
  // The review runs by itself after the game.
  const report = page.locator('.report').first();
  const reviewed = await report.waitFor({ timeout: 150_000 }).then(() => true, () => false);
  if (!reviewed) bug('The game review did not appear after the game', 'Medium', 'Game review', `Finish a game at ${path} and wait 2.5 minutes`, 'The review (accuracy, badges) appears under the result', 'No review after 150 s', await shot(page, 'no-review'));
  else g.review = (await report.innerText()).replace(/\s+/g, ' ').slice(0, 500);
  await shot(page, `game${n}-end`);
  // The analysis page: the badges on my moves.
  const id = await page.evaluate(() => new URL(document.querySelector('a[href^="/analysis?game="]')?.href ?? 'http://x/').searchParams.get('game'));
  if (id) {
    g.id = id;
    await open(`/analysis?game=${id}&review`, 'Analysis of my game');
    await page.locator('.tree .row .mv svg.badge').first().waitFor({ timeout: 120_000 }).catch(() => {});
    const marks = await page.evaluate((color) => {
      const out = [];
      for (const row of document.querySelectorAll('.tree .row')) {
        const no = Number((row.querySelector('.no')?.textContent ?? '').replace('.', '')) || 0;
        const [w, b] = [...row.children].filter((e) => e.classList.contains('mv'));
        const mine = color === 'white' ? w : b;
        const badge = mine?.querySelector('svg.badge');
        if (badge && no) out.push({ ply: no * 2 - (color === 'white' ? 1 : 0), san: mine.textContent.trim().split(/\s+/)[0], kind: badge.getAttribute('aria-label') });
      }
      return out;
    }, color);
    const order = ['Blunder', 'Missed win', 'Mistake', 'Inaccuracy'];
    g.mistakes = marks.filter((m) => order.includes(m.kind)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, 3).map((m) => `${Math.ceil(m.ply / 2)}${m.ply % 2 ? '.' : '…'} ${m.san} (${m.kind})`);
    g.reportText = (await page.locator('.report').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    await shot(page, `game${n}-analysis`);
  }
  return g;
}

// ---- a study activity: an opening course
async function studyCourse(c) {
  const f = { feature: `Learn → Openings → ${c.name}`, used: [] };
  await open(`/learn?tab=openings&sub=courses`, 'Learn → Openings');
  const card = page.locator(`.s-card[href^="/learn/study/${c.id}"]`).first();
  if (!(await card.count())) {
    bug(`The ${c.name} course is missing from Learn → Openings → Courses`, 'High', 'Learn', 'Open /learn?tab=openings&sub=courses', `A card for ${c.name}`, 'No card', await shot(page, 'no-course'));
    return f;
  }
  await card.click();
  await page.waitForURL(/\/learn\/study\//, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  pagesSeen.add(`/learn/study/${c.id}`);
  f.used.push('course page');
  f.intro = (await page.locator('.head-text').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
  // The line's plans.
  const chip = page.locator(`.lines .chip`).filter({ hasText: c.lineName }).first();
  if (await chip.count()) await chip.click();
  await page.waitForTimeout(1500);
  f.plans = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600);
  await shot(page, `study-${c.id}-plans`);
  // A model game, played through.
  await open(`/learn/study/${c.id}?line=${c.chapter}&tab=games`, 'Model games');
  const gcard = page.locator('.g-card').first();
  if (await gcard.waitFor({ timeout: 20000 }).then(() => true, () => false)) {
    f.modelGame = (await gcard.innerText()).replace(/\s+/g, ' ');
    await gcard.click();
    const through = page.locator('button:has-text("Play through")');
    if (await through.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
      await through.click();
      await page.waitForTimeout(12000);
      f.used.push('model game: play through');
    } else bug('Model game: no "Play through" button', 'Medium', f.feature, `Open /learn/study/${c.id}?line=${c.chapter}&tab=games and click the first game`, 'The game viewer with Play through', 'No viewer', await shot(page, 'no-viewer'));
    await shot(page, `study-${c.id}-model`);
  } else bug('Model games did not load', 'Medium', f.feature, `Open /learn/study/${c.id}?line=${c.chapter}&tab=games`, 'A list of model games', (await page.locator('main').innerText().catch(() => '')).includes('No model games') ? 'The page says "No model games for this line yet"' : 'None after 20 s', await shot(page, 'no-models'));
  // The trainer for this line: one line.
  await open(`/learn/openings/st-${c.id}--${c.line}`, 'Opening trainer');
  const build = page.locator('button:has-text("Build and start training")');
  if (await build.count()) await build.click();
  await page.locator('cg-board').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  f.trainer = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  f.used.push('trainer opened');
  await shot(page, `study-${c.id}-trainer`);
  return f;
}

// ---- the rest of Learn: one section a session, in turn (tactics, strategy, endgames, the plan,
// rated puzzles, a Guru review of a game, Masters, Vision Gym, Books).
const LEARN = ['tactics', 'puzzles', 'strategy', 'guru-review', 'endgames', 'database-review', 'masters-endgames', 'vision-drill', 'watch-game', 'openings-other', 'traps', 'books-read', 'leaderboard', 'plan', 'masters', 'vision', 'books'];

/** The board's position from the pieces on it (for puzzles, where the site keeps no move record). */
async function boardFen(side) {
  return page.evaluate((side) => {
    const board = document.querySelector('cg-board');
    if (!board) return '';
    const size = board.getBoundingClientRect().width / 8;
    const white = !document.querySelector('.cg-wrap.orientation-black');
    const grid = Array.from({ length: 8 }, () => Array(8).fill(''));
    for (const el of board.querySelectorAll('piece')) {
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform);
      if (!m || el.classList.contains('ghost')) continue;
      let f = Math.round(Number(m[1]) / size);
      let r = Math.round(Number(m[2]) / size);
      if (!white) {
        f = 7 - f;
        r = 7 - r;
      }
      const role = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].find((x) => el.classList.contains(x));
      const ch = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' }[role];
      grid[r][f] = el.classList.contains('white') ? ch.toUpperCase() : ch;
    }
    const rows = grid.map((row) => {
      let out = '';
      let n = 0;
      for (const c of row) {
        if (c) {
          if (n) out += n;
          n = 0;
          out += c;
        } else n++;
      }
      return out + (n || '');
    });
    return `${rows.join('/')} ${side[0]} - - 0 1`;
  }, side);
}

/** Solves one puzzle on the page with the local engine (no site hints); returns what the page said. */
async function solvePuzzle() {
  const h = page.locator('.msg[role="status"]').first();
  await page.locator('cg-board piece').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8; i++) {
    const text = (await h.innerText().catch(() => '')).trim();
    if (/Solved!|tricky|watch the answer|failed/i.test(text)) break;
    if (/Get ready/.test(text)) {
      await page.waitForTimeout(1200);
      continue;
    }
    const side = /Black to move/i.test(text) ? 'black' : 'white';
    const fen = await boardFen(side);
    if (!fen) break;
    let best;
    try {
      best = await bestMove(fen);
    } catch {
      break;
    }
    if (!best || best === '(none)') break;
    const orientation = (await page.locator('.cg-wrap.orientation-black').count()) ? 'black' : 'white';
    await clickSquare(best.slice(0, 2), orientation);
    await page.waitForTimeout(300);
    await clickSquare(best.slice(2, 4), orientation);
    await page.waitForTimeout(1800);
  }
  return (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
}

async function learnMore(which) {
  const f = { feature: `Learn → ${which}`, used: [], notes: [] };
  const lesson = async (tab) => {
    await open(`/learn?tab=${tab}`, `Learn → ${tab}`);
    // A lesson of this tab (its pane), not a link from the page's header or the sidebar.
    const WORDS = { tactics: /tactic|fork|pin|skewer|mate|discover|attack/i, strategy: /strateg|plan|pawn|structure|piece activity|outpost/i, endgames: /endgame|rook|king|pawn ending|opposition/i };
    const all = page.locator('.pane a[href^="/coach/"], .pane a[href^="/learn/"], main a[href^="/coach/"]');
    const matching = WORDS[tab] ? all.filter({ hasText: WORDS[tab] }) : all;
    const first = ((await matching.count()) ? matching : all).first();
    if (!(await first.count())) {
      f.notes.push('no lesson links found');
      return;
    }
    const href = await first.getAttribute('href');
    await first.click();
    await page.waitForTimeout(2500);
    pagesSeen.add(new URL(page.url()).pathname);
    f.used.push(`lesson ${href}`);
    f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
    // A lesson's buttons: Next / Continue / Show me, a few times.
    for (let i = 0; i < 4; i++) {
      const b = page.locator('main button:visible').filter({ hasText: /Next|Continue|Show|Start|Play|Got it/i }).first();
      if (!(await b.count())) break;
      await b.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await shot(page, `learn-${tab}`);
  };
  if (which === 'tactics') {
    await lesson('tactics');
    await open('/puzzles/themes', 'Themed puzzles');
    const theme = page.locator('main a[href*="/puzzles/themes"], main button').filter({ hasText: /fork|pin|mate|hanging|back rank|skewer/i }).first();
    if (await theme.count()) await theme.click().catch(() => {});
    f.puzzle = await solvePuzzle();
    f.used.push('themed puzzle');
    await shot(page, 'learn-tactics-puzzle');
  } else if (which === 'strategy') await lesson('strategy');
  else if (which === 'endgames') await lesson('endgames');
  else if (which === 'plan') {
    await open('/learn?tab=plan', 'Learn → Plan');
    f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
    f.used.push('weekly plan read');
    await shot(page, 'learn-plan');
  } else if (which === 'puzzles') {
    await open('/puzzles', 'Rated puzzles');
    const before = (await page.locator('main').innerText().catch(() => '')).match(/(\d{3,4})/)?.[1];
    const results = [];
    for (let i = 0; i < 4; i++) {
      await solvePuzzle();
      results.push(/Solved!/.test(await page.locator('.msg[role="status"]').first().innerText().catch(() => '')) ? 'solved' : 'missed');
      const next = page.locator('main button').filter({ hasText: /Next|Skip|Another/i }).first();
      if (!(await next.count())) break;
      await next.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    const after = (await page.locator('main').innerText().catch(() => '')).match(/(\d{3,4})/)?.[1];
    f.puzzles = results;
    f.text = `Puzzle rating ${before ?? '?'} → ${after ?? '?'}: ${results.join(', ')}`;
    f.used.push('rated puzzles');
    await shot(page, 'learn-puzzles');
  } else if (which === 'guru-review') {
    const g = games.find((x) => x.id);
    if (g) {
      await open(`/coach/review/${g.id}`, 'Guru review');
      await page.waitForTimeout(8000);
      for (let i = 0; i < 5; i++) {
        const b = page.locator('main button:visible').filter({ hasText: /Next|Continue|Start|Begin/i }).first();
        if (!(await b.count())) break;
        await b.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(2500);
      }
      f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
      f.used.push(`Guru review of game ${g.n}`);
      await shot(page, 'learn-guru');
    } else f.notes.push('no game to review');
  } else if (which === 'database-review') {
    // My last game against the 5.4 million games: what the database plays where I left it.
    const g = [...games].reverse().find((x) => x.id);
    if (g) {
      await open(`/analysis?game=${g.id}&tab=database`, 'Analysis → Database');
      await page.waitForTimeout(4000);
      const steps = [];
      for (let i = 0; i < 6; i++) {
        await page.locator('.panel-nav [aria-label="Next move"], [aria-label="Next move"]').first().click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(2500);
        const db = (await page.locator('.db, .card.db, .database').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
        const reached = /([\d,]+) rated games reached/.exec(db)?.[1];
        // The first row under the "Move · Games · White · Draw · Black" header: the database's top move.
        // The row reads "e4 Main 2.1M47%" once the spaces are collapsed (the tag and the share follow the move).
        const top = /White · Draw · Black\s+(\S+)(?: Main| Best score)?\s+([\d.,]+[kM]?)/.exec(db);
        steps.push(`${i + 1}: ${reached ?? '?'} games reached; top move ${top?.[1] ?? '?'} (${top?.[2] ?? '?'} games)`);
      }
      f.text = steps.join(' · ');
      f.used.push(`database review of game ${g.n}`);
      await shot(page, 'learn-database');
    } else f.notes.push('no game to review');
  } else if (which === 'masters-endgames') {
    await open('/learn/masters', 'Endgames with the masters');
    const t = page.locator('.t-card').first();
    if (await t.count()) {
      await t.click();
      await page.waitForTimeout(2500);
      pagesSeen.add(new URL(page.url()).pathname);
      const l = page.locator('.l-card').first();
      if (await l.count()) {
        const name = (await l.innerText()).replace(/\s+/g, ' ').slice(0, 80);
        await l.click();
        await page.waitForTimeout(4000);
        pagesSeen.add(new URL(page.url()).pathname);
        for (let i = 0; i < 5; i++) {
          const b = page.locator('main button:visible').filter({ hasText: /Next|Continue|Show|Play|Got it|Start/i }).first();
          if (!(await b.count())) break;
          await b.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
        f.used.push(`masters lesson: ${name}`);
      } else f.notes.push('no lesson cards on the master page');
      f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
    } else f.notes.push('no master cards');
    await shot(page, 'learn-masters-endgames');
  } else if (which === 'vision-drill') {
    // Blindfold puzzle: the board is shown, then hidden; the move is typed. The engine finds it
    // from a peek (practice, not rated), so this checks the drill, not Aarav's own vision.
    await open('/vision/blind', 'Vision Gym → blindfold');
    const easier = page.locator('button:has-text("After their move")');
    if (await easier.count()) await easier.click().catch(() => {});
    const results = [];
    for (let i = 0; i < 2; i++) {
      const peek = page.locator('button:has-text("Peek at the board")');
      if (!(await peek.count())) break;
      await peek.click();
      await page.waitForTimeout(400);
      const text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
      const side = /Black to (move|play)/i.test(text) ? 'black' : 'white';
      const fen = await boardFen(side);
      if (!fen) break;
      let san = '';
      try {
        const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
        const best = await bestMove(fen);
        const m = parseUci(best);
        san = makeSan(pos, m);
      } catch {
        break;
      }
      await page.waitForTimeout(2500);
      for (const ch of san.replace(/[+#]$/, '').match(/O-O-O|O-O|./g) ?? []) await page.locator('.key', { hasText: new RegExp(`^${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click({ timeout: 2000 }).catch(() => {});
      await page.locator('button:has-text("Play")').first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(2000);
      results.push(`${san}: ${(await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').match(/(Correct|Right|Solved|Not that|Wrong|answer was [^.]+)[^.]*/i)?.[0] ?? 'no verdict read'}`);
      const next = page.locator('main button, main a.btn').filter({ hasText: /Next|Another|again/i }).first();
      if (await next.count()) await next.click().catch(() => {});
      await page.waitForTimeout(2000);
    }
    f.text = results.join(' · ') || (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    f.used.push('blindfold drill (with peek)');
    await shot(page, 'learn-vision-blind');
  } else if (which === 'watch-game') {
    await open('/watch', 'Watch');
    const all = page.locator('a:has-text("Watch all boards")').first();
    if (await all.count()) {
      await all.click();
      await page.waitForTimeout(3000);
      pagesSeen.add(new URL(page.url()).pathname);
      const board = page.locator('a[href*="/watch/"]').filter({ hasNot: page.locator('text=Watch all boards') }).first();
      if (await board.count()) {
        await board.click();
        await page.waitForTimeout(4000);
        pagesSeen.add(new URL(page.url()).pathname);
        const moves = await page.locator('.moves-card button').count();
        await page.locator('.nav-card [aria-label="Previous move"]').first().click({ timeout: 4000 }).catch(() => f.notes.push('no Previous move button under the board'));
        await page.locator('label.toggle:has-text("Engine") input').check({ timeout: 4000 }).catch(() => f.notes.push('no Engine switch'));
        await page.waitForTimeout(4000);
        const engine = (await page.locator('label.toggle:has-text("Engine")').innerText().catch(() => '')).replace(/\s+/g, ' ');
        await page.locator('label.toggle:has-text("Database") input').check({ timeout: 4000 }).catch(() => f.notes.push('no Database switch'));
        await page.waitForTimeout(3000);
        f.text = `${moves} moves in the list; engine: ${engine}; database panel: ${(await page.locator('.card.db').count()) ? 'shown' : 'not shown'}`;
        f.used.push('a live board with moves, engine and database');
      } else f.notes.push('no board link on the tournament page');
    } else f.notes.push('no "Watch all boards" link');
    await shot(page, 'learn-watch');
  } else if (which === 'openings-other') {
    // The session's opening from the trainer's catalogue (a different one each session).
    await open(`/learn/openings/${catalogue.id}`, `Opening trainer: ${catalogue.id}`);
    const build = page.locator('button:has-text("Build and start training")');
    if (await build.count()) await build.click();
    await page.locator('cg-board').first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const before = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    // Two of my moves, by the engine: the trainer tells me when it is not the line's move.
    for (let i = 0; i < 2; i++) {
      const text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
      const side = /You play Black|Black to move/i.test(text) ? 'black' : 'white';
      const fen = await boardFen(side);
      if (!fen) break;
      const best = await bestMove(fen);
      const orientation = (await page.locator('.cg-wrap.orientation-black').count()) ? 'black' : 'white';
      await clickSquare(best.slice(0, 2), orientation);
      await page.waitForTimeout(300);
      await clickSquare(best.slice(2, 4), orientation);
      await page.waitForTimeout(2500);
    }
    f.text = `${before} … after two moves: ${(await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`;
    f.used.push(`${catalogue.id} trainer, two moves`);
    await shot(page, 'learn-italian');
  } else if (which === 'traps') {
    await open('/learn?tab=openings&sub=lessons', 'Opening lessons (traps)');
    const link = page.locator('main a').filter({ hasText: /trap|Opening basics|principles/i }).first();
    if (await link.count()) {
      const name = (await link.innerText()).replace(/\s+/g, ' ').slice(0, 80);
      await link.click();
      await page.waitForTimeout(3000);
      pagesSeen.add(new URL(page.url()).pathname);
      for (let i = 0; i < 6; i++) {
        const b = page.locator('main button:visible').filter({ hasText: /Next|Continue|Show|Got it/i }).first();
        if (!(await b.count())) break;
        await b.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      f.used.push(`lesson: ${name}`);
      f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
    } else f.notes.push('no lesson about traps or opening basics found');
    await shot(page, 'learn-traps');
  } else if (which === 'books-read') {
    await open('/books', 'Books');
    const first = page.locator('a[href^="/books/"]').first();
    if (await first.count()) {
      await first.click();
      await page.waitForTimeout(3000);
      pagesSeen.add(new URL(page.url()).pathname);
      const words = (await page.locator('main').innerText().catch(() => '')).split(/\s+/).length;
      await page.mouse.wheel(0, 2400);
      await page.waitForTimeout(1000);
      const next = page.locator('main a, main button').filter({ hasText: /Next|chapter/i }).first();
      if (await next.count()) await next.click().catch(() => {});
      await page.waitForTimeout(2000);
      f.text = `${words} words on the first page; ${(await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`;
      f.used.push('a book: first page read, next chapter');
    } else f.notes.push('no book links');
    await shot(page, 'learn-books-read');
  } else if (which === 'leaderboard') {
    await open('/leaderboard', 'Leaderboard');
    const text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
    f.text = text.slice(0, 400);
    f.used.push(`leaderboard (${/chesscastlestester/i.test(text) ? 'I am on it' : 'I am not on it'})`);
    const tab = page.locator('main button[aria-pressed], main .chip').nth(1);
    if (await tab.count()) await tab.click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, 'learn-leaderboard');
  } else if (which === 'masters') {
    await open('/learn/masters', 'Masters');
    f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
    const first = page.locator('main a[href^="/learn/masters/"], main a.btn, main button.btn').first();
    if (await first.count()) {
      await first.click().catch(() => {});
      await page.waitForTimeout(3000);
      f.used.push('a masters lesson opened');
    }
    await shot(page, 'learn-masters');
  } else if (which === 'vision') {
    await open('/vision', 'Vision Gym');
    const start = page.locator('main a.btn, main button.btn').first();
    if (await start.count()) await start.click().catch(() => {});
    await page.waitForTimeout(3000);
    f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
    f.used.push('vision exercise opened');
    await shot(page, 'learn-vision');
  } else if (which === 'books') {
    await open('/books', 'Books');
    const first = page.locator('main a[href^="/books/"]').first();
    if (await first.count()) {
      await first.click().catch(() => {});
      await page.waitForTimeout(3000);
      f.used.push('a book opened');
    }
    f.text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
    await shot(page, 'learn-books');
  }
  return f;
}

// ---- one more feature
async function tryFeature(path) {
  const ms = await open(path, path);
  const text = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const f = { feature: path, ms, headings: await page.locator('main h1, main h2').allInnerTexts().then((h) => h.slice(0, 8).map((x) => x.trim()).filter(Boolean)), buttons: await page.locator('main button, main a.btn').count(), text: text.slice(0, 300) };
  // Every button that is visible gets one tap; a page that breaks shows as an error.
  const btn = page.locator('main button:visible').first();
  if (await btn.count()) {
    const label = (await btn.innerText()).trim().slice(0, 40);
    await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    f.tapped = label;
  }
  await shot(page, `feature-${path.replace(/[^a-z]/gi, '')}`);
  return f;
}

// ---- phone width: the pages seen, at 390 px
async function phoneCheck() {
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await pctx.newPage();
  const out = [];
  for (const path of [...pagesSeen].filter((x) => !x.startsWith('/play/') && !x.startsWith('/analysis')).slice(0, 10)) {
    try {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(2000);
      const sideways = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const tiny = await p.evaluate(() => [...document.querySelectorAll('main button, main a')].filter((e) => e.offsetParent && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 24).length);
      out.push({ path, sideways, tiny });
      if (sideways) {
        const file = `${when}-phone-${path.replace(/[^a-z]/gi, '') || 'home'}.png`;
        await p.screenshot({ path: join(SHOTS, file) });
        bug(`Sideways scroll at 390 px: ${path}`, 'Medium', 'Layout (phone)', `Open ${BASE}${path} at 390 px wide`, 'No horizontal scrolling', 'The page is wider than the screen', `shots/${file}`);
      }
    } catch (e) {
      out.push({ path, error: String(e).slice(0, 100) });
    }
  }
  await pctx.close();
  return out;
}

// ---- sign out
async function signOut() {
  await open('/more', 'More');
  const b = page.locator('button:has-text("Sign out")').first();
  if (await b.count()) {
    if (TOKEN) {
      // The site's Sign out revokes the Lichess token on Lichess (a personal token too): the
      // session ends by closing the browser instead; the button's presence is checked.
      notes.push("Signed out by closing the browser: the site's Sign out would revoke the personal access token.");
      log('session ended (browser closed; Sign out not pressed with a personal token)');
    } else {
      await b.click();
      await page.waitForTimeout(1500);
      const still = await page.locator('.me-name').filter({ hasText: USER }).count();
      if (still) bug('Sign out leaves the account signed in', 'High', 'Account', 'More → Sign out', 'The menu shows Sign in', 'The account name is still shown', await shot(page, 'signout'));
      else log('signed out');
    }
  } else bug('No Sign out button on More', 'High', 'Account', 'Open /more while signed in', 'A Sign out button', 'None', await shot(page, 'no-signout'));
}

// ---- the session
const before = {};
const after = {};
let studied;
let learned;
/** This session's catalogue opening (trained in "openings-other", played in game 5). */
let catalogue = CATALOGUE[0];
let feature;
let phone = [];
let signedInAs = '';
try {
  signedInAs = await signIn();
  if (LOGIN_ONLY) {
    log('session kept in', SESSION_FILE);
    await browser.close();
    sf.processCommand('quit');
    process.exit(0);
  }
  if (ONLY) {
    const f = await learnMore(ONLY);
    console.log(JSON.stringify(f, null, 1));
    await browser.close();
    process.exit(0);
  }
  before.menu = await myRating();
  before.profile = await profileSnapshot();
  log('before:', before.menu.text);
  const course = COURSES[(state.session - 1) % COURSES.length];
  catalogue = CATALOGUE[(state.session - 1) % CATALOGUE.length];
  const my = before.menu.rating ?? 1500;
  // An opponent within about 100 points (the opponents go from 1400 up, in steps of 100).
  const opp = Math.max(1400, Math.min(2800, Math.round(my / 100) * 100));
  const plain = Math.min(2, GAMES);
  // Game 1 at my level, game 2 one level up (how I do against stronger FIDE-rated opponents).
  for (let n = 1; n <= plain; n++) await playGame(n, n === 2 ? Math.min(2800, opp + 100) : opp, n % 2 ? 'white' : 'black');
  studied = await studyCourse(course);
  learned = await learnMore(LEARN[(state.session - 1) % LEARN.length]).catch((e) => ({ feature: 'Learn', used: [], notes: [String(e).slice(0, 200)] }));
  // Games 3 and 4 from the course's line; game 5 with the session's catalogue opening (the
  // opponent follows the opening's moves; Aarav plays it from move one).
  for (let n = plain + 1; n <= GAMES; n++) {
    if (n === GAMES) await playGame(n, opp, catalogue.side, catalogue.id, false);
    else await playGame(n, opp, course.side, `st-${course.id}--${course.line}`);
  }
  // The study steps were done: one level up (the persona improves by studying).
  state.skill = Math.min(20, state.skill + 1);
  feature = await tryFeature(FEATURES[(state.session - 1) % FEATURES.length]);
  after.profile = await profileSnapshot();
  after.menu = await myRating();
  phone = await phoneCheck();
  await signOut();
} catch (e) {
  bug('The session stopped with an error', 'Critical', 'Session', 'Run the tester', 'The routine completes', String(e).slice(0, 300), await shot(page, 'crash'));
}
await browser.close();

// ---- the bug list across sessions (de-duplicated by title)
const master = existsSync(BUGS_FILE) ? JSON.parse(readFileSync(BUGS_FILE, 'utf8')) : [];
const today = when.slice(0, 10);
for (const b of bugs) {
  const m = master.find((x) => x.title === b.title);
  if (m) {
    m.lastSeen = today;
    m.times++;
    m.fixed = false;
  } else master.push({ id: `B${String(master.length + 1).padStart(3, '0')}`, ...b, firstSeen: today, lastSeen: today, times: 1, fixed: false });
}
for (const m of master) if (!bugs.some((b) => b.title === m.title) && m.lastSeen !== today) m.fixed = true;
writeFileSync(BUGS_FILE, JSON.stringify(master, null, 1));
writeFileSync(join(REPORTS, 'bugs-master.md'), [
  '# Chess Castles · bugs found by the tester (all sessions)', '',
  `Updated ${today}. "Fixed?" = it did not come up again in a later session.`, '',
  '| ID | Title | Severity | Feature | First seen | Last seen | Times | Status |', '|---|---|---|---|---|---|---|---|',
  ...master.map((m) => `| ${m.id} | ${m.title} | ${m.severity} | ${m.feature} | ${m.firstSeen} | ${m.lastSeen} | ${m.times} | ${m.fixed ? 'Fixed?' : 'Open'} |`),
  '', ...master.map((m) => `## ${m.id} ${m.title}\n\n- Steps: ${m.steps}\n- Expected: ${m.expected}\n- Actual: ${m.actual}${m.shot ? `\n- Screenshot: ${m.shot}` : ''}`),
].join('\n'));

// ---- the session's data, for the written report
const data = { when, base: BASE, signedInAs, skill: state.skill, session: state.session, before, after, games, studied, learned, feature, phone, slow, consoleErrors, failedRequests, bugs, pages: [...pagesSeen] };
writeFileSync(join(DATA, `session-${when}.json`), JSON.stringify(data, null, 1));
const idOf = (b) => master.find((m) => m.title === b.title)?.id ?? '';
const md = [
  `# Tester session ${when} · ${BASE}`, '',
  `Signed in as **${signedInAs || '(sign-in failed)'}** · session ${state.session} · engine skill level after this session: ${state.skill}`, '',
  '## 1. Summary', '',
  `- Games played: ${games.length} (rapid 15+10, against FIDE-rated opponents ${[...new Set(games.map((g) => g.opp))].join(' and ')})`,
  ...games.map((g) => `- Game ${g.n}: vs FIDE ${g.opp} · ${g.result} · ${g.reason} · ${g.moves} plies · ${g.minutes} min · as ${g.color}${g.opening ? ` · from the studied line (${g.opening})` : ''} · ${g.ratingChange || 'no rating line'}`),
  `- Rating before: ${before.menu?.text ?? '?'}`, `- Rating after: ${after.menu?.text ?? '?'}`, '',
  '## 2. Bugs', '',
  bugs.length ? '| ID | Title | Severity | Feature | Steps to reproduce | Expected | Actual | Screenshot |\n|---|---|---|---|---|---|---|---|\n' + bugs.map((b) => `| ${idOf(b)} | ${b.title} | ${b.severity} | ${b.feature} | ${b.steps} | ${b.expected} | ${b.actual} | ${b.shot} |`).join('\n') : 'No bugs found this session.',
  '', `Console errors: ${consoleErrors.length}`, ...consoleErrors.slice(0, 15).map((c) => `- ${c.url.replace(BASE, '')}: ${c.text}`),
  `Failed requests: ${failedRequests.length}`, ...[...new Map(failedRequests.map((c) => [`${c.error} ${c.url}`, c])).values()].slice(0, 15).map((c) => `- ${c.error} ${c.url} (on ${c.page})`),
  `Slow pages (over ${SLOW_MS / 1000} s): ${slow.length}`, ...slow.map((s) => `- ${s.path}: ${s.ms} ms`),
  `Phone width (390 px): ${phone.map((p) => `${p.path} ${p.error ? 'ERROR' : p.sideways ? 'sideways scroll' : 'ok'}${p.tiny ? ` (${p.tiny} tiny targets)` : ''}`).join('; ') || 'not checked'}`, '',
  '## 3. Analysis of my games', '',
  ...games.map((g) => `### Game ${g.n} (${g.result})\n\n- Biggest mistakes (my moves): ${g.mistakes.length ? g.mistakes.join('; ') : 'none marked'}\n- Review under the game: ${g.review || 'none'}\n- Report tab: ${g.reportText || 'none'}${g.problems.length ? `\n- Problems: ${g.problems.join(' ')}` : ''}`),
  '', '## 4. Weakness profile (profile page)', '', `Before: ${before.profile?.stats || 'none'}`, '', `After: ${after.profile?.stats || 'none'}`, '',
  '## 5. Study activity', '', studied ? `${studied.feature}: ${studied.used.join(', ') || 'nothing used'}\n\n- Course intro: ${studied.intro || ''}\n- Plans text: ${studied.plans || ''}\n- Model game: ${studied.modelGame || 'none'}\n- Trainer: ${studied.trainer || ''}` : 'not done',
  '', '## 5b. More of Learn', '', learned ? `${learned.feature}: ${learned.used.join(', ') || 'nothing used'}${learned.notes.length ? ` · ${learned.notes.join('; ')}` : ''}\n\n${learned.text ?? ''}${learned.puzzle ? `\n\nPuzzle: ${learned.puzzle}` : ''}` : 'not done',
  '', '## 6. Feature tried', '', feature ? `${feature.feature} (${feature.ms} ms): headings ${JSON.stringify(feature.headings)}; ${feature.buttons} buttons/links; tapped "${feature.tapped ?? ''}"\n\n${feature.text}` : 'not done',
  '', '## 7. Feature feedback, beginner questions and UI notes', '', '(written by Aarav after reading the session: see the end of this file)', '',
  ...(notes.length ? ['Notes:', ...notes.map((n) => `- ${n}`), ''] : []),
].join('\n');
const file = join(REPORTS, `session-${when}.md`);
writeFileSync(file, md);
writeFileSync(STATE_FILE, JSON.stringify({ ...state, used: [...(state.used ?? []), feature?.feature].filter(Boolean) }, null, 1));
log(`report: ${file}; bugs this session: ${bugs.length}`);
// Last: the engine's quit ends the process.
sf.processCommand('quit');

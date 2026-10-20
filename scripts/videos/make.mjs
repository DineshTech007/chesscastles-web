// Makes the feature videos (scripts/videos/features.mjs): for every feature and language, a
// 15–20 second screen recording of the real page (Playwright) with a caption bar, a voice
// from Edge's neural voices (edge-tts, free), put together with ffmpeg into
// static/videos/<feature>-<lang>.mp4 plus a poster static/videos/<feature>.jpg.
//   node scripts/videos/make.mjs [--only fide-play,puzzles] [--lang en] [--base https://chesscastles.com]
// Needs: python -m pip install edge-tts; npm i -D ffmpeg-static (both free).
import { execFileSync as _exec, spawnSync } from 'node:child_process';
const execFileSync = (cmd, args, opts = {}) => {
  try {
    return _exec(cmd, args, { ...opts, stdio: opts.stdio === 'ignore' ? ['ignore', 'ignore', 'pipe'] : opts.stdio });
  } catch (e) {
    if (opts.stdio === 'ignore') {
      console.error(`
${cmd} ${args.slice(0, 6).join(' ')} … failed:
${String(e.stderr).slice(-1500)}`);
      throw new Error('command failed');
    }
    throw e;
  }
};
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';
import { FEATURES, LANGS, VOICES } from './features.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = flag('--base', 'https://chesscastles.com').replace(/\/$/, '');
const ONLY = flag('--only', '')?.split(',').filter(Boolean);
const LANG_ONLY = flag('--lang', '');
const OUT = 'static/videos';
const WORK = 'tester-data/videos';
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const GAP = 0.45;

/** Seconds of an audio file, from ffmpeg's own report (it writes it to stderr). */
function duration(file) {
  const r = spawnSync(ffmpeg, ['-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(`${r.stderr}${r.stdout}`);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** The narration: one mp3 per sentence, padded with a short gap, joined; returns the start time of each sentence. */
function narrate(id, lang, sentences) {
  const dir = join(WORK, `${id}-${lang}`);
  mkdirSync(dir, { recursive: true });
  const starts = [];
  let t = 0.3;
  const parts = [];
  sentences.forEach((text, i) => {
    const mp3 = join(dir, `s${i}.mp3`);
    if (!existsSync(mp3)) execFileSync('python', ['-m', 'edge_tts', '--voice', VOICES[lang], `--rate=${lang === 'en' ? '+6%' : '+16%'}`, '--text', text, '--write-media', mp3], { stdio: 'ignore' });
    const wav = join(dir, `s${i}.wav`);
    execFileSync(ffmpeg, ['-y', '-i', mp3, '-af', `apad=pad_dur=${GAP}`, '-ar', '24000', '-ac', '1', wav], { stdio: 'ignore' });
    starts.push(t);
    t += duration(mp3) + GAP;
    parts.push(wav);
  });
  const list = join(dir, 'list.txt');
  require('node:fs').writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/').replace(/^.*?tester-data/, process.cwd().replace(/\\/g, '/') + '/tester-data')}'`).join('\n'));
  const voice = join(dir, 'voice.wav');
  execFileSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-af', 'adelay=300|300', voice], { stdio: 'ignore' });
  return { voice, starts, total: t };
}
const require = createRequire(import.meta.url);

// A local engine for the puzzle step (the best move from the pieces on the board).
let sfWaiting;
let sfReady;
const sf = require('stockfish')('lite-single', (line) => {
  if (line === 'uciok' && sfReady) return sfReady();
  if (sfWaiting && line.startsWith('bestmove')) {
    const w = sfWaiting;
    sfWaiting = undefined;
    w(line.split(' ')[1]);
  }
});
await new Promise((r) => {
  sfReady = r;
  sf.processCommand('uci');
});
const bestMove = (fen) =>
  new Promise((r) => {
    sfWaiting = r;
    sf.processCommand(`position fen ${fen}`);
    sf.processCommand('go movetime 400');
  });

async function clickSquare(page, sq, color = 'white') {
  const box = await page.locator('cg-board').first().boundingBox();
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const s = box.width / 8;
  const x = color === 'white' ? f : 7 - f;
  const y = color === 'white' ? 7 - r : r;
  await page.mouse.move(box.x + s * (x + 0.5), box.y + s * (y + 0.5), { steps: 12 });
  await page.mouse.click(box.x + s * (x + 0.5), box.y + s * (y + 0.5));
}
async function boardFen(page, side) {
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

/** Dismisses the consent dialog and the fair play promise, if they show. */
async function dialogs(page) {
  const dlg = page.locator('[role="dialog"]:has-text("Agree and continue")').first();
  if (await dlg.count().catch(() => 0)) {
    await dlg.locator('input[type="radio"][value="adult"]').check({ force: true }).catch(() => {});
    await dlg.locator('input[type="checkbox"]').first().check({ force: true }).catch(() => {});
    await dlg.locator('button:has-text("Agree and continue")').click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const promise = page.locator('button:has-text("I promise to play fair")').first();
  if (await promise.count().catch(() => 0)) await promise.click().catch(() => {});
}

async function runStep(page, step) {
  if (step.wait) return page.waitForTimeout(step.wait);
  // Wait for something to appear (a review to finish, a page to load), up to its timeout.
  if (step.waitFor) return page.locator(step.waitFor).first().waitFor({ timeout: step.timeout ?? 20000 }).catch(() => console.log('   (not seen in time:', step.waitFor, ')'));
  if (step.click) {
    const loc = page.locator(step.click).first();
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
      const box = await loc.boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await loc.click({ timeout: 3000 });
    } catch (e) {
      if (!step.optional) console.log('   (step skipped:', step.click, ')');
    }
    return page.waitForTimeout(400);
  }
  if (step.move) {
    await clickSquare(page, step.move[0]);
    await page.waitForTimeout(350);
    await clickSquare(page, step.move[1]);
    return page.waitForTimeout(300);
  }
  if (step.solve) {
    const text = (await page.locator('.msg[role="status"]').first().innerText().catch(() => '')).trim();
    const side = /Black to move/i.test(text) ? 'black' : 'white';
    const fen = await boardFen(page, side);
    const best = fen ? await bestMove(fen) : '';
    if (best && best !== '(none)') {
      const orientation = (await page.locator('.cg-wrap.orientation-black').count()) ? 'black' : 'white';
      await clickSquare(page, best.slice(0, 2), orientation);
      await page.waitForTimeout(350);
      await clickSquare(page, best.slice(2, 4), orientation);
    }
    return page.waitForTimeout(500);
  }
}

const lastGame = (() => {
  try {
    const d = JSON.parse(readFileSync('reports/aarav-data.json', 'utf8'));
    return [...d.games].reverse().find((g) => g.result === 'loss')?.id ?? d.games.at(-1)?.id;
  } catch {
    return undefined;
  }
})();
// The practice account's shortest finished game (its review on camera takes the least time).
const gameIds = (() => {
  try {
    const files = readdirSync('tester-data').filter((f) => /^session-.*\.json$/.test(f)).sort();
    let best;
    for (const f of files) {
      const d = JSON.parse(readFileSync(join('tester-data', f), 'utf8'));
      for (const g of d.games) if (g.id && g.moves >= 20 && g.result !== '?' && (!best || g.moves < best.moves)) best = g;
    }
    return best?.id;
  } catch {
    /* none */
  }
  return undefined;
})();

/** Signs in as the practice account once (answering the consent dialog), and keeps the browser state for the recordings. */
const STATE = join(WORK, 'state.json');
async function signInOnce() {
  if (!process.env.NIGHT24_TEST_TOKEN || existsSync(STATE)) return;
  const browser = await chromium.launch({ channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/token#token=${encodeURIComponent(process.env.NIGHT24_TEST_TOKEN)}`, { waitUntil: 'load' });
  await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 }).catch(() => {});
  await page.locator('[role="dialog"]:has-text("Agree and continue")').first().waitFor({ timeout: 6000 }).catch(() => {});
  await dialogs(page);
  await page.waitForTimeout(1500);
  // My games once, so the account's games are in this browser for the Game Report video.
  await page.goto(`${BASE}/games`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  await ctx.storageState({ path: STATE, indexedDB: true });
  await browser.close();
  console.log('signed in; state kept');
}

async function record(feature, lang, narration) {
  await signInOnce();
  const session = existsSync(STATE) ? { storageState: STATE } : {};
  const dir = join(WORK, `${feature.id}-${lang}`);
  for (const f of readdirSync(dir)) if (f.endsWith('.webm')) rmSync(join(dir, f));
  const browser = await chromium.launch({ channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } }, ...session, locale: lang === 'en' ? 'en-IN' : `${lang}-IN` });
  const page = await ctx.newPage();
  // The site's content language, so the page itself shows the same language as the voice.
  await page.addInitScript((l) => localStorage.setItem('cc.lang', l), lang);
  const ctxStart = Date.now();
  const path = feature.path.replace('LAST', gameIds ?? lastGame ?? '');
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await dialogs(page);
  // Steps before the clock starts (a review to finish, say): not in the video.
  for (const step of feature.pre ?? []) await runStep(page, step);
  // The recording began with the context: the time before the page was ready is cut off.
  const offset = (Date.now() - ctxStart) / 1000;
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'cc-cap';
    Object.assign(d.style, { position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)', maxWidth: '88%', padding: '10px 18px', borderRadius: '12px', background: 'rgba(11,20,38,.93)', color: '#fff', font: '600 22px "Segoe UI", "Nirmala UI", sans-serif', lineHeight: '1.3', zIndex: 2147483647, textAlign: 'center', boxShadow: '0 4px 18px rgba(0,0,0,.4)', border: '1px solid rgba(237,176,64,.6)', display: 'none' });
    document.body.appendChild(d);
  });
  const t0 = Date.now();
  const caption = (text) => page.evaluate((t) => { const d = document.getElementById('cc-cap'); if (d) { d.textContent = t; d.style.display = t ? 'block' : 'none'; } }, text).catch(() => {});
  // Captions on the narration's clock; the steps run alongside.
  const timers = narration.starts.map((s, i) => setTimeout(() => void caption(feature.say[lang][i]), Math.max(0, s * 1000 - (Date.now() - t0))));
  for (const step of feature.steps) await runStep(page, step);
  const remaining = narration.total * 1000 + 900 - (Date.now() - t0);
  if (remaining > 0) await page.waitForTimeout(remaining);
  timers.forEach(clearTimeout);
  await ctx.close();
  await browser.close();
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'));
  return { webm: join(dir, webm), offset };
}

for (const feature of FEATURES) {
  if (ONLY.length && !ONLY.includes(feature.id)) continue;
  for (const lang of LANGS) {
    if (LANG_ONLY && lang !== LANG_ONLY) continue;
    const out = join(OUT, `${feature.id}-${lang}.mp4`);
    console.log(`${feature.id} · ${lang}`);
    const narration = narrate(feature.id, lang, feature.say[lang]);
    const { webm, offset } = await record(feature, lang, narration);
    execFileSync(ffmpeg, ['-y', '-ss', offset.toFixed(2), '-i', webm, '-i', narration.voice, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], { stdio: 'ignore' });
    const poster = join(OUT, `${feature.id}.jpg`);
    if (lang === 'en') execFileSync(ffmpeg, ['-y', '-ss', '2', '-i', out, '-frames:v', '1', '-q:v', '4', poster], { stdio: 'ignore' });
    console.log(`   ${out} (${(narration.total + 0.9).toFixed(1)} s)`);
  }
}
sf.processCommand('quit');

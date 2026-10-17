// Interaction checks in a real browser: premove queue, resigning, the game
// landing in My games, and opening it on the analysis board.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const log = (...a) => console.log('•', ...a);

// 90+30: the bot thinks a long time once past the first moves.
await page.goto(`${BASE}/play/fide?r=1800&tc=5&c=white`, { waitUntil: 'networkidle' });
const box = await page.locator('cg-board').boundingBox();
const click = (f, r) => page.mouse.click(box.x + (f + 0.5) * (box.width / 8), box.y + (7 - r + 0.5) * (box.height / 8));
const moves = async () => (await page.locator('.moves .mv').allInnerTexts()).map((s) => s.trim()).filter(Boolean);

await click(4, 1); // e2
await click(4, 3); // e4
await page.waitForFunction(() => document.querySelectorAll('.moves .mv').length >= 2 && document.querySelectorAll('.moves .mv')[1].textContent.trim());
await click(6, 0); // g1
await click(5, 2); // f3: the bot now thinks for a while
await page.waitForTimeout(400);
log('after Nf3:', (await moves()).join(' '), '| bot thinking:', await page.locator('.dot').count() > 0);

// Two premoves while it thinks: d2-d4, then f1-c4.
await click(3, 1);
await click(3, 3);
await page.waitForTimeout(300);
await click(5, 0);
await click(2, 3);
await page.waitForTimeout(300);
const cancel = page.getByRole('button', { name: /Cancel premoves/ });
log('premove button:', (await cancel.count()) ? await cancel.innerText() : 'missing');
await page.screenshot({ path: 'shots/desktop-premoves.png' });

// Resign (two steps), then check the result card.
await page.getByRole('button', { name: 'Resign' }).click();
await page.getByRole('button', { name: 'Yes, resign' }).click();
await page.waitForTimeout(400);
log('result:', (await page.locator('.result').innerText()).replace(/\s+/g, ' ').slice(0, 80));
await page.screenshot({ path: 'shots/desktop-result.png' });

// My games, then the analysis board.
await page.goto(`${BASE}/games`, { waitUntil: 'networkidle' });
const first = page.locator('.list .open').first();
log('my games first entry:', (await first.innerText()).replace(/\s+/g, ' '));
await first.click();
await page.waitForURL(/analysis\?game=/);
await page.waitForTimeout(1500);
log('analysis title:', await page.locator('.page-title').innerText(), '| moves:', (await moves()).join(' '));
await page.screenshot({ path: 'shots/desktop-analysis-game.png' });

await browser.close();
console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no page errors');

// Screens the Vision Gym: hub, a blindfold puzzle (given up, to see the reveal), a sprint, Move Memory and Piece Sight.
// Run: node scripts/flow-vision.mjs https://knight24-web.knight24.workers.dev out-dir
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 950 }, colorScheme: 'dark' });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(base + '/vision'); await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/v-hub.png`, fullPage: true });
await page.goto(base + '/vision/blind'); await page.waitForSelector('#vision-move'); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/v-blind.png` });
await page.fill('#vision-move', 'Zz9'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
console.log('illegal note:', await page.locator('.note').innerText());
await page.getByRole('button', { name: 'Show the answer' }).click(); await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/v-blind-reveal.png` });
await page.goto(base + '/vision/sprint'); await page.getByRole('button', { name: 'Start' }).click(); await page.waitForTimeout(400);
for (let i = 0; i < 6; i++) { await page.locator('.opt').first().click(); await page.waitForTimeout(150); }
await page.screenshot({ path: `${out}/v-sprint.png` });
await page.goto(base + '/vision/memory'); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'I have it in my head' }).click(); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/v-memory.png` });
await page.goto(base + '/vision/sight'); await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/v-sight.png` });
await b.close();

// Runs Guru's analysis on a public chess.com player's last 10 games and screens the report and the plan.
// Run: node scripts/flow-insights.mjs https://knight24-web.knight24.workers.dev out-dir [username]
import { chromium } from 'playwright';
const [base, out, user = 'hikaru'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, colorScheme: 'dark' });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(base + '/insights');
await p.fill('#ins-user', user);
await p.selectOption('#ins-count', '10');
const t0 = Date.now();
await p.getByRole('button', { name: /Analyse my games|Analyse again/ }).click();
await p.waitForSelector('.say', { timeout: 60000 });
await p.waitForFunction(() => !document.querySelector('.prog'), null, { timeout: 400000 });
console.log('analysed in', Math.round((Date.now() - t0) / 1000), 's');
console.log((await p.locator('.say p').innerText()).slice(0, 300));
console.log('weaknesses:', await p.locator('.weak h3').allInnerTexts());
await p.screenshot({ path: `${out}/insights.png`, fullPage: true });
await p.getByRole('button', { name: 'Build my weekly plan' }).click();
await p.waitForURL(/learn/);
await p.waitForTimeout(1500);
await p.locator('#guru-plan').screenshot({ path: `${out}/guru-plan.png` });
await b.close();

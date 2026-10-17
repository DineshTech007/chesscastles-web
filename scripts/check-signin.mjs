// Clicks "Sign in with Lichess" and checks the request sent to Lichess.
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE + '/learn', { waitUntil: 'networkidle' });
await page.waitForSelector('button:has-text("Sign in with Lichess")', { timeout: 15000 });
await page.screenshot({ path: 'shots/signin-menu.png' });
await Promise.all([page.waitForURL(/lichess\.org/, { timeout: 20000 }), page.getByRole('button', { name: 'Sign in with Lichess' }).first().click()]);
let u = new URL(page.url());
// Not logged in on Lichess: it shows its login page and keeps our request in `referrer`.
if (u.searchParams.get('referrer')) u = new URL(u.searchParams.get('referrer'), 'https://lichess.org');
const p = u.searchParams;
console.log('went to:', u.origin + u.pathname);
console.log('client_id:', p.get('client_id'), '| method:', p.get('code_challenge_method'), '| challenge length:', p.get('code_challenge')?.length);
console.log('redirect_uri:', p.get('redirect_uri'));
console.log('scope:', p.get('scope'));
await page.screenshot({ path: 'shots/signin-lichess.png' });
await browser.close();
console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no page errors');

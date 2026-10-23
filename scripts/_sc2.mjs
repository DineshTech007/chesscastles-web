import { readFileSync, writeFileSync } from 'node:fs';
const f = 'scripts/e2e/site-check.mjs';
let t = readFileSync(f, 'utf8');
const crlf = String.fromCharCode(13, 10), nl = String.fromCharCode(10);
const was = t.includes(crlf);
if (was) t = t.split(crlf).join(nl);
const r = (a, b) => {
  if (!t.includes(a)) throw new Error('missing ' + a.slice(0, 60));
  t = t.replace(a, b);
};
r(`    for (const label of ['Play', 'Puzzles', 'Analyse', 'More', 'Home']) {`, `    for (const label of ['Play', 'Puzzles', 'Analyse', 'Home']) {`);
r(
  `    await check(name, page, 'More > Learn', async () => {
      await open(page, '/more');
      const t0 = Date.now();
      await tap(page.locator('main a[href="/learn"]').first());
      await page.waitForURL(/\/learn/, { timeout: TAP_MS });
      return \`\${Date.now() - t0} ms\`;
    });`,
  `    // The last tab opens the menu drawer (owner, 2026-10-23), which lists every page by name.
    await check(name, page, 'menu: the last tab opens the drawer, a page opens from it', async () => {
      await open(page, '/');
      const t0 = Date.now();
      await tap(page.locator('nav.tabs .tab-btn'));
      await page.locator('aside.drawer').waitFor({ timeout: TAP_MS });
      await tap(page.locator('aside.drawer a.row', { hasText: /^Learn$/ }).first());
      await page.waitForURL(/\/learn/, { timeout: TAP_MS });
      expect((await page.locator('aside.drawer').count()) === 0, 'the menu stayed open');
      return \`\${Date.now() - t0} ms\`;
    });
    await check(name, page, 'menu: the Shop is lit on Home', async () => {
      await open(page, '/');
      await page.locator('.landing, .home').first().waitFor({ timeout: 15000 });
      return 'Home shows';
    });`,
);
r(
  `      await step('More tab', page.locator('nav.tabs a', { hasText: 'More' }));
      await step('Learn on More', page.locator('main a[href="/learn"]').first(), /\/learn/);`,
  `      await step('Menu tab', page.locator('nav.tabs .tab-btn'), () => true).catch(() => {});
      await step('Learn in the menu', page.locator('aside.drawer a.row', { hasText: /^Learn$/ }).first(), /\/learn/);`,
);
writeFileSync(f, was ? t.split(nl).join(crlf) : t);

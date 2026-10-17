// PNG sizes of the Chess Castles logo (from static/brand/*.svg), and a preview sheet.
// Run: node scripts/brand-png.mjs static/brand out-preview.png
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, preview] = process.argv.slice(2);
const svg = (n) => readFileSync(join(dir, n), 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
const shot = async (name, w, h, out, bg = 'transparent') => {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0;background:${bg}"><div style="width:${w}px;height:${h}px">${svg(name).replace('<svg ', `<svg style="width:${w}px;height:${h}px;display:block" `)}</div></body></html>`);
  await p.screenshot({ path: join(dir, out), omitBackground: bg === 'transparent' });
};
await shot('favicon.svg', 32, 32, 'favicon-32.png');
await shot('favicon.svg', 48, 48, 'favicon-48.png');
await shot('icon-maskable.svg', 180, 180, 'apple-touch-icon.png');
await shot('icon.svg', 192, 192, 'icon-192.png');
await shot('icon.svg', 512, 512, 'icon-512.png');
await shot('icon-maskable.svg', 512, 512, 'icon-maskable-512.png');
await shot('social-card.svg', 1200, 630, 'social-card.png');
// Preview sheet: every version on its background.
const tile = (n, bg, w) => `<div style="background:${bg};padding:24px;border-radius:14px;display:flex;align-items:center;justify-content:center">${svg(n).replace('<svg ', `<svg style="width:${w}px;height:auto" `)}</div>`;
await p.setViewportSize({ width: 1240, height: 1180 });
await p.setContent(`<html><body style="margin:0;padding:24px;background:#eeebe4;font-family:sans-serif">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
${tile('chesscastles-logo-slogan-light.svg', '#fff', 420)}${tile('chesscastles-logo-slogan-dark.svg', '#0b1426', 420)}
${tile('chesscastles-stacked-light.svg', '#fff', 340)}${tile('chesscastles-stacked-dark.svg', '#0b1426', 340)}
</div>
<div style="display:flex;gap:20px;align-items:center;margin-top:18px">
<img src="data:image/svg+xml;base64,${Buffer.from(svg('icon.svg')).toString('base64')}" width="128">
<img src="data:image/svg+xml;base64,${Buffer.from(svg('icon.svg')).toString('base64')}" width="64">
<img src="data:image/svg+xml;base64,${Buffer.from(svg('favicon.svg')).toString('base64')}" width="32">
<img src="data:image/svg+xml;base64,${Buffer.from(svg('favicon.svg')).toString('base64')}" width="16">
<img src="data:image/svg+xml;base64,${Buffer.from(svg('social-card.svg')).toString('base64')}" width="560" style="margin-left:auto;border-radius:10px">
</div></body></html>`);
await p.screenshot({ path: preview, fullPage: true });
await b.close();
console.log('done');

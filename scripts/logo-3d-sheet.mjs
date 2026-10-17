// One preview picture per 3D design: dark and light lockups, app icon and small sizes.
// Run: node scripts/logo-3d-sheet.mjs design/logo-3d out-dir
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [dir, out] = process.argv.slice(2);
const uri = (f) => 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(`${dir}/${f}`)).toString('base64');
const TITLES = { royal: '1 · Royal Crest', marble: '2 · Marble Tower', rising: '3 · Rising Rook', quartered: '4 · Quartered Crest', laurel: '5 · Champion Laurel' };
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
for (const [name, title] of Object.entries(TITLES)) {
  await p.setContent(`<html><body style="margin:0;font-family:Segoe UI,sans-serif;background:#eeebe4">
  <div style="width:1600px;height:900px;box-sizing:border-box;padding:40px;display:flex;flex-direction:column;gap:24px">
    <div style="font-size:34px;font-weight:800;color:#141a2b">${title}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div style="height:360px;border-radius:24px;background:#0b1426;display:flex;align-items:center;justify-content:center"><img src="${uri(name + '-lockup-dark.svg')}" style="width:640px"></div>
      <div style="height:360px;border-radius:24px;background:#fff;display:flex;align-items:center;justify-content:center"><img src="${uri(name + '-lockup-light.svg')}" style="width:640px"></div>
    </div>
    <div style="display:flex;gap:40px;align-items:center">
      <div style="width:220px;height:220px;border-radius:50px;background:#0b1426;display:flex;align-items:center;justify-content:center"><img src="${uri(name + '-mark.svg')}" style="height:170px"></div>
      <div style="width:120px;height:120px;border-radius:28px;background:#0b1426;display:flex;align-items:center;justify-content:center"><img src="${uri(name + '-mark.svg')}" style="height:92px"></div>
      <div style="width:64px;height:64px;border-radius:14px;background:#0b1426;display:flex;align-items:center;justify-content:center"><img src="${uri(name + '-mark.svg')}" style="height:50px"></div>
      <div style="width:32px;height:32px;border-radius:7px;background:#0b1426;display:flex;align-items:center;justify-content:center"><img src="${uri(name + '-mark.svg')}" style="height:26px"></div>
      <div style="width:220px;height:220px;border-radius:50px;background:#fff;display:flex;align-items:center;justify-content:center;margin-left:auto"><img src="${uri(name + '-mark.svg')}" style="height:170px"></div>
    </div>
  </div></body></html>`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${name}-sheet.png` });
}
await b.close();
console.log('ok');

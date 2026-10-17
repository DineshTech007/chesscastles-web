import { chromium } from 'playwright';
const [file, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 600, height: 260 } });
await p.goto('file:///' + file); await p.screenshot({ path: out }); await b.close();

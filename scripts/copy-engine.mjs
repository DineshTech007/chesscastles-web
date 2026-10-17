// Copies the single-threaded Stockfish build into static/ so the browser can
// load it as a Web Worker (no special server headers needed).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const bin = join('node_modules', 'stockfish', 'bin');
if (!existsSync(bin)) process.exit(0);
const out = join('static', 'engine');
mkdirSync(out, { recursive: true });
const files = readdirSync(bin).filter((f) => /lite-single\.(js|wasm)$/.test(f));
for (const f of files) copyFileSync(join(bin, f), join(out, f));
console.log('engine files:', files.join(', ') || 'none found');

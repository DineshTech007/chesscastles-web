// Builds the premium board images (static/boards/<id>.webp) from two material textures: each square is cut from a
// different place of its texture (so no two squares look alike), wood squares alternate the grain direction like a
// real inlaid board, and a fine line between squares gives the inlay. The grid is exact (8 x 128 px), so the
// squares always line up with the board's own squares.
//
//   node scripts/boards/compose.mjs <textures dir> static/boards
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SQ = 128;
const BOARDS = [
  { id: 'wood', light: 'maple.png', dark: 'walnut.png', turn: true },
  { id: 'marble', light: 'marble-w.png', dark: 'marble-g.png', turn: false },
  // Ebony as dark as the real wood would hide the black pieces: a deep brown instead.
  { id: 'ebony', light: 'ivory.png', dark: 'ebony.png', turn: true, darkLift: 1.9 },
  { id: 'stone', light: 'sand.png', dark: 'slate.png', turn: false },
];

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

for (const b of BOARDS) {
  const tiles = [];
  for (let rank = 0; rank < 8; rank++)
    for (let file = 0; file < 8; file++) {
      const light = (rank + file) % 2 === 0;
      const tex = sharp(`${src}/${light ? b.light : b.dark}`);
      const { width, height } = await tex.metadata();
      const size = Math.round(Math.min(width, height) * 0.3);
      const left = Math.floor(rand() * (width - size));
      const top = Math.floor(rand() * (height - size));
      let img = sharp(`${src}/${light ? b.light : b.dark}`).extract({ left, top, width: size, height: size }).resize(SQ, SQ);
      if (b.turn && !light) img = img.rotate(90);
      if (!light && b.darkLift) img = img.linear(1.1, 22 * b.darkLift).modulate({ saturation: 1.2 });
      tiles.push({ input: await img.png().toBuffer(), left: file * SQ, top: rank * SQ });
    }
  // The inlay: a fine dark line around every square, a little light on top for depth.
  const lines = [];
  for (let i = 0; i <= 8; i++) {
    lines.push(`<rect x="${i * SQ - 1}" y="0" width="2" height="${8 * SQ}" fill="rgba(0,0,0,0.18)"/>`);
    lines.push(`<rect x="0" y="${i * SQ - 1}" width="${8 * SQ}" height="2" fill="rgba(0,0,0,0.18)"/>`);
  }
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${8 * SQ}" height="${8 * SQ}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".07"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${lines.join('')}</svg>`,
  );
  const info = await sharp({ create: { width: 8 * SQ, height: 8 * SQ, channels: 3, background: '#000' } })
    .composite([...tiles, { input: overlay, left: 0, top: 0 }])
    .webp({ quality: 80 })
    .toFile(`${out}/${b.id}.webp`);
  console.log(b.id, info.size);
}

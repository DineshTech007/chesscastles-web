/**
 * Pictures of each piece to compare a diagram's pieces with: the site's own piece sets (static/pieces), drawn on
 * the diagram's light and dark square colours, read exactly like a printed square, a little larger or smaller and a
 * little shifted each way (a printed grid is never cut exactly).
 */
import type { Label } from './fen';
import { blocks, correlation, Integral, normalise, toGray, VEC, type Rect } from './vision';

const SETS = ['merida', 'cburnett', 'chessnut', 'spatial'];
const NAMES: Record<Exclude<Label, ''>, string> = { K: 'wK', Q: 'wQ', R: 'wR', B: 'wB', N: 'wN', P: 'wP', k: 'bK', q: 'bQ', r: 'bR', b: 'bB', n: 'bN', p: 'bP' };
const SHIFTS = [-0.08, -0.04, 0, 0.04, 0.08];

export interface Template {
  label: Exclude<Label, ''>;
  set: string;
  /** The background it was drawn on. */
  bg: number;
  /** The blocks the piece covers (unshifted), and its mean brightness there: light for White's, dark for Black's. */
  mask: number[];
  inside: number;
  /** The same picture shifted by up to a twelfth of a square each way. */
  vecs: Float32Array[];
}

const images = new Map<string, Promise<HTMLImageElement | undefined>>();
function image(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(undefined);
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

/** Each piece of each set, on each background level given (0–255 grey), as normalised pictures. */
export async function templates(backgrounds: number[], size = 64): Promise<Template[]> {
  const out: Template[] = [];
  const pad = Math.round(size * 0.15);
  const full = size + 2 * pad;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = full;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // The piece's own outline: where its picture is opaque (never the background), block by block.
  const shape = document.createElement('canvas');
  shape.width = shape.height = full;
  const sctx = shape.getContext('2d', { willReadFrequently: true })!;
  const coverage = (img: HTMLImageElement, inset: number): number[] => {
    sctx.clearRect(0, 0, full, full);
    const p = pad + inset * size;
    sctx.drawImage(img, p, p, size - 2 * inset * size, size - 2 * inset * size);
    const a = sctx.getImageData(0, 0, full, full).data;
    const out: number[] = [];
    const bw = (size * 0.9) / VEC;
    for (let by = 0; by < VEC; by++)
      for (let bx = 0; bx < VEC; bx++) {
        let on = 0, n = 0;
        for (let y = Math.round(pad + size * 0.05 + by * bw); y < pad + size * 0.05 + (by + 1) * bw; y++)
          for (let x = Math.round(pad + size * 0.05 + bx * bw); x < pad + size * 0.05 + (bx + 1) * bw; x++) {
            n++;
            if (a[(y * full + x) * 4 + 3] > 128) on++;
          }
        if (n && on / n > 0.7) out.push(by * VEC + bx);
      }
    return out;
  };
  for (const set of SETS) {
    for (const [label, name] of Object.entries(NAMES) as [Exclude<Label, ''>, string][]) {
      const img = await image(`/pieces/${set}/${name}.svg`);
      if (!img) continue;
      // A little larger than the square, exactly it, and a little smaller (fonts sit differently in their squares).
      const masks = new Map([-0.04, 0, 0.07].map((inset) => [inset, coverage(img, inset)]));
      for (const bg of backgrounds) {
        for (const inset of [-0.04, 0, 0.07]) {
          ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
          ctx.fillRect(0, 0, full, full);
          const p = pad + inset * size;
          ctx.drawImage(img, p, p, size - 2 * inset * size, size - 2 * inset * size);
          const g = toGray(ctx.getImageData(0, 0, full, full).data, full, full);
          const I = new Integral(g, { x: 0, y: 0, w: full, h: full });
          const vecs: Float32Array[] = [];
          let mask: number[] = [];
          let inside = 0;
          for (const dy of SHIFTS)
            for (const dx of SHIFTS) {
              // The same cut as a printed square (vision.readCells: a 5% margin), moved a little.
              const box: Rect = { x: pad + size * (0.05 + dx), y: pad + size * (0.05 + dy), w: size * 0.9, h: size * 0.9 };
              const raw = blocks(I, box, VEC);
              vecs.push(normalise(raw));
              if (dx === 0 && dy === 0) {
                mask = masks.get(inset) ?? [];
                inside = mask.reduce((n, i) => n + raw[i], 0) / Math.max(1, mask.length);
              }
            }
          out.push({ label, set, bg, mask, inside, vecs });
        }
      }
    }
  }
  return out;
}

/** How well a picture matches each piece (the best over every set, background, size and shift), and that match. */
export function scoresFor(vec: Float32Array, temps: Template[]): Map<Exclude<Label, ''>, { score: number; t: Template }> {
  const best = new Map<Exclude<Label, ''>, { score: number; t: Template }>();
  for (const t of temps) {
    let s = -1;
    for (const v of t.vecs) s = Math.max(s, correlation(vec, v));
    if (s > (best.get(t.label)?.score ?? -2)) best.set(t.label, { score: s, t });
  }
  return best;
}

/**
 * The name for a group: the best match, except that when a piece's two colours come close (a shaded white queen's
 * bands look like a black queen's once blurred), the colour whose piece is as bright as the group inside the piece's
 * own outline wins (`raw`: the group's picture with its brightness).
 */
export function nameFor(vec: Float32Array, raw: Float32Array, temps: Template[]): { label: Exclude<Label, ''>; score: number; runner?: [string, number] } | undefined {
  const ranked = [...scoresFor(vec, temps)].sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return undefined;
  const [first, second] = ranked;
  let pick = first;
  if (second && first[0].toLowerCase() === second[0].toLowerCase() && first[1].score - second[1].score < 0.08) {
    const gap = (t: Template) => {
      const mine = t.mask.reduce((n, i) => n + raw[i], 0) / Math.max(1, t.mask.length);
      return Math.abs(mine - t.inside);
    };
    if (gap(second[1].t) < gap(first[1].t)) pick = second;
  }
  const other = ranked.find((r) => r[0] !== pick[0]);
  return { label: pick[0], score: pick[1].score, runner: other ? [other[0], other[1].score] : undefined };
}

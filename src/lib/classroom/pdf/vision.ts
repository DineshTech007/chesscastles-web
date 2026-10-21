/**
 * Finding chess diagrams in a rendered page and reading their squares (pure: grey pixels in, numbers out). Works on
 * printed diagrams (a frame, white light squares, grey or hatched dark ones) and on coloured screenshot boards.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A page's pixels as luminance (0 black … 255 white) and colourfulness (0 grey … 255 vivid). */
export interface Gray {
  width: number;
  height: number;
  data: Uint8Array;
  sat: Uint8Array;
}

export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Gray {
  const n = width * height;
  const data = new Uint8Array(n);
  const sat = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = rgba[j + 3];
    // Transparent counts as paper.
    const r = a === 255 ? rgba[j] : 255 - (((255 - rgba[j]) * a) >> 8);
    const g = a === 255 ? rgba[j + 1] : 255 - (((255 - rgba[j + 1]) * a) >> 8);
    const b = a === 255 ? rgba[j + 2] : 255 - (((255 - rgba[j + 2]) * a) >> 8);
    data[i] = (r * 77 + g * 150 + b * 29) >> 8;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return { width, height, data, sat };
}

/** The paper's level: the commonest bright value (255 for clean pages, lower for scans). */
export function paperLevel(g: Gray): number {
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor(g.data.length / 200_000));
  for (let i = 0; i < g.data.length; i += step) hist[g.data[i]]++;
  let best = 255;
  for (let v = 150; v < 256; v++) if (hist[v] > hist[best]) best = v;
  return best;
}

/** Bounding boxes of 8-connected groups of set pixels (union-find over one pass). */
export function components(mask: Uint8Array, w: number, h: number): (Rect & { n: number })[] {
  const parent = new Int32Array(w * h).fill(-1);
  const find = (i: number) => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };
  const join = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      parent[i] = i;
      if (x > 0 && mask[i - 1]) join(i, i - 1);
      if (y > 0) {
        const up = i - w;
        if (mask[up]) join(i, up);
        if (x > 0 && mask[up - 1]) join(i, up - 1);
        if (x < w - 1 && mask[up + 1]) join(i, up + 1);
      }
    }
  }
  const boxes = new Map<number, Rect & { n: number; x2: number; y2: number }>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const r = find(i);
      const b = boxes.get(r);
      if (!b) boxes.set(r, { x, y, w: 1, h: 1, n: 1, x2: x, y2: y });
      else {
        b.n++;
        if (x < b.x) b.x = x;
        if (x > b.x2) b.x2 = x;
        if (y > b.y2) b.y2 = y;
      }
    }
  }
  return [...boxes.values()].map((b) => ({ x: b.x, y: b.y, w: b.x2 - b.x + 1, h: b.y2 - b.y + 1, n: b.n }));
}

/**
 * Square-ish groups of ink big enough to be a board: the frame (or the dark squares touching at their corners, or a
 * coloured board) holds a whole diagram together. Worked out on a half-size mask, so a page is quick.
 */
export function boardCandidates(g: Gray, minSide = 72): Rect[] {
  const paper = paperLevel(g);
  const w2 = Math.floor(g.width / 2), h2 = Math.floor(g.height / 2);
  const mask = new Uint8Array(w2 * h2);
  const ink = paper - 28;
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      let on = 0;
      for (let dy = 0; dy < 2 && !on; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const i = (2 * y + dy) * g.width + 2 * x + dx;
          if (g.data[i] < ink || g.sat[i] > 45) {
            on = 1;
            break;
          }
        }
      mask[y * w2 + x] = on;
    }
  }
  const out: Rect[] = [];
  for (const c of components(mask, w2, h2)) {
    const W = c.w * 2, H = c.h * 2;
    if (W < minSide || H < minSide) continue;
    if (W > g.width * 0.98 && H > g.height * 0.6) continue;
    const ratio = W / H;
    if (ratio < 0.85 || ratio > 1.18) continue;
    if (c.n < c.w * c.h * 0.08) continue;
    out.push({ x: c.x * 2, y: c.y * 2, w: W, h: H });
  }
  return out;
}

/** Dark-pixel share of a row (y) or column (x) between `from` and `to`. */
function lineShare(g: Gray, along: 'row' | 'col', at: number, from: number, to: number, dark: number): number {
  let n = 0;
  const len = to - from;
  if (len <= 0) return 0;
  if (along === 'row') {
    const base = at * g.width;
    for (let x = from; x < to; x++) if (g.data[base + x] < dark) n++;
  } else for (let y = from; y < to; y++) if (g.data[y * g.width + at] < dark) n++;
  return n / len;
}

/**
 * The squares inside a candidate: frame lines (rows or columns almost all dark near an edge) are cut off, and the
 * blank paper between a double frame too.
 */
export function trimFrame(g: Gray, r: Rect): Rect {
  const dark = 120;
  const zone = Math.max(3, Math.round(Math.min(r.w, r.h) * 0.07));
  let top = r.y, bottom = r.y + r.h - 1, left = r.x, right = r.x + r.w - 1;
  const x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.h;
  let last = -1;
  for (let y = top; y < top + zone; y++) if (lineShare(g, 'row', y, x0, x1, dark) > 0.55) last = y;
  if (last >= 0) top = last + 1;
  last = -1;
  for (let y = bottom; y > bottom - zone; y--) if (lineShare(g, 'row', y, x0, x1, dark) > 0.55) last = y;
  if (last >= 0) bottom = last - 1;
  last = -1;
  for (let x = left; x < left + zone; x++) if (lineShare(g, 'col', x, y0, y1, dark) > 0.55) last = x;
  if (last >= 0) left = last + 1;
  last = -1;
  for (let x = right; x > right - zone; x--) if (lineShare(g, 'col', x, y0, y1, dark) > 0.55) last = x;
  if (last >= 0) right = last - 1;
  // A margin of paper left inside a frame (a gap before the squares): stepped over while a row is all paper.
  const paper = paperLevel(g) - 12;
  const blankRow = (y: number) => lineShare(g, 'row', y, left, right + 1, paper) < 0.02;
  const blankCol = (x: number) => lineShare(g, 'col', x, top, bottom + 1, paper) < 0.02;
  // Only a thin gap: a light first rank of squares must not be eaten (its dark squares stop it at once).
  for (let i = 0; i < zone && blankRow(top) && blankRow(top + 1); i++) top++;
  for (let i = 0; i < zone && blankRow(bottom) && blankRow(bottom - 1); i++) bottom--;
  for (let i = 0; i < zone && blankCol(left) && blankCol(left + 1); i++) left++;
  for (let i = 0; i < zone && blankCol(right) && blankCol(right - 1); i++) right--;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/** Sums over rectangles in O(1): the summed-area table of one region of the page. */
export class Integral {
  readonly sum: Float64Array;
  constructor(
    readonly g: Gray,
    readonly r: Rect,
  ) {
    const W = r.w + 1;
    this.sum = new Float64Array(W * (r.h + 1));
    for (let y = 0; y < r.h; y++) {
      let row = 0;
      const src = (r.y + y) * g.width + r.x;
      for (let x = 0; x < r.w; x++) {
        row += g.data[src + x];
        this.sum[(y + 1) * W + x + 1] = this.sum[y * W + x + 1] + row;
      }
    }
  }
  /** The mean over [x0, x1) × [y0, y1), in the region's own coordinates (clamped). */
  mean(x0: number, y0: number, x1: number, y1: number): number {
    const W = this.r.w + 1;
    const a = Math.max(0, Math.min(this.r.w, Math.round(x0))), b = Math.max(0, Math.min(this.r.w, Math.round(x1)));
    const c = Math.max(0, Math.min(this.r.h, Math.round(y0))), d = Math.max(0, Math.min(this.r.h, Math.round(y1)));
    const area = (b - a) * (d - c);
    if (area <= 0) return 255;
    return (this.sum[d * W + b] - this.sum[c * W + b] - this.sum[d * W + a] + this.sum[c * W + a]) / area;
  }
}

/** One square of the grid: its inner box (a margin cut on each side), in the region's coordinates. */
export function cellBox(grid: Rect, index: number, margin: number): Rect {
  const cw = grid.w / 8, ch = grid.h / 8;
  const c = index % 8, r = Math.floor(index / 8);
  return { x: c * cw + margin * cw, y: r * ch + margin * ch, w: cw * (1 - 2 * margin), h: ch * (1 - 2 * margin) };
}

/** `n`×`n` block means of a box (a blurred, small copy of the square). */
export function blocks(I: Integral, box: Rect, n: number): Float32Array {
  const out = new Float32Array(n * n);
  const bw = box.w / n, bh = box.h / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = I.mean(box.x + x * bw, box.y + y * bh, box.x + (x + 1) * bw, box.y + (y + 1) * bh);
  return out;
}

export function meanVar(v: ArrayLike<number>): { mean: number; v: number } {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  const mean = s / v.length;
  let q = 0;
  for (let i = 0; i < v.length; i++) q += (v[i] - mean) ** 2;
  return { mean, v: q / v.length };
}

export interface CellRead {
  /** Spread of the square's blurred copy: near 0 for an empty square (hatching blurs away), large for a piece. */
  spread: number;
  mean: number;
  /** The square's picture for telling pieces apart (16×16, normalised), and as it is (brightness kept). */
  vec: Float32Array;
  raw: Float32Array;
}

export const VEC = 16;

export function readCells(g: Gray, grid: Rect): CellRead[] {
  const I = new Integral(g, grid);
  const out: CellRead[] = [];
  const full: Rect = { x: 0, y: 0, w: grid.w, h: grid.h };
  for (let i = 0; i < 64; i++) {
    const coarse = blocks(I, cellBox(full, i, 0.14), 6);
    const mv = meanVar(coarse);
    const fine = blocks(I, cellBox(full, i, 0.05), VEC);
    out.push({ spread: mv.v, mean: mv.mean, vec: normalise(fine), raw: fine });
  }
  return out;
}

/** Zero mean, unit length: pictures compared by their shape, not their brightness. */
export function normalise(v: Float32Array): Float32Array {
  const { mean } = meanVar(v);
  const out = new Float32Array(v.length);
  let q = 0;
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] - mean;
    q += out[i] * out[i];
  }
  const len = Math.sqrt(q) || 1;
  for (let i = 0; i < v.length; i++) out[i] /= len;
  return out;
}

export function correlation(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Which squares hold a piece: the spreads split in two (Otsu on their logarithm), never below a floor (an empty board
 * is all empty). At least half a board is always empty (32 pieces at most).
 */
export function pieceSquares(cells: CellRead[], floor = 60): boolean[] {
  const logs = cells.map((c) => Math.log(c.spread + 4));
  const sorted = [...logs].sort((a, b) => a - b);
  let best = -1, cut = Infinity;
  const total = sorted.reduce((a, b) => a + b, 0);
  let left = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    left += sorted[i];
    const n1 = i + 1, n2 = sorted.length - n1;
    const m1 = left / n1, m2 = (total - left) / n2;
    const between = n1 * n2 * (m1 - m2) ** 2;
    if (between > best) {
      best = between;
      cut = (sorted[i] + sorted[i + 1]) / 2;
    }
  }
  const t = Math.max(Math.exp(cut) - 4, floor, Math.exp(sorted[31]) * 3);
  return cells.map((c) => c.spread > t);
}

/**
 * Whether a grid is a chessboard: its empty squares alternate light and dark (the top-left square is light whichever
 * side is at the bottom). Returns the share that fits and the two square colours.
 */
export function checker(cells: CellRead[], occupied: boolean[]): { fit: number; empties: number; light: number; dark: number } {
  const empties = cells.map((c, i) => ({ c, i })).filter(({ i }) => !occupied[i]);
  if (empties.length < 10) return { fit: 0, empties: empties.length, light: 255, dark: 0 };
  const lightSq = empties.filter(({ i }) => (Math.floor(i / 8) + (i % 8)) % 2 === 0);
  const darkSq = empties.filter(({ i }) => (Math.floor(i / 8) + (i % 8)) % 2 === 1);
  const avg = (l: typeof empties) => (l.length ? l.reduce((s, x) => s + x.c.mean, 0) / l.length : NaN);
  const light = avg(lightSq), dark = avg(darkSq);
  if (!(light - dark > 10)) return { fit: 0, empties: empties.length, light, dark };
  const mid = (light + dark) / 2;
  const fits = empties.filter(({ c, i }) => (c.mean > mid) === ((Math.floor(i / 8) + (i % 8)) % 2 === 0)).length;
  return { fit: fits / empties.length, empties: empties.length, light, dark };
}

/** Same-font pieces cluster tightly: each new picture joins the closest group, or starts its own. */
export function cluster(vecs: Float32Array[], threshold = 0.86): { assign: number[]; centroids: Float32Array[]; sizes: number[] } {
  const sums: Float32Array[] = [];
  const centroids: Float32Array[] = [];
  const sizes: number[] = [];
  const assign: number[] = [];
  for (const v of vecs) {
    let best = -1, score = threshold;
    for (let k = 0; k < centroids.length; k++) {
      const c = correlation(v, centroids[k]);
      if (c > score) {
        score = c;
        best = k;
      }
    }
    if (best < 0) {
      sums.push(Float32Array.from(v));
      centroids.push(Float32Array.from(v));
      sizes.push(1);
      assign.push(centroids.length - 1);
    } else {
      const s = sums[best];
      for (let i = 0; i < v.length; i++) s[i] += v[i];
      sizes[best]++;
      centroids[best] = normalise(s);
      assign.push(best);
    }
  }
  // One more pass: each picture to its closest final group (the groups settle).
  for (let j = 0; j < vecs.length; j++) {
    let best = assign[j], score = -2;
    for (let k = 0; k < centroids.length; k++) {
      const c = correlation(vecs[j], centroids[k]);
      if (c > score) {
        score = c;
        best = k;
      }
    }
    assign[j] = best;
  }
  const counts = centroids.map((_, k) => assign.filter((a) => a === k).length);
  return { assign, centroids, sizes: counts };
}

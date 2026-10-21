/**
 * A puzzle PDF to positions, on the coach's own computer: every page is drawn, its chess diagrams found, every square
 * read; pieces drawn the same way (one font in the whole PDF) are grouped and each group named by comparing it with
 * the site's piece sets. The coach checks the groups once and fixes any diagram; the engine then finds each answer.
 */
import type { Item } from '../api';
import { coordsFlipped, fenOf, looksFlipped, placementOf, problemOf, sideFromText, sideThatWorks, type Label } from './fen';
import { linesOf, openPdf, pageWords, renderPage, renderRegion, type Word } from './load';
import { bestLine, entriesFor, numberOf } from './solutions';
import { nameFor, templates } from './templates';
import { boardCandidates, checker, cluster, correlation, pieceSquares, readCells, toGray, trimFrame, type Rect } from './vision';

export interface Diagram {
  id: string;
  /** The page it is on (from 1). */
  page: number;
  /** The diagram as printed (a small image). */
  crop: string;
  /** Per square, from the top left as printed: the piece group, or -1 for an empty square. */
  cells: number[];
  /** Black at the bottom, from the printed coordinates (undefined: worked out from the pieces). */
  flipped?: boolean;
  side: 'white' | 'black';
  /** Where the side to move came from: the words beside the diagram, the coach, or a guess (White). */
  sideFrom: 'text' | 'coach' | 'guess';
  caption: string;
  /** How well the empty squares alternate light and dark (1: perfectly). */
  fit: number;
  /** A FEN the coach set by hand (then the groups no longer change it). */
  manual?: string;
  removed?: boolean;
  /** The puzzle's number as printed (or its place in the PDF when nothing is numbered). */
  number?: number;
  /** Texts that may hold its printed solution (under the diagram, entries with its number). */
  solutions: string[];
  /** An answer the coach typed or played in, for the position it was made for. */
  coach?: { fen: string; line: string[] };
  /** The engine's answer, for the position it was found for. */
  engine?: { fen: string; line: string[]; note: string };
}
export interface Group {
  id: number;
  /** One square of this group: which diagram, which square (shown as a part of that diagram's image). */
  sample: { d: number; i: number };
  count: number;
  label: Label;
  /** What the comparison with the piece sets said, and how sure (0–1). */
  auto: Label;
  score: number;
  /** The next best name and its score. */
  runner: string;
  /** The group's picture (to find groups that look alike). */
  vec: Float32Array;
  /** The coach named it. */
  fixed?: boolean;
}
export interface Scan {
  pages: number;
  read: number;
  diagrams: Diagram[];
  groups: Group[];
  /** The whole PDF's text, line by line (where printed solutions are looked for). */
  text: string;
}
export interface Progress {
  page: number;
  pages: number;
  found: number;
  stage: 'pages' | 'pieces';
}

const yieldUi = () => new Promise<void>((r) => setTimeout(r, 0));

/** The text under a diagram down to the next diagram's height (a solution printed under it), as lines. */
function solutionText(words: Word[], g: Rect): string {
  return linesOf(words.filter((w) => w.y > g.y + g.h * 0.9 && w.y < g.y + g.h * 1.6 && w.x + w.w > g.x - g.w * 0.1 && w.x < g.x + g.w * 1.1));
}

/** The words near a diagram: below it, then above it (captions), within its width. */
function caption(words: Word[], g: Rect): string {
  const near = words.filter((w) => {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    const inX = cx > g.x - g.w * 0.15 && cx < g.x + g.w * 1.15;
    return inX && ((cy > g.y + g.h && cy < g.y + g.h * 1.45) || (cy < g.y && cy > g.y - g.h * 0.3));
  });
  const below = near.filter((w) => w.y > g.y + g.h * 0.5).sort((a, b) => a.y - b.y || a.x - b.x);
  const above = near.filter((w) => w.y <= g.y + g.h * 0.5).sort((a, b) => b.y - a.y || a.x - b.x);
  // Coordinates are single letters or digits: not part of a caption.
  const text = (l: Word[]) => l.filter((w) => !/^\s*[a-h1-8]\s*$/.test(w.str)).map((w) => w.str).join(' ');
  // The caption under a diagram is its own; the one above may belong to the diagram before.
  return (text(below) || text(above)).slice(0, 160);
}

function printedFlip(words: Word[], g: Rect): boolean | undefined {
  const files = words
    .filter((w) => /^\s*[a-h]\s*$/.test(w.str) && w.x + w.w / 2 > g.x && w.x + w.w / 2 < g.x + g.w && (Math.abs(w.y - (g.y + g.h)) < g.h * 0.12 || Math.abs(w.y + w.h - g.y) < g.h * 0.12))
    .map((w) => ({ ch: w.str.trim(), x: w.x }));
  const ranks = words
    .filter((w) => /^\s*[1-8]\s*$/.test(w.str) && w.y + w.h / 2 > g.y && w.y + w.h / 2 < g.y + g.h && (Math.abs(w.x + w.w - g.x) < g.w * 0.12 || Math.abs(w.x - (g.x + g.w)) < g.w * 0.12))
    .map((w) => ({ ch: w.str.trim(), y: w.y }));
  return coordsFlipped(files, ranks);
}

/** A part of a canvas as a small image. */
function snapshot(src: HTMLCanvasElement, r: Rect, size: number): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.86);
}

const overlap = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.w * a.h, b.w * b.h) : 0;
};

export async function scanPdf(file: Blob, onprogress?: (p: Progress) => void, maxPages = 40): Promise<Scan> {
  const { doc, close } = await openPdf(await file.arrayBuffer());
  const pages = doc.numPages;
  const read = Math.min(pages, maxPages);
  const diagrams: Diagram[] = [];
  const pieces: { d: number; i: number; vec: Float32Array; raw: Float32Array }[] = [];
  const shades: { light: number; dark: number }[] = [];
  const texts: string[] = [];
  try {
    for (let p = 1; p <= read; p++) {
      onprogress?.({ page: p, pages: read, found: diagrams.length, stage: 'pages' });
      await yieldUi();
      const img = await renderPage(doc, p);
      const g = toGray(img.rgba, img.width, img.height);
      const found: { grid: Rect; cells: ReturnType<typeof readCells>; occupied: boolean[]; fit: number; light: number; dark: number }[] = [];
      for (const cand of boardCandidates(g).sort((a, b) => b.w * b.h - a.w * a.h)) {
        const grid = trimFrame(g, cand);
        if (grid.w < 64 || grid.h < 64 || grid.w / grid.h < 0.92 || grid.w / grid.h > 1.08) continue;
        if (found.some((f) => overlap(f.grid, grid) > 0.4)) continue;
        const first = readCells(g, grid);
        const chk = checker(first, pieceSquares(first));
        if (chk.fit < 0.85 || chk.empties < 16) continue;
        // Read again from a sharper drawing of just this board: about 64 pixels a square, like the piece pictures.
        const zoom = Math.min(4, Math.max(1, (64 * 8) / grid.w));
        let cells = first;
        if (zoom > 1.15) {
          const m = Math.round(grid.w * 0.02);
          const part = await renderRegion(img, { x: grid.x - m, y: grid.y - m, w: grid.w + 2 * m, h: grid.h + 2 * m }, zoom);
          const hg = toGray(part.rgba, part.width, part.height);
          cells = readCells(hg, { x: Math.round(m * zoom), y: Math.round(m * zoom), w: Math.round(grid.w * zoom), h: Math.round(grid.h * zoom) });
        }
        const occupied = pieceSquares(cells);
        found.push({ grid, cells, occupied, fit: chk.fit, light: chk.light, dark: chk.dark });
      }
      // In reading order: row by row (boards level within half a board), left to right.
      found.sort((a, b) => (Math.abs(a.grid.y - b.grid.y) < a.grid.h / 2 ? a.grid.x - b.grid.x : a.grid.y - b.grid.y));
      for (const [n, f] of found.entries()) {
        shades.push({ light: f.light, dark: f.dark });
        const d = diagrams.length;
        const cap = caption(img.words, f.grid);
        const side = sideFromText(cap);
        diagrams.push({
          id: `p${p}-${n + 1}`,
          page: p,
          crop: snapshot(img.canvas, f.grid, 240),
          cells: f.occupied.map((o) => (o ? 0 : -1)),
          flipped: printedFlip(img.words, f.grid),
          side: side ?? 'white',
          sideFrom: side ? 'text' : 'guess',
          caption: cap,
          fit: f.fit,
          number: numberOf(cap),
          solutions: [solutionText(img.words, f.grid)],
        });
        f.occupied.forEach((o, i) => o && pieces.push({ d, i, vec: f.cells[i].vec, raw: f.cells[i].raw }));
      }
      texts.push(linesOf(img.words));
      img.canvas.width = img.canvas.height = 0;
      img.page.cleanup();
    }
    // The pages not drawn (a long PDF's solutions at the back): their words only.
    for (let p = read + 1; p <= Math.min(pages, 300); p++) texts.push(linesOf(await pageWords(doc, p)));
  } finally {
    close();
  }

  onprogress?.({ page: read, pages: read, found: diagrams.length, stage: 'pieces' });
  await yieldUi();
  // Pieces drawn alike (one font in the whole PDF) in groups, each named after the closest piece picture, drawn on
  // this PDF's own square colours and allowed to sit a little off the grid.
  const { assign, centroids } = cluster(pieces.map((x) => x.vec), 0.9);
  pieces.forEach((x, j) => (diagrams[x.d].cells[x.i] = assign[j]));
  const median = (l: number[]) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)] ?? 255;
  const light = Math.round(median(shades.map((s) => s.light)));
  const dark = Math.round(median(shades.map((s) => s.dark)));
  const temps = centroids.length ? await templates([...new Set([255, light, dark])]) : [];
  const groups: Group[] = [];
  centroids.forEach((c, k) => {
    const members = pieces.filter((_, j) => assign[j] === k);
    if (!members.length) return;
    const raw = new Float32Array(c.length);
    for (const m of members) for (let i = 0; i < raw.length; i++) raw[i] += m.raw[i] / members.length;
    const named = nameFor(c, raw, temps);
    const best: Label = named?.label ?? '';
    groups.push({ id: k, sample: { d: members[0].d, i: members[0].i }, count: members.length, label: best, auto: best, score: Math.max(0, named?.score ?? 0), runner: named?.runner ? `${named.runner[0]} ${named.runner[1].toFixed(2)}` : '', vec: c });
  });
  // Printed solutions: each diagram's number (or its place, when nothing is numbered), then the entries with it.
  const text = texts.join('\n');
  const numbered = diagrams.some((d) => d.number !== undefined);
  diagrams.forEach((d, i) => {
    if (!numbered) d.number = i + 1;
    if (d.number !== undefined) d.solutions.push(...entriesFor(text, d.number));
  });
  const scan: Scan = { pages, read, diagrams, groups: groups.sort((a, b) => b.count - a.count), text };
  // A printed "1..." solution says Black is to move where the caption didn't say.
  for (const d of diagrams) {
    if (d.sideFrom !== 'guess') continue;
    const found = pdfAnswer(d, positionOf(d, scan.groups).fen);
    if (found) d.side = found.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  }
  return scan;
}

/**
 * The coach names a group, and the reader learns from it: every group the coach hasn't named that looks clearly like
 * a named one takes that name (a font the piece sets don't know is learnt from a few corrections). Returns how many
 * groups changed.
 */
export function rename(scan: Scan, id: number, label: Label): number {
  const g = scan.groups.find((x) => x.id === id);
  if (!g) return 0;
  g.label = label;
  g.fixed = true;
  let n = 1;
  const named = scan.groups.filter((x) => x.fixed);
  for (const o of scan.groups) {
    if (o.fixed) continue;
    let best: Group | undefined, score = LEARN;
    for (const f of named) {
      const c = correlation(o.vec, f.vec);
      if (c > score) {
        score = c;
        best = f;
      }
    }
    // Clearly closer to a piece the coach named than to the piece set it was matched with.
    if (best && score > o.score && o.label !== best.label) {
      o.label = best.label;
      n++;
    }
  }
  return n;
}
/** How alike a group must look to a coach-named one to take its name. */
const LEARN = 0.8;

/** A diagram's position as it stands: the coach's FEN, else the groups' pieces, the orientation and side to move. */
export function positionOf(d: Diagram, groups: Group[]): { fen: string; problem: string; flipped: boolean } {
  if (d.manual) return { fen: d.manual, problem: problemOf(d.manual), flipped: false };
  const byId = new Map(groups.map((g) => [g.id, g]));
  const squares: Label[] = d.cells.map((k) => (k < 0 ? '' : (byId.get(k)?.label ?? '')));
  const flipped = d.flipped ?? looksFlipped(squares);
  const placement = placementOf(squares, flipped);
  const side = d.sideFrom === 'coach' ? d.side : sideThatWorks(placement, d.side);
  const fen = fenOf(placement, side);
  return { fen, problem: problemOf(fen), flipped };
}

/** How sure the reading of a diagram is (0–1): the weakest group on it, lowered when the squares didn't fit well. */
export function confidenceOf(d: Diagram, groups: Group[]): number {
  if (d.manual) return 1;
  const byId = new Map(groups.map((g) => [g.id, g]));
  const used = [...new Set(d.cells.filter((k) => k >= 0))].map((k) => byId.get(k));
  // A group the coach named counts as sure.
  const weakest = used.length ? Math.min(...used.map((g) => (!g ? 0 : g.label === g.auto ? g.score : 1))) : 1;
  return Math.min(weakest, d.fit);
}


/**
 * The answer to a position, by the engine on this device: the whole mating line when there is a mate for the side to
 * move (any checkmating move counts in class anyway), else the best move.
 */
export async function answerOf(fen: string, depth = 18, maxMs = 3000): Promise<{ line: string[]; mate?: number; note: string }> {
  const { engine } = await import('$lib/engine/stockfish');
  const info = await engine.evaluate(fen, depth, 1, maxMs);
  if (!info || !info.pv.length) return { line: [], note: 'The engine found no move.' };
  const white = fen.split(' ')[1] === 'w';
  if (info.mate !== undefined && info.mate > 0 === white) {
    const n = Math.abs(info.mate);
    return { line: info.pv.slice(0, Math.min(info.pv.length, n * 2 - 1)), mate: n, note: `Mate in ${n}` };
  }
  return { line: info.pv.slice(0, 1), note: '' };
}

/** The answer printed in the PDF for a diagram's position (and the position with the side to move it says), if any. */
export function pdfAnswer(d: Diagram, fen: string): { fen: string; line: string[]; sans: string[] } | undefined {
  // The coach chose whose move it is: the printed line must read from that side.
  const best = bestLine(fen, d.solutions.filter(Boolean), d.sideFrom !== 'coach');
  return best ? { fen: best.fen, line: best.line.moves, sans: best.line.sans } : undefined;
}

export type AnswerMode = 'pdf' | 'engine' | 'both';
export interface Answer {
  fen: string;
  line: string[];
  from: 'pdf' | 'engine' | 'coach';
  note: string;
}

/**
 * A diagram's answer as things stand, without running the engine: the coach's own, else (by the choice) the PDF's,
 * else the engine's when it was already found for this position. `need`: the engine has yet to look at it.
 */
export function answerNow(d: Diagram, fen: string, mode: AnswerMode): { answer?: Answer; need: boolean; fen: string } {
  if (d.coach && d.coach.fen.split(' ')[0] === fen.split(' ')[0]) return { answer: { fen: d.coach.fen, line: d.coach.line, from: 'coach', note: '' }, need: false, fen: d.coach.fen };
  const pdf = mode !== 'engine' ? pdfAnswer(d, fen) : undefined;
  if (pdf) return { answer: { fen: pdf.fen, line: pdf.line, from: 'pdf', note: '' }, need: false, fen: pdf.fen };
  if (mode === 'pdf') return { need: false, fen };
  if (d.engine && d.engine.fen === fen) return { answer: { fen, line: d.engine.line, from: 'engine', note: d.engine.note }, need: false, fen };
  return { need: true, fen };
}

/** The checked positions as class questions. */
export function itemsOf(list: { fen: string; line: string[]; title: string }[]): Item[] {
  return list.filter((x) => x.line.length).map((x) => ({ fen: x.fen, line: x.line, goal: '', elo: 1500, title: x.title, ref: '', rating: 0 }));
}

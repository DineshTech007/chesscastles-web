/**
 * Reading a PDF on this device with pdf.js (loaded only when a coach opens a PDF): each page drawn to a canvas, and
 * its words with where they sit. Everything stays on the coach's computer: nothing is uploaded.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist');
let lib: Promise<PdfJs> | undefined;

function pdfjs(): Promise<PdfJs> {
  lib ??= (async () => {
    const [m, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    m.GlobalWorkerOptions.workerSrc = worker.default;
    return m;
  })();
  return lib;
}

/** The document, and how to let it go (frees pdf.js's worker memory). */
export async function openPdf(data: ArrayBuffer): Promise<{ doc: PDFDocumentProxy; close: () => void }> {
  const m = await pdfjs();
  const task = m.getDocument({
    data,
    // Scanned pages' image decoders (JBIG2, JPEG 2000) from this site (static/pdfjs), never another server.
    wasmUrl: `${location.origin}/pdfjs/wasm/`,
    useSystemFonts: true,
    enableXfa: false,
  });
  const doc = await task.promise;
  return { doc, close: () => void task.destroy() };
}

export interface Word {
  str: string;
  /** Left, top, width and height in the page image's pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface PageImage {
  index: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  words: Word[];
  canvas: HTMLCanvasElement;
  /** The page (for drawing one part again, sharper) and the scale it was drawn at. */
  page: PDFPageProxy;
  scale: number;
}

/** One page as pixels (about 3 million at most: enough for diagrams, light on memory) and its words. */
export async function renderPage(doc: PDFDocumentProxy, index: number, maxPixels = 3_200_000): Promise<PageImage> {
  const m = await pdfjs();
  const page = await doc.getPage(index);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.4, Math.sqrt(maxPixels / (base.width * base.height)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport, background: '#ffffff' }).promise;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const words: Word[] = [];
  try {
    const text = await page.getTextContent();
    for (const it of text.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const t = m.Util.transform(viewport.transform, it.transform);
      const h = Math.hypot(t[2], t[3]);
      words.push({ str: it.str, x: t[4], y: t[5] - h, w: it.width * scale, h });
    }
  } catch {
    /* a page with no readable text */
  }
  return { index, width: canvas.width, height: canvas.height, rgba, words, canvas, page, scale };
}

/**
 * One part of a page (`r`, in the page image's pixels) drawn again `zoom` times sharper: a board read at about the
 * size of the piece pictures it is compared with (thin printed lines don't thicken a small piece).
 */
export async function renderRegion(img: PageImage, r: { x: number; y: number; w: number; h: number }, zoom: number): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  const scale = img.scale * zoom;
  const viewport = img.page.getViewport({ scale, offsetX: -r.x * zoom, offsetY: -r.y * zoom });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(r.w * zoom);
  canvas.height = Math.ceil(r.h * zoom);
  await img.page.render({ canvas, viewport, background: '#ffffff' }).promise;
  const rgba = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = { rgba, width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 0;
  return out;
}

/** A page's words without drawing it (the solutions at the back of a long PDF), in its own units. */
export async function pageWords(doc: PDFDocumentProxy, index: number): Promise<Word[]> {
  const m = await pdfjs();
  const page = await doc.getPage(index);
  const viewport = page.getViewport({ scale: 1 });
  const words: Word[] = [];
  try {
    const text = await page.getTextContent();
    for (const it of text.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const t = m.Util.transform(viewport.transform, it.transform);
      const h = Math.hypot(t[2], t[3]);
      words.push({ str: it.str, x: t[4], y: t[5] - h, w: it.width, h });
    }
  } catch {
    /* no readable text */
  }
  page.cleanup();
  return words;
}

/** Words to lines of text in reading order (the same line: about the same height on the page). */
export function linesOf(words: Word[]): string {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Word[][] = [];
  for (const w of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - w.y) < Math.max(2, line[0].h * 0.5)) line.push(w);
    else lines.push([w]);
  }
  return lines
    .map((l) =>
      l
        .sort((a, b) => a.x - b.x)
        .reduce((acc, w, i) => {
          if (!i) return w.str;
          const prev = l[i - 1];
          // Pieces of one word (a font split mid-word) join; words get a space.
          return acc + (w.x - (prev.x + prev.w) > prev.h * 0.15 ? ' ' : '') + w.str;
        }, ''),
    )
    .join('\n');
}

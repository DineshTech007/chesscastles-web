import { describe, expect, it } from 'vitest';
import { castlingOf, coordsFlipped, fenOf, looksFlipped, placementOf, problemOf, sideFromText, sideThatWorks, type Label } from './fen';
import { boardCandidates, checker, cluster, normalise, pieceSquares, readCells, trimFrame, type Gray } from './vision';

/** A printed diagram on a white page: a frame, white and grey (or hatched) squares, and blobs for pieces. */
function page(opts: { hatch?: boolean; pieces: Record<number, 'w' | 'b'>; flip?: boolean } = { pieces: {} }): { g: Gray; board: { x: number; y: number; s: number } } {
  const W = 600, H = 700;
  const data = new Uint8Array(W * H).fill(255);
  const sat = new Uint8Array(W * H);
  const board = { x: 120, y: 90, s: 320 };
  const cs = board.s / 8;
  const set = (x: number, y: number, v: number) => (data[y * W + x] = v);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const darkSq = (r + c) % 2 === 1;
      for (let y = 0; y < cs; y++)
        for (let x = 0; x < cs; x++) {
          const X = board.x + c * cs + x, Y = board.y + r * cs + y;
          if (darkSq) set(X, Y, opts.hatch ? ((X + Y) % 4 === 0 ? 30 : 255) : 160);
        }
      const p = opts.pieces[r * 8 + c];
      if (p) {
        // A round piece: black outline, filled black or white, white halo inside the hatching.
        const cx = board.x + c * cs + cs / 2, cy = board.y + r * cs + cs / 2;
        for (let y = -16; y <= 16; y++)
          for (let x = -16; x <= 16; x++) {
            const d = Math.hypot(x, y);
            if (d <= 16) set(Math.round(cx + x), Math.round(cy + y), d > 14 ? 0 : p === 'b' ? 20 : 250);
          }
      }
    }
  // A double frame: a thick outer line, paper, the squares.
  for (let t = 0; t < 3; t++)
    for (let i = -8; i < board.s + 8; i++) {
      set(board.x + i, board.y - 8 + t, 0);
      set(board.x + i, board.y + board.s + 5 + t, 0);
      set(board.x - 8 + t, board.y + i, 0);
      set(board.x + board.s + 5 + t, board.y + i, 0);
    }
  return { g: { width: W, height: H, data, sat }, board };
}

describe('reading a diagram', () => {
  it('finds the board, cuts the frame, and keeps the squares', () => {
    const { g, board } = page({ pieces: { 0: 'b', 60: 'w', 52: 'w' } });
    const cands = boardCandidates(g);
    expect(cands.length).toBeGreaterThanOrEqual(1);
    const grid = trimFrame(g, cands.sort((a, b) => b.w * b.h - a.w * a.h)[0]);
    expect(Math.abs(grid.x - board.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(grid.y - board.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(grid.w - board.s)).toBeLessThanOrEqual(6);
  });
  it('tells pieces from empty squares, also on hatched dark squares, and sees the checkerboard', () => {
    for (const hatch of [false, true]) {
      const pieces = { 0: 'b', 9: 'b', 60: 'w', 52: 'w', 35: 'b' } as Record<number, 'w' | 'b'>;
      const { g, board } = page({ hatch, pieces });
      const grid = { x: board.x, y: board.y, w: board.s, h: board.s };
      const cells = readCells(g, grid);
      const occ = pieceSquares(cells);
      expect(occ.map((o, i) => (o ? i : -1)).filter((i) => i >= 0)).toEqual(Object.keys(pieces).map(Number).sort((a, b) => a - b));
      const chk = checker(cells, occ);
      expect(chk.fit).toBeGreaterThan(0.95);
      expect(chk.light).toBeGreaterThan(chk.dark);
    }
  });
  it('groups pieces that look the same', () => {
    const a = normalise(Float32Array.from({ length: 256 }, (_, i) => (i % 16 < 8 ? 200 : 20)));
    const b = normalise(Float32Array.from({ length: 256 }, (_, i) => (Math.floor(i / 16) < 8 ? 200 : 20)));
    const noisy = (v: Float32Array) => normalise(v.map((x) => x + (Math.random() - 0.5) * 0.01));
    const { assign, centroids } = cluster([a, noisy(a), b, noisy(b), noisy(a)]);
    expect(centroids).toHaveLength(2);
    expect(assign).toEqual([0, 0, 1, 1, 0]);
  });
});

describe('from squares to FEN', () => {
  const squares = (map: Record<number, Label>): Label[] => Array.from({ length: 64 }, (_, i) => map[i] ?? '');
  it('builds the placement, flipped or not', () => {
    const s = squares({ 4: 'k', 60: 'K', 52: 'P' });
    expect(placementOf(s)).toBe('4k3/8/8/8/8/8/4P3/4K3');
    expect(placementOf(s, true)).toBe('3K4/3P4/8/8/8/8/8/3k4');
  });
  it('castling only with king and rook at home', () => {
    expect(castlingOf('r3k2r/8/8/8/8/8/8/R3K2R')).toBe('KQkq');
    expect(castlingOf('r3k3/8/8/8/8/8/8/4K2R')).toBe('Kq');
    expect(castlingOf('4k3/8/8/8/8/8/8/4K3')).toBe('-');
    expect(fenOf('4k3/8/8/8/8/8/4P3/4K3', 'black')).toBe('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1');
  });
  it('sees a diagram printed with Black at the bottom', () => {
    // As printed: White's pawns above Black's.
    expect(looksFlipped(squares({ 9: 'P', 10: 'P', 49: 'p', 50: 'p', 3: 'K', 59: 'k' }))).toBe(true);
    expect(looksFlipped(squares({ 9: 'p', 10: 'p', 49: 'P', 50: 'P', 4: 'k', 60: 'K' }))).toBe(false);
    // No black pawns: White's king at the top means Black is at the bottom.
    expect(looksFlipped(squares({ 9: 'P', 3: 'K', 59: 'k' }))).toBe(true);
    expect(looksFlipped(squares({ 49: 'P', 59: 'K', 3: 'k' }))).toBe(false);
  });
  it('says what is wrong with a position', () => {
    expect(problemOf('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')).toBe('');
    expect(problemOf('8/8/8/8/8/8/4P3/4K3 w - - 0 1')).toMatch(/one king each/);
    expect(problemOf('4k3/8/8/8/8/8/8/4K2P w - - 0 1')).toMatch(/pawn/);
    // Black is in check with White to move: impossible.
    expect(problemOf('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1')).toMatch(/check/);
    expect(sideThatWorks('4k3/8/8/8/8/8/8/4R1K1', 'white')).toBe('black');
  });
  it('reads the side to move from a caption', () => {
    expect(sideFromText('12. White to move and win')).toBe('white');
    expect(sideFromText('Black to play')).toBe('black');
    expect(sideFromText('Black wins')).toBe('black');
    expect(sideFromText('B to move')).toBe('black');
    expect(sideFromText('1... ?')).toBe('black');
    expect(sideFromText('Mate in 2')).toBeUndefined();
    expect(sideFromText('')).toBeUndefined();
  });
  it('reads printed coordinates', () => {
    expect(coordsFlipped([{ ch: 'h', x: 10 }, { ch: 'g', x: 50 }, { ch: 'a', x: 290 }], [])).toBe(true);
    expect(coordsFlipped([{ ch: 'a', x: 10 }, { ch: 'b', x: 50 }, { ch: 'h', x: 290 }], [])).toBe(false);
    expect(coordsFlipped([], [{ ch: '1', y: 10 }, { ch: '2', y: 50 }, { ch: '8', y: 290 }])).toBe(true);
    expect(coordsFlipped([], [])).toBeUndefined();
  });
});

describe('the coach names a piece group', () => {
  it('the group and the groups that look like it change; others stay', async () => {
    const { rename } = await import('./scan');
    type Scan = import('./scan').Scan;
    const v = (f: (i: number) => number) => normalise(Float32Array.from({ length: 256 }, (_, i) => f(i)));
    const king = v((i) => (i % 16 < 8 ? 200 : 20));
    const kingAgain = v((i) => (i % 16 < 8 ? 200 : 20) + (i % 7));
    const pawn = v((i) => (Math.floor(i / 16) < 8 ? 200 : 20));
    const g = (id: number, vec: Float32Array, label: Label): Scan['groups'][number] => ({ id, sample: { d: 0, i: 0 }, count: 1, label, auto: label, score: 0.6, runner: '', vec });
    const scan: Scan = { pages: 1, read: 1, diagrams: [], groups: [g(0, king, 'R'), g(1, kingAgain, 'Q'), g(2, pawn, 'P')], text: '' };
    rename(scan, 0, 'K');
    expect(scan.groups.map((x) => x.label)).toEqual(['K', 'K', 'P']);
    expect(scan.groups[0].fixed).toBe(true);
  });
});

describe('solutions printed in the PDF', () => {
  it('reads a printed line against the position, move numbers and annotations stepped over', async () => {
    const { readLine, cleanSan, tokens } = await import('./solutions');
    const fen = '6k1/5pp1/7p/8/8/8/5PPP/3RR1K1 w - - 0 2';
    expect(readLine(fen, '1.Rd8+! Kh7 2.Re7').moves).toEqual(['d1d8', 'g8h7', 'e1e7']);
    expect(readLine(fen, '1. Rd8+ Kh7 2. Re7 (2. Ree8? Kg6) 1-0').moves).toEqual(['d1d8', 'g8h7', 'e1e7']);
    // Stops at the first move that isn't legal.
    expect(readLine(fen, '1.Rd8+ Kh7 2.Qh5').moves).toEqual(['d1d8', 'g8h7']);
    // Figurines and castling with zeros.
    expect(cleanSan('♖d8+!')).toBe('Rd8');
    expect(cleanSan('0-0-0')).toBe('O-O-O');
    expect(cleanSan('e8=Q+')).toBe('e8=Q');
    expect(tokens('12...Nf3+ 13.Kh1')).toEqual(['12...', 'Nf3+', '13.', 'Kh1']);
    // A caption: words before the first move.
    expect(readLine(fen, 'White to move and win. 1.Rd8+ Kh7', true).moves).toEqual(['d1d8', 'g8h7']);
    expect(readLine(fen, 'White to move and win').moves).toEqual([]);
  });
  it('finds the right entry by number, and the side the line says', async () => {
    const { bestLine, entriesFor, numberOf } = await import('./solutions');
    const text = `Solutions
1) 1.Rd8+ Kh7 2.Re7 1-0
2) 1...Rxd1+ 2.Re1 Rxe1#
3. Qxf7#`;
    const p1 = '6k1/5pp1/7p/8/8/8/5PPP/3RR1K1 w - - 0 2';
    expect(bestLine(p1, entriesFor(text, 1))?.line.moves).toEqual(['d1d8', 'g8h7', 'e1e7']);
    // Puzzle 2 is Black to move but printed (or guessed) as White: the "1..." line puts it right.
    const p2 = '6k1/5p1p/7B/1Pp1R3/2Pp4/8/5PPP/r2Q2K1 w - - 0 1';
    const b2 = bestLine(p2, entriesFor(text, 2));
    expect(b2?.line.moves).toEqual(['a1d1', 'e5e1', 'd1e1']);
    expect(b2?.fen.split(' ')[1]).toBe('b');
    // "2." inside puzzle 1's line is not puzzle 2's entry: it doesn't read there.
    expect(entriesFor(text, 2).length).toBeGreaterThanOrEqual(2);
    expect(numberOf('12. White to move')).toBe(12);
    expect(numberOf('No. 7 Black to play')).toBe(7);
    expect(numberOf('Diagram 4')).toBe(4);
    expect(numberOf('White to move')).toBeUndefined();
  });
});

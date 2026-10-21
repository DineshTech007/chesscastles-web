/** From the 64 squares read off a diagram to a FEN: orientation, castling, the side to move, and whether it can be played. */
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';

/** A square's piece in FEN letters (white upper case), or '' for empty. */
export type Label = '' | 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export const LABELS: Label[] = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p', ''];
export const LABEL_NAME: Record<Label, string> = {
  K: 'White king',
  Q: 'White queen',
  R: 'White rook',
  B: 'White bishop',
  N: 'White knight',
  P: 'White pawn',
  k: 'Black king',
  q: 'Black queen',
  r: 'Black rook',
  b: 'Black bishop',
  n: 'Black knight',
  p: 'Black pawn',
  '': 'Empty',
};

/** The 64 squares as printed (row by row from the top left) to FEN ranks; `flipped`: Black at the bottom. */
export function placementOf(squares: Label[], flipped = false): string {
  const s = flipped ? [...squares].reverse() : squares;
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = s[r * 8 + c];
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    rows.push(row + (empty ? empty : ''));
  }
  return rows.join('/');
}

/** Castling rights only where the king and rook still stand on their first squares. */
export function castlingOf(placement: string): string {
  const ranks = placement.split('/');
  const expand = (row: string) => row.replace(/\d/g, (d) => '.'.repeat(Number(d)));
  const r8 = expand(ranks[0] ?? ''), r1 = expand(ranks[7] ?? '');
  let c = '';
  if (r1[4] === 'K' && r1[7] === 'R') c += 'K';
  if (r1[4] === 'K' && r1[0] === 'R') c += 'Q';
  if (r8[4] === 'k' && r8[7] === 'r') c += 'k';
  if (r8[4] === 'k' && r8[0] === 'r') c += 'q';
  return c || '-';
}

export function fenOf(placement: string, side: 'white' | 'black'): string {
  return `${placement} ${side[0]} ${castlingOf(placement)} - 0 1`;
}

/**
 * Whether the diagram is printed with Black at the bottom: White's pawns are nearly always below Black's; with pawns of
 * one side only (or none), the kings far apart tell (White's king at the bottom).
 */
export function looksFlipped(squares: Label[]): boolean {
  const rows = (p: Label) => squares.map((s, i) => (s === p ? Math.floor(i / 8) : -1)).filter((r) => r >= 0);
  const avg = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
  const wp = rows('P'), bp = rows('p');
  if (wp.length && bp.length) return avg(wp) < avg(bp) - 0.5;
  const wk = rows('K'), bk = rows('k');
  if (wk.length === 1 && bk.length === 1 && Math.abs(wk[0] - bk[0]) >= 4) return wk[0] < bk[0];
  return false;
}

/** Why a position can't be played ('' when it can): kings, pawns on the end ranks, the side not to move in check. */
export function problemOf(fen: string): string {
  const setup = parseFen(fen);
  if (setup.isErr) return 'This position could not be read.';
  const placement = fen.split(' ')[0];
  const wk = (placement.match(/K/g) ?? []).length, bk = (placement.match(/k/g) ?? []).length;
  if (wk !== 1 || bk !== 1) return `Needs one king each (White ${wk}, Black ${bk}).`;
  const ranks = placement.split('/');
  if (/[Pp]/.test(ranks[0]) || /[Pp]/.test(ranks[7])) return 'A pawn stands on the first or last rank.';
  const pos = Chess.fromSetup(setup.value);
  if (pos.isErr) return 'The side not to move is in check: swap whose move it is.';
  if (pos.value.isEnd()) return 'The game is already over in this position.';
  return '';
}

/** The side to move, when the printed one can't be right (the other king is in check). */
export function sideThatWorks(placement: string, side: 'white' | 'black'): 'white' | 'black' {
  const ok = (s: 'white' | 'black') => {
    const setup = parseFen(fenOf(placement, s));
    return setup.isOk && Chess.fromSetup(setup.value).isOk;
  };
  if (ok(side)) return side;
  const other = side === 'white' ? 'black' : 'white';
  return ok(other) ? other : side;
}

/** "White to move", "Black to play", "Black wins", "W to move", "1... ?" → the side; undefined when it doesn't say. */
export function sideFromText(text: string): 'white' | 'black' | undefined {
  const t = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const white = /\bwhite (to|plays?|moves?|wins|mates|draws|is to)\b|\b(w) to (move|play)\b|\(w\)|white['’]?s (move|turn)\b|\bwhite\b\s*$/;
  const black = /\bblack (to|plays?|moves?|wins|mates|draws|is to)\b|\b(b) to (move|play)\b|\(b\)|black['’]?s (move|turn)\b|\bblack\b\s*$/;
  const w = white.test(t), b = black.test(t);
  if (w && !b) return 'white';
  if (b && !w) return 'black';
  if (/\d+\s*\.\.\./.test(t) && !w) return 'black';
  if (/\b\d+\s*\.\s*(?!\.)/.test(t) && !b) return undefined;
  return undefined;
}

/** Printed coordinates beside a board: "h … a" along the bottom, or 1 at the top, mean Black is at the bottom. */
export function coordsFlipped(files: { ch: string; x: number }[], ranks: { ch: string; y: number }[]): boolean | undefined {
  const f = files.filter((x) => /^[a-h]$/.test(x.ch)).sort((a, b) => a.x - b.x);
  if (f.length >= 3) return f[0].ch > f[f.length - 1].ch;
  const r = ranks.filter((x) => /^[1-8]$/.test(x.ch)).sort((a, b) => a.y - b.y);
  if (r.length >= 3) return r[0].ch < r[r.length - 1].ch;
  return undefined;
}

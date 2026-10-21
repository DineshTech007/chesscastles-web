/**
 * The answers a puzzle PDF prints: under each diagram, or in a "Solutions" part keyed by the puzzle's number
 * ("1. Qh5+ Kg8 2. Qf7#", "12) 1...Nf3+ 2.Kh1 Qxh2#", "No. 7 Rxh7+"). Each printed line is read move by move against
 * the diagram's position (SAN, chessops) and stops at the first move that isn't a legal move there.
 */
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';

const FIGURINES: Record<string, string> = { '♔': 'K', '♚': 'K', '♕': 'Q', '♛': 'Q', '♖': 'R', '♜': 'R', '♗': 'B', '♝': 'B', '♘': 'N', '♞': 'N', '♙': '', '♟': '' };
const SAN = /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=?[QRBN])?|O-O(?:-O)?)$/;
const RESULT = /^(?:1-0|0-1|1\/2-1\/2|½-½|\*)$/;

export interface Line {
  /** The moves read, as UCI (the side to move first). */
  moves: string[];
  /** The same moves in SAN, as printed (cleaned). */
  sans: string[];
  /** The side that moves first, when the line says ("1... Rxd1+" is Black's move). */
  black?: boolean;
}

/** A move as printed made plain: figurines to letters, zeros in castling, no annotations or trailing punctuation. */
export function cleanSan(token: string): string {
  let t = token.replace(/[♔♚♕♛♖♜♗♝♘♞♙♟]/g, (c) => FIGURINES[c] ?? '');
  t = t.replace(/^[([{"'“]+|[)\]},;:"'”.]+$/g, '');
  t = t.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
  t = t.replace(/(?:e\.p\.)$/, '');
  t = t.replace(/[!?+#†‡±∓=]*$/g, (m) => (m.startsWith('=') ? m : ''));
  return t.replace(/[!?+#†‡]+$/g, '');
}

/** Splits printed text into tokens, move numbers apart from moves ("1.Qh5+" → "1." "Qh5+", "12...Nf3" → "12..." "Nf3"). */
export function tokens(text: string): string[] {
  return text
    .replace(/…/g, '...')
    .replace(/(\d+)\s*\.\s*\.\s*\./g, '$1...')
    .replace(/(\d+)(\.{1,3})(?=\S)/g, '$1$2 ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Reads a printed line from a position (FEN): move numbers and "..." are stepped over, the first move that isn't
 * legal ends it. `skipWords`: words before the first move are stepped over (a caption: "White to move. 1.Qh5+ …").
 */
export function readLine(fen: string, text: string, skipWords = false): Line {
  const out: Line = { moves: [], sans: [] };
  const setup = parseFen(fen);
  if (setup.isErr) return out;
  const start = Chess.fromSetup(setup.value);
  if (start.isErr) return out;
  const pos = start.value;
  for (const raw of tokens(text)) {
    if (/^\d+\.{1,3}$/.test(raw) || raw === '...' || raw === '..') {
      if (!out.moves.length && /\.\.\.$/.test(raw)) out.black = true;
      continue;
    }
    if (RESULT.test(raw) || raw.startsWith('(')) break;
    const san = cleanSan(raw);
    if (!san) continue;
    if (!SAN.test(san)) {
      if (skipWords && !out.moves.length) continue;
      break;
    }
    const move = parseSan(pos, san);
    if (!move) break;
    out.sans.push(san);
    out.moves.push(makeUci(move));
    pos.play(move);
    if (pos.isEnd()) break;
  }
  return out;
}

/**
 * The printed solution for a position among candidates (several places may carry the puzzle's number): the one that
 * reads the most moves. When none reads from the side to move but one reads from the other side, that one (the
 * printed side to move was wrong, or a "1..." line says Black); `bothSides` false keeps to the side given (the coach
 * chose it).
 */
export function bestLine(fen: string, candidates: string[], bothSides = true): { line: Line; fen: string } | undefined {
  const parts = fen.split(' ');
  const other = [parts[0], parts[1] === 'w' ? 'b' : 'w', ...parts.slice(2)].join(' ');
  let best: { line: Line; fen: string } | undefined;
  for (const text of candidates) {
    for (const f of bothSides ? [fen, other] : [fen]) {
      const line = readLine(f, text, true);
      if (!line.moves.length) continue;
      // The side the line says comes first; then more moves; the printed side to move wins a tie.
      const says = line.black === undefined || line.black === (f.split(' ')[1] === 'b');
      const score = line.moves.length + (says ? 100 : 0) + (f === fen ? 0.5 : 0);
      const was = best ? best.line.moves.length + ((best.line.black === undefined || best.line.black === (best.fen.split(' ')[1] === 'b')) ? 100 : 0) + (best.fen === fen ? 0.5 : 0) : -1;
      if (score > was) best = { line, fen: f };
    }
  }
  return best;
}

/** The number printed with a diagram ("12. White to move", "No. 12", "Diagram 12", "#12", "12)"), if any. */
export function numberOf(caption: string): number | undefined {
  const m = caption.match(/^\s*(?:(?:no|nr|puzzle|diagram|exercise|ex|problem|position|#)\.?\s*)?(\d{1,3})\s*[.):\]]/i) ?? caption.match(/^\s*(?:no|nr|puzzle|diagram|exercise|ex|problem|position|#)\.?\s*(\d{1,3})\b/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * Every place in the text that could start the solution of puzzle `n`: "n." "n)" "n:" "No. n" "#n" and the like,
 * with the text after it (up to the next such entry or 300 characters).
 */
export function entriesFor(text: string, n: number): string[] {
  const out: string[] = [];
  const re = new RegExp(`(?:^|[\\s(\\[])(?:(?:No|Nr|Puzzle|Diagram|Exercise|Ex|Problem|Position|#)\\.?\\s*)?${n}\\s*[.):\\]]`, 'gi');
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const from = m.index + m[0].length;
    // "1." straight before a move ("1.Qh5") is a move number of this very entry: keep it in the text.
    const rest = text.slice(from, from + 300);
    out.push(rest);
  }
  return out;
}

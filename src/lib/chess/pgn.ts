import type { Chess } from 'chessops/chess';
import { parseComment, parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import type { NormalMove } from 'chessops/types';

export interface PgnPly {
  move: NormalMove;
  san: string;
  after: Chess;
  /** Clock after the move, ms (from [%clk]). */
  clock?: number;
}

export interface PgnGame {
  headers: Map<string, string>;
  start: Chess;
  plies: PgnPly[];
  /** The first move that is not legal in the game (reading stopped there). */
  illegal?: string;
}

/** Reads the main line of each game in a PGN text (stops at an illegal move). */
export function readPgn(text: string): PgnGame[] {
  const out: PgnGame[] = [];
  for (const g of parsePgn(text)) {
    const startResult = startingPosition(g.headers);
    // A game from an impossible position is skipped.
    if (startResult.isErr) continue;
    const start = startResult.value as Chess;
    const pos = start.clone();
    const plies: PgnPly[] = [];
    let illegal: string | undefined;
    for (const node of g.moves.mainline()) {
      const m = parseSan(pos, node.san);
      if (!m || !('from' in m)) {
        illegal = node.san;
        break;
      }
      const san = node.san;
      pos.play(m);
      const clock = node.comments?.map(parseComment).find((c) => c.clock !== undefined)?.clock;
      plies.push({ move: m, san, after: pos.clone(), clock: clock !== undefined ? clock * 1000 : undefined });
    }
    out.push({ headers: g.headers, start, plies, illegal });
  }
  return out;
}

/** Each side's clock at a ply: the time left after their latest move. */
export function clocksAt(g: PgnGame, ply: number): { white?: number; black?: number } {
  let white: number | undefined;
  let black: number | undefined;
  const whiteFirst = g.start.turn === 'white';
  for (let i = ply - 1; i >= 0 && (white === undefined || black === undefined); i--) {
    const byWhite = (i % 2 === 0) === whiteFirst;
    if (byWhite) white ??= g.plies[i].clock;
    else black ??= g.plies[i].clock;
  }
  return { white, black };
}

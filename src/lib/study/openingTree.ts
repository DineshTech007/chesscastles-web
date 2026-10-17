import type { Chess } from 'chessops/chess';
import { movesInRange, type BookSource } from '$lib/book/book';
import { polyglotKey } from '$lib/chess/polyglot';
import { fenOf, moveToUci, playSans, positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
import { freshCard, isDue, review, type RecallQuality, type SrsCard } from './srs';

export interface TreeEdge {
  uci: string;
  san: string;
  games: number;
  /** Key of the position the move leads to. */
  child: string;
}

export interface TreeNode {
  key: string;
  fen: string;
  ply: number;
  /** The player's turn: exactly one edge (the move to learn). Else the popular replies. */
  next: TreeEdge[];
}

/** An opening to train, built from the FIDE games book and kept in the browser. */
export interface OpeningTree {
  openingId: string;
  userSide: 'white' | 'black';
  rootSans: string;
  rootKey: string;
  nodes: Record<string, TreeNode>;
  cards: Record<string, SrsCard>;
  built: number;
  ratingFloor: number;
}

export interface BuildOptions {
  book: BookSource;
  openingId: string;
  rootSans: string;
  userSide: 'white' | 'black';
  /** Plies to learn after the opening's own moves. */
  depth?: number;
  /** Players rated at least this (strong players' choices). */
  ratingFloor?: number;
  /** An opponent reply must be at least this share of games. */
  minShare?: number;
  maxReplies?: number;
  onProgress?: (done: number, queued: number) => void;
}

const keyOf = (pos: Chess) => polyglotKey(pos).toString(16);

/**
 * Builds a training tree from the FIDE games book: at the player's turns the
 * move strong players chose most, at the opponent's turns their popular
 * replies. Transpositions share one node. Positions are fetched a few at a
 * time.
 */
export async function buildTree(o: BuildOptions): Promise<OpeningTree> {
  const depth = o.depth ?? 12;
  const floor = o.ratingFloor ?? 2000;
  const minShare = o.minShare ?? 0.08;
  const maxReplies = o.maxReplies ?? 3;
  const root = playSans(o.rootSans);
  const rootPly = o.rootSans.trim().split(/\s+/).filter(Boolean).length;
  const nodes: Record<string, TreeNode> = {};
  const rootKey = keyOf(root);
  nodes[rootKey] = { key: rootKey, fen: fenOf(root), ply: rootPly, next: [] };
  let frontier: Chess[] = [root];
  let done = 0;
  let queued = 1;

  while (frontier.length) {
    const next: Chess[] = [];
    for (let i = 0; i < frontier.length; i += 6) {
      const batch = frontier.slice(i, i + 6);
      const results = await Promise.all(batch.map((p) => o.book.entries(p)));
      batch.forEach((pos, j) => {
        done++;
        const node = nodes[keyOf(pos)];
        if (node.ply - rootPly >= depth) return;
        const moves = movesInRange(results[j], floor).filter((m) => pos.isLegal(m.move));
        const total = moves.reduce((s, m) => s + m.games, 0);
        if (!total) return;
        const userTurn = pos.turn === o.userSide;
        const chosen = userTurn
          ? moves.slice(0, 1)
          : moves.filter((m) => m.games / total >= minShare).slice(0, maxReplies);
        for (const m of chosen) {
          const after = pos.clone();
          after.play(m.move);
          const key = keyOf(after);
          node.next.push({ uci: moveToUci(m.move), san: sanOf(pos, m.move), games: m.games, child: key });
          if (!nodes[key]) {
            nodes[key] = { key, fen: fenOf(after), ply: node.ply + 1, next: [] };
            next.push(after);
            queued++;
          }
        }
      });
      o.onProgress?.(done, queued);
    }
    frontier = next;
  }

  return {
    openingId: o.openingId,
    userSide: o.userSide,
    rootSans: o.rootSans,
    rootKey,
    nodes,
    cards: {},
    built: Date.now(),
    ratingFloor: floor,
  };
}

export const turnOf = (fen: string): 'white' | 'black' => (fen.split(' ')[1] === 'b' ? 'black' : 'white');

/** Positions where the player must find the move. */
export function userNodes(t: OpeningTree): TreeNode[] {
  return Object.values(t.nodes).filter((n) => turnOf(n.fen) === t.userSide && n.next.length);
}

export function dueCount(t: OpeningTree, now: number): number {
  return userNodes(t).filter((n) => !t.cards[n.key] || isDue(t.cards[n.key], now)).length;
}

/** Cards answered right at least twice in a row: the position is known. */
export function learnedCount(t: OpeningTree): number {
  return userNodes(t).filter((n) => (t.cards[n.key]?.repetitions ?? 0) >= 2).length;
}

/**
 * The line to train next: the player's moves as learnt, and at each of the
 * opponent's turns the reply leading to the most overdue position (popular
 * replies win ties). The same rule as the app's trainer.
 */
export function nextLine(t: OpeningTree, now: number, random: () => number = Math.random): TreeEdge[] {
  const memo = new Map<string, number>();
  const FAR = Number.MAX_SAFE_INTEGER;
  const soonest = (key: string, path: Set<string>): number => {
    const m = memo.get(key);
    if (m !== undefined) return m;
    const n = t.nodes[key];
    if (!n || path.has(key)) return FAR;
    path.add(key);
    const own = turnOf(n.fen) === t.userSide && n.next.length ? (t.cards[key]?.due ?? now) : FAR;
    let best = own;
    for (const e of n.next) best = Math.min(best, soonest(e.child, path));
    path.delete(key);
    memo.set(key, best);
    return best;
  };
  soonest(t.rootKey, new Set());

  const line: TreeEdge[] = [];
  const seen = new Set([t.rootKey]);
  let node = t.nodes[t.rootKey];
  while (node && node.next.length) {
    let pick: TreeEdge;
    if (turnOf(node.fen) === t.userSide) {
      pick = node.next[0];
    } else {
      const due = (e: TreeEdge) => memo.get(e.child) ?? FAR;
      const best = Math.min(...node.next.map(due));
      const ties = node.next.filter((e) => due(e) <= best);
      const total = ties.reduce((s, e) => s + Math.max(1, e.games), 0);
      let r = random() * total;
      pick = ties[ties.length - 1];
      for (const e of ties) {
        r -= Math.max(1, e.games);
        if (r < 0) {
          pick = e;
          break;
        }
      }
    }
    if (seen.has(pick.child)) break;
    seen.add(pick.child);
    line.push(pick);
    node = t.nodes[pick.child];
  }
  return line;
}

export function grade(t: OpeningTree, key: string, q: RecallQuality, now: number): SrsCard {
  const next = review(t.cards[key] ?? freshCard(key, now), q, now);
  t.cards[key] = next;
  return next;
}

/** Whether a played move is the tree's move (castling written either way). */
export function sameMove(fen: string, played: string, expected: string): boolean {
  if (played === expected) return true;
  const pos = positionFromFen(fen);
  const a = uciToMove(played);
  const b = uciToMove(expected);
  if (!a || !b || a.from !== b.from) return false;
  const piece = pos.board.get(a.from);
  if (piece?.role !== 'king') return false;
  // e1g1 and e1h1 are the same castling move.
  const side = (sq: number) => (sq % 8 > a.from % 8 ? 'k' : 'q');
  return Math.abs((a.to % 8) - (a.from % 8)) >= 2 && Math.abs((b.to % 8) - (b.from % 8)) >= 2 && side(a.to) === side(b.to);
}

const STORE = (id: string) => `k24.trainer.${id}`;

export function loadTree(id: string): OpeningTree | undefined {
  try {
    const raw = localStorage.getItem(STORE(id));
    return raw ? (JSON.parse(raw) as OpeningTree) : undefined;
  } catch {
    return undefined;
  }
}

export function saveTree(t: OpeningTree): void {
  try {
    localStorage.setItem(STORE(t.openingId), JSON.stringify(t));
  } catch {
    /* storage full or blocked */
  }
}

export function deleteTree(id: string): void {
  try {
    localStorage.removeItem(STORE(id));
  } catch {
    /* ignore */
  }
}

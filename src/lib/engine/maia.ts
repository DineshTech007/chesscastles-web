import type { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { fenOf } from '$lib/chess/position';
import { get, writable } from 'svelte/store';

/**
 * Maia-3: a neural network trained on millions of human games that plays
 * like a human of a chosen rating (CSSLab, University of Toronto; the browser
 * model and runtime come from the Maia Chess platform, GPL-3.0). It runs in a
 * Web Worker; the model (46 MB) downloads once and is kept in the browser.
 */

export type MaiaStatus = 'idle' | 'loading' | 'no-cache' | 'downloading' | 'ready' | 'error';
export const maiaStatus = writable<MaiaStatus>('idle');
export const maiaProgress = writable(0);

const PIECES = 'PNBRQKpnbrqk';

/** The board from the side to move's point of view (Maia always sees White to move). */
export function mirrorFen(fen: string): string {
  const [board, turn, castling, ep, half = '0', full = '1'] = fen.split(' ');
  const rows = board
    .split('/')
    .reverse()
    .map((r) => [...r].map((c) => (/[a-z]/.test(c) ? c.toUpperCase() : /[A-Z]/.test(c) ? c.toLowerCase() : c)).join(''));
  const swap = castling === '-' ? '-' : ['K', 'Q', 'k', 'q'].filter((c) => castling.includes(c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('') || '-';
  const mirrorSq = (s: string) => s[0] + String(9 - Number(s[1]));
  return `${rows.join('/')} ${turn === 'w' ? 'b' : 'w'} ${swap} ${ep === '-' ? '-' : mirrorSq(ep)} ${half} ${full}`;
}

/** (64 squares × 12 pieces) tokens, square index = rank * 8 + file. */
export function boardTokens(fen: string): Float32Array {
  const t = new Float32Array(64 * 12);
  fen
    .split(' ')[0]
    .split('/')
    .forEach((row, r) => {
      let file = 0;
      for (const c of row) {
        const n = Number(c);
        if (n) file += n;
        else {
          t[((7 - r) * 8 + file) * 12 + PIECES.indexOf(c)] = 1;
          file++;
        }
      }
    });
  return t;
}

/** A move as Maia names it: plain UCI with castling as the king's two-square move. */
export function maiaUci(pos: Chess, m: NormalMove): string {
  const piece = pos.board.get(m.from);
  const target = pos.board.get(m.to);
  let to = m.to;
  if (piece?.role === 'king' && target?.role === 'rook' && target.color === piece.color) to = m.to > m.from ? m.from + 2 : m.from - 2;
  const sq = (s: number) => 'abcdefgh'[s & 7] + String((s >> 3) + 1);
  return sq(m.from) + sq(to) + (m.promotion ? { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' }[m.promotion as 'queen'] : '');
}

const mirrorUci = (u: string) => u[0] + String(9 - Number(u[1])) + u[2] + String(9 - Number(u[3])) + u.slice(4);

class Maia {
  private worker?: Worker;
  private moves?: Promise<Record<string, string>>;
  private index?: Promise<Record<string, number>>;
  private pending = new Map<number, (r: { move: Float32Array; value: Float32Array } | Error) => void>();
  private nextId = 0;

  /** Starts the worker and loads the model if it is already in the browser. */
  init() {
    if (this.worker || typeof Worker === 'undefined') return;
    this.worker = new Worker('/maia-worker.js');
    maiaStatus.set('loading');
    this.worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'status') maiaStatus.set(m.status);
      else if (m.type === 'progress') maiaProgress.set(m.progress);
      else if (m.type === 'result') {
        this.pending.get(m.id)?.({ move: new Float32Array(m.logitsMove), value: new Float32Array(m.logitsValue) });
        this.pending.delete(m.id);
      } else if (m.type === 'error') {
        if (m.id !== undefined) {
          this.pending.get(m.id)?.(new Error(m.message));
          this.pending.delete(m.id);
        } else maiaStatus.set('error');
      }
    };
    this.worker.onerror = () => maiaStatus.set('error');
    this.worker.postMessage({ type: 'init' });
    this.moves = fetch('/maia/moves.json').then((r) => r.json());
    this.index = this.moves.then((m) => Object.fromEntries(Object.entries(m).map(([i, u]) => [u, Number(i)])));
  }

  /**
   * Whether the model is loaded, waiting up to `ms` while it loads from the
   * browser's storage. While it is still downloading (a minute or more the
   * first time) this answers no at once, so a move never waits for it.
   */
  whenReady(ms = 5000): Promise<boolean> {
    this.init();
    return new Promise((resolve) => {
      let unsubscribe = () => {};
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        queueMicrotask(() => unsubscribe());
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), ms);
      unsubscribe = maiaStatus.subscribe((s) => {
        if (s === 'ready') finish(true);
        else if (s === 'no-cache' || s === 'error' || s === 'idle' || s === 'downloading') finish(false);
      });
    });
  }

  /**
   * Loads Maia in the background a few seconds after the site opens, and
   * downloads it the first time (not on a connection in data-saver mode,
   * where the player is offered the button instead).
   */
  autoLoad(delay = 4000) {
    if (typeof Worker === 'undefined') return;
    setTimeout(() => {
      this.init();
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      const unsubscribe = maiaStatus.subscribe((s) => {
        if (s === 'no-cache' && !saveData) this.download();
        if (s !== 'loading' && s !== 'idle') queueMicrotask(() => unsubscribe());
      });
    }, delay);
  }

  /** Downloads the model (once). */
  download() {
    this.init();
    if (get(maiaStatus) === 'downloading' || get(maiaStatus) === 'ready') return;
    maiaProgress.set(0);
    this.worker?.postMessage({ type: 'download' });
  }

  /** How likely a human of `elo` (against `oppo`) is to play each legal move. */
  async policy(pos: Chess, elo: number, oppo = elo): Promise<{ move: NormalMove; p: number }[]> {
    this.init();
    const black = pos.turn === 'black';
    const fen = black ? mirrorFen(fenOf(pos)) : fenOf(pos);
    const index = await this.index!;
    const id = this.nextId++;
    const out = await new Promise<{ move: Float32Array; value: Float32Array }>((resolve, reject) => {
      this.pending.set(id, (r) => (r instanceof Error ? reject(r) : resolve(r)));
      this.worker!.postMessage({ type: 'inference', id, tokens: boardTokens(fen).buffer, eloSelf: elo, eloOppo: oppo });
    });
    const legal: { move: NormalMove; logit: number }[] = [];
    for (const [from, dests] of pos.allDests()) {
      for (const to of dests) {
        const promos = pos.board.get(from)?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0) ? (['queen', 'knight', 'rook', 'bishop'] as const) : [undefined];
        for (const promotion of promos) {
          const m: NormalMove = promotion ? { from, to, promotion } : { from, to };
          if (!pos.isLegal(m)) continue;
          let u = maiaUci(pos, m);
          if (black) u = mirrorUci(u);
          const i = index[u];
          if (i !== undefined) legal.push({ move: m, logit: out.move[i] });
        }
      }
    }
    const max = Math.max(...legal.map((l) => l.logit));
    const exps = legal.map((l) => Math.exp(l.logit - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return legal.map((l, i) => ({ move: l.move, p: exps[i] / sum })).sort((a, b) => b.p - a.p);
  }

  /** A human-like move for a player rated `elo`: sampled from Maia's predictions, ignoring very rare moves. */
  async move(pos: Chess, elo: number): Promise<NormalMove | undefined> {
    const policy = (await this.policy(pos, elo)).filter((x, i) => i === 0 || x.p >= 0.02);
    const total = policy.reduce((a, x) => a + x.p, 0);
    let r = Math.random() * total;
    for (const x of policy) if ((r -= x.p) <= 0) return x.move;
    return policy[0]?.move;
  }
}

export const maia = new Maia();

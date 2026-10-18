/**
 * Stockfish 19 (lite, single-threaded WASM) in a Web Worker, so the page
 * never freezes while it thinks. One engine for the whole site; moves for a
 * game always come before analysis.
 */

export interface EngineInfo {
  fen: string;
  depth: number;
  /** Centipawns from White's point of view (undefined when mate is known). */
  cp?: number;
  /** Moves to mate from White's point of view (negative: Black mates). */
  mate?: number;
  pv: string[];
  /** The second-best line, when asked for (evaluate with multipv 2). */
  second?: EngineInfo;
}

type Job =
  | { kind: 'play'; fen: string; elo: number; ms: number; resolve: (uci: string | null) => void }
  | { kind: 'score'; fen: string; moves: string[]; ms: number; scores: Map<string, number>; resolve: (s: Map<string, number>) => void }
  | { kind: 'analyse'; fen: string; depth: number; multipv: number; lines: EngineInfo[]; onInfo: (i: EngineInfo) => void; onLines?: (l: EngineInfo[]) => void; onDone?: () => void }
  | { kind: 'eval'; fen: string; depth: number; multipv: number; maxMs?: number; second?: EngineInfo; onInfo: (i: EngineInfo) => void; onDone: () => void };

const ENGINE_URL = '/engine/stockfish-19-lite-single.js';

class Stockfish {
  private worker?: Worker;
  private ready?: Promise<void>;
  private current?: Job;
  private nextPlay?: Job & { kind: 'play' | 'score' };
  private nextAnalysis?: Job & { kind: 'analyse' };
  /** Evaluations wait their turn: one never cuts another short. */
  private evals: (Job & { kind: 'eval' })[] = [];
  private stopping = false;
  private waiters: { match: (l: string) => boolean; done: () => void }[] = [];
  /** Set when the engine can't run in this browser. */
  error?: string;

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve) => {
      try {
        this.worker = new Worker(ENGINE_URL);
      } catch (e) {
        this.error = 'The engine could not start in this browser.';
        console.warn(e);
        resolve();
        return;
      }
      this.worker.onmessage = (ev) => this.onLine(String(ev.data));
      this.worker.onerror = () => {
        this.error = 'The engine could not start in this browser.';
      };
      this.waitFor((l) => l === 'uciok', () => {
        this.send('setoption name Hash value 32');
        this.send('isready');
        this.waitFor((l) => l === 'readyok', resolve);
      });
      this.send('uci');
    });
    return this.ready;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(match: (l: string) => boolean, done: () => void) {
    this.waiters.push({ match, done });
  }

  private onLine(line: string) {
    const w = this.waiters.findIndex((x) => x.match(line));
    if (w >= 0) {
      const [x] = this.waiters.splice(w, 1);
      x.done();
      return;
    }
    const job = this.current;
    if (!job) return;
    if (line.startsWith('info') && job.kind === 'score') {
      const t = line.split(' ');
      const at = (k: string) => t.indexOf(k);
      if (at('pv') >= 0 && at('score') >= 0) {
        const v = Number(t[at('score') + 2]);
        job.scores.set(t[at('pv') + 1], t[at('score') + 1] === 'mate' ? (v > 0 ? 3000 - v : -3000 - v) : v);
      }
    } else if (line.startsWith('info') && (job.kind === 'analyse' || job.kind === 'eval') && !this.stopping) {
      const info = parseInfo(line, job.fen);
      if (info) job.onInfo(info);
      if (job.kind === 'analyse' && job.onLines) {
        // Several lines: keep each one's latest report, best first.
        const k = Number(/ multipv (\d+) /.exec(line)?.[1] ?? 1);
        const l = parseInfo(line.replace(/ multipv \d+ /, ' multipv 1 '), job.fen);
        if (l && k >= 1 && k <= job.multipv) {
          job.lines[k - 1] = l;
          job.onLines(job.lines.filter(Boolean));
        }
      } else if (!info && job.kind === 'eval' && / multipv 2 /.test(line)) job.second = parseInfo(line.replace(' multipv 2 ', ' multipv 1 '), job.fen);
    } else if (line.startsWith('bestmove')) {
      const uci = line.split(' ')[1];
      if (job.kind === 'play') job.resolve(uci && uci !== '(none)' ? uci : null);
      else if (job.kind === 'score') {
        this.send('setoption name MultiPV value 1');
        job.resolve(job.scores);
      } else job.onDone?.();
      this.current = undefined;
      this.stopping = false;
      this.next();
    }
  }

  private next() {
    if (this.current) return;
    const job = this.nextPlay ?? this.evals.shift() ?? this.nextAnalysis;
    if (!job) return;
    if (job === this.nextPlay) this.nextPlay = undefined;
    else if (job === this.nextAnalysis) this.nextAnalysis = undefined;
    this.current = job;
    if (job.kind === 'play') {
      this.send('setoption name UCI_LimitStrength value true');
      this.send(`setoption name UCI_Elo value ${Math.min(3190, Math.max(1320, job.elo))}`);
      this.send('setoption name MultiPV value 1');
      this.send(`position fen ${job.fen}`);
      this.send(`go movetime ${job.ms}`);
    } else if (job.kind === 'score') {
      this.send('setoption name UCI_LimitStrength value false');
      this.send(`setoption name MultiPV value ${job.moves.length}`);
      this.send(`position fen ${job.fen}`);
      this.send(`go movetime ${job.ms} searchmoves ${job.moves.join(' ')}`);
    } else {
      this.send('setoption name UCI_LimitStrength value false');
      this.send(`setoption name MultiPV value ${job.multipv}`);
      this.send(`position fen ${job.fen}`);
      // An evaluation may also have a time cap: it stops at the depth or the time, whichever comes first.
      this.send(`go depth ${job.depth}${job.kind === 'eval' && job.maxMs ? ` movetime ${job.maxMs}` : ''}`);
    }
  }

  private preempt() {
    if (this.current && !this.stopping) {
      this.stopping = true;
      this.send('stop');
    } else if (!this.current) this.next();
  }

  /** The move Stockfish plays at about elo (1320–3190), in UCI; null if none. */
  async play(fen: string, elo: number, ms = 700): Promise<string | null> {
    await this.start();
    if (!this.worker) return null;
    this.cancelNextPlay();
    return new Promise((resolve) => {
      this.nextPlay = { kind: 'play', fen, elo, ms, resolve };
      // Let a running move search finish; stop a running analysis.
      if (this.current?.kind === 'analyse') this.preempt();
      else this.next();
    });
  }

  /**
   * Full-strength scores (centipawns for the side to move; mate as ±3000)
   * of the given moves (standard UCI, castling as e1g1), searched together
   * for `ms`. Like a move search, it comes before any analysis.
   */
  async scoreMoves(fen: string, moves: string[], ms = 600): Promise<Map<string, number>> {
    await this.start();
    if (!this.worker || !moves.length) return new Map();
    this.cancelNextPlay();
    return new Promise((resolve) => {
      this.nextPlay = { kind: 'score', fen, moves, ms, scores: new Map(), resolve };
      if (this.current?.kind === 'analyse') this.preempt();
      else this.next();
    });
  }

  private cancelNextPlay() {
    const j = this.nextPlay;
    if (j?.kind === 'play') j.resolve(null);
    else if (j?.kind === 'score') j.resolve(new Map());
  }

  /** Analyses fen, replacing any analysis in progress. */
  /** `multipv` > 1 reports the best lines through `onLines` (best first). */
  async analyse(fen: string, onInfo: (i: EngineInfo) => void, depth = 22, onDone?: () => void, multipv = 1, onLines?: (l: EngineInfo[]) => void): Promise<void> {
    await this.start();
    if (!this.worker) return onDone?.();
    // A replaced request that never started still has to finish.
    this.nextAnalysis?.onDone?.();
    this.nextAnalysis = { kind: 'analyse', fen, depth, multipv, lines: [], onInfo, onLines, onDone };
    if (this.current?.kind === 'analyse') this.preempt();
    else this.next();
  }

  /**
   * The final evaluation of fen at depth (undefined if the engine can't run).
   * Evaluations are queued: a later one never stops an earlier one, so every
   * result is searched to the full depth (a move's grade depends on it).
   */
  async evaluate(fen: string, depth = 12, multipv = 1, maxMs?: number): Promise<EngineInfo | undefined> {
    await this.start();
    if (!this.worker) return undefined;
    return new Promise((resolve) => {
      let last: EngineInfo | undefined;
      const job: Job & { kind: 'eval' } = {
        kind: 'eval',
        fen,
        depth,
        multipv,
        maxMs,
        onInfo: (i) => (last = i),
        onDone: () => resolve(last && job.second ? { ...last, second: job.second } : last),
      };
      this.evals.push(job);
      // Background analysis gives way; a running move search or evaluation finishes first.
      if (this.current?.kind === 'analyse') this.preempt();
      else this.next();
    });
  }

  stopAnalysis() {
    this.nextAnalysis?.onDone?.();
    this.nextAnalysis = undefined;
    if (this.current?.kind === 'analyse') this.preempt();
  }
}

export function parseInfo(line: string, fen: string): EngineInfo | undefined {
  const t = line.split(' ');
  const at = (k: string) => t.indexOf(k);
  if (at('pv') < 0 || at('score') < 0) return undefined;
  const multipv = at('multipv') >= 0 ? Number(t[at('multipv') + 1]) : 1;
  if (multipv !== 1) return undefined;
  const whiteToMove = fen.split(' ')[1] !== 'b';
  const sign = whiteToMove ? 1 : -1;
  const kind = t[at('score') + 1];
  const value = Number(t[at('score') + 2]);
  return {
    fen,
    depth: Number(t[at('depth') + 1]),
    cp: kind === 'cp' ? sign * value : undefined,
    mate: kind === 'mate' ? sign * value : undefined,
    pv: t.slice(at('pv') + 1),
  };
}

/** White's winning chances, 0..1, on the Lichess curve. */
export function whiteChances(i: Pick<EngineInfo, 'cp' | 'mate'>): number {
  if (i.mate !== undefined) return i.mate > 0 ? 1 : 0;
  const cp = Math.max(-1000, Math.min(1000, i.cp ?? 0));
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}

export function evalLabel(i: Pick<EngineInfo, 'cp' | 'mate'>): string {
  if (i.mate !== undefined) return `#${i.mate}`;
  const p = Math.round((i.cp ?? 0) / 10) / 10;
  // A tiny edge either way is shown as 0.0, never -0.0.
  return p === 0 ? '0.0' : `${p > 0 ? '+' : ''}${p.toFixed(1)}`;
}

export const engine = new Stockfish();

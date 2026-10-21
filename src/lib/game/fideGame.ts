import { Chess } from 'chessops/chess';
import type { NormalMove } from 'chessops/types';
import { makeUci, parseUci } from 'chessops/util';
import { parseSan } from 'chessops/san';
import { polyglotKey } from '$lib/chess/polyglot';
import { sanOf } from '$lib/chess/position';
import { FideBot, VARIETY_PLIES, type BotChoice, type MoveSource } from '$lib/bot/fideBot';

export interface TimeControl {
  minutes: number;
  increment: number;
  kind: 'Bullet' | 'Blitz' | 'Rapid' | 'Classical';
}

export const TIME_CONTROLS: TimeControl[] = [
  { minutes: 5, increment: 0, kind: 'Blitz' },
  { minutes: 10, increment: 0, kind: 'Blitz' },
  { minutes: 15, increment: 10, kind: 'Rapid' },
  { minutes: 30, increment: 0, kind: 'Rapid' },
  { minutes: 60, increment: 0, kind: 'Classical' },
  { minutes: 90, increment: 30, kind: 'Classical' },
  // Added later: at the end, so saved choices and game links (?tc=2) keep their meaning.
  { minutes: 1, increment: 0, kind: 'Bullet' },
  { minutes: 1, increment: 1, kind: 'Bullet' },
];

/** TIME_CONTROLS' positions from the fastest to the slowest, for showing them in order. */
export const TIME_CONTROL_ORDER = TIME_CONTROLS.map((t, i) => ({ i, s: t.minutes * 60 + t.increment * 40 }))
  .sort((a, b) => a.s - b.s)
  .map((x) => x.i);

export const tcLabel = (tc: TimeControl) => `${tc.minutes}+${tc.increment}`;

export type GameEnd =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fiftyMoves'
  | 'timeout'
  | 'resignation'
  | 'aborted';

export type Color = 'white' | 'black';
export const opposite = (c: Color): Color => (c === 'white' ? 'black' : 'white');

export interface PlayedMove {
  move: NormalMove;
  san: string;
  after: Chess;
  /** For the bot's moves: where the move came from. */
  source?: MoveSource;
  /** For engine moves: the human-like Maia or Stockfish. */
  engine?: 'maia' | 'stockfish';
  games: number;
  window: number;
  /** How long the mover thought (ms, by the game clock); 0 before the clocks start. Sent with the game for fair play. */
  ms?: number;
}

/** Remembers the openings of recent games so the bot can vary its choices. */
export interface OpeningMemory {
  load(): string[];
  add(sans: string[]): void;
}

export const browserOpeningMemory: OpeningMemory = {
  load() {
    try {
      return JSON.parse(localStorage.getItem('k24.recentOpenings') ?? '[]');
    } catch {
      return [];
    }
  },
  add(sans) {
    if (sans.length < 2) return;
    try {
      const line = sans.slice(0, VARIETY_PLIES).join(' ');
      const list = [line, ...this.load()].slice(0, 12);
      localStorage.setItem('k24.recentOpenings', JSON.stringify(list));
    } catch {
      /* private mode: no memory */
    }
  },
};

/** A game in progress, saved after every move so it can be resumed after a lost connection or a closed browser. */
export interface GameSnapshot {
  moves: { uci: string; source?: MoveSource; engine?: PlayedMove['engine']; games?: number; window?: number; ms?: number }[];
  white: number;
  black: number;
  /** When the side to move started thinking (wall clock): time away counts on their clock, as in a real game. */
  turnStart?: number;
  savedAt: number;
}

export interface FideGameOptions {
  bot: FideBot;
  rating: number;
  /** The player's own rating, if known: the bot plays as against an opponent of that strength. */
  playerRating?: number;
  human: Color;
  timeControl: TimeControl;
  opening?: string[];
  /** Moves (SAN) already played when the game starts: a game from a line's position. The clocks start with the moves after them. */
  prelude?: string[];
  memory?: OpeningMemory;
  /**
   * How the opponent spends its thinking time: 'real' uses its clock like a
   * tournament player (sometimes half a minute on a hard move), 'quick' moves
   * within a few seconds (its clock still runs). Default 'real'.
   */
  pace?: 'real' | 'quick';
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
}

/**
 * A game against the FIDE-level bot: moves, both clocks, the result (a
 * port of the app's lib/fide_play/fide_game.dart). Listeners are called
 * after every change; clocks are read with remaining().
 */
export class FideGame {
  readonly bot: FideBot;
  readonly rating: number;
  readonly playerRating?: number;
  readonly human: Color;
  readonly timeControl: TimeControl;
  readonly pace: 'real' | 'quick';
  readonly opening?: string[];
  readonly prelude: string[];
  readonly start = Chess.default();
  readonly moves: PlayedMove[] = [];

  botThinking = false;
  end?: GameEnd;
  /** Undefined for a draw or an aborted game. */
  winner?: Color;

  private white: number;
  private black: number;
  private turnStart?: number;
  private readonly seen = new Map<bigint, number>();
  private readonly listeners = new Set<() => void>();
  private disposed = false;
  private readonly now: () => number;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly memory?: OpeningMemory;
  private ticker?: ReturnType<typeof setInterval>;

  constructor(o: FideGameOptions) {
    this.bot = o.bot;
    this.rating = o.rating;
    this.playerRating = o.playerRating;
    this.human = o.human;
    this.timeControl = o.timeControl;
    this.opening = o.opening;
    this.prelude = o.prelude ?? [];
    this.memory = o.memory;
    this.pace = o.pace ?? 'real';
    this.now = o.now ?? (() => Date.now());
    this.wait = o.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = o.random ?? Math.random;
    this.white = this.black = o.timeControl.minutes * 60_000;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    for (const fn of this.listeners) fn();
  }

  get botSide(): Color {
    return opposite(this.human);
  }
  get position(): Chess {
    return (this.moves.length ? this.moves[this.moves.length - 1].after : this.start).clone();
  }
  get sans(): string[] {
    return this.moves.map((m) => m.san);
  }
  get isOver(): boolean {
    return this.end !== undefined;
  }
  get myTurn(): boolean {
    return !this.isOver && !this.botThinking && this.position.turn === this.human;
  }
  /** False for a game without clocks (minutes 0), such as against the computer. */
  get timed(): boolean {
    return this.timeControl.minutes > 0;
  }
  /** The clocks run from White's first move, as on chess.com (owner's request: a game's clock should start at once). */
  private get clockRunning(): boolean {
    return this.timed && this.moves.length - this.prelude.length >= 1 && !this.isOver;
  }
  get canAbort(): boolean {
    return !this.isOver && !this.moves.some((m) => m.source === undefined);
  }

  /** The game so far, to resume later (see restore). */
  snapshot(): GameSnapshot {
    return {
      moves: this.moves.map((m) => ({ uci: makeUci(m.move), source: m.source, engine: m.engine, games: m.games, window: m.window, ms: m.ms })),
      white: this.white,
      black: this.black,
      turnStart: this.turnStart,
      savedAt: this.now(),
    };
  }

  /** Replays a saved game (call before begin). The clock of the side to move has kept running since it was saved. */
  restore(s: GameSnapshot): void {
    for (const m of s.moves) {
      const move = parseUci(m.uci) as NormalMove | undefined;
      const pos = this.position;
      if (!move || !pos.isLegal(move)) break;
      const san = sanOf(pos, move);
      const after = pos.clone();
      after.play(move);
      this.moves.push({ move, san, after, source: m.source, engine: m.engine, games: m.games ?? 0, window: m.window ?? 0, ms: m.ms });
      const key = polyglotKey(after);
      this.seen.set(key, (this.seen.get(key) ?? 0) + 1);
    }
    this.white = s.white;
    this.black = s.black;
    this.turnStart = s.turnStart;
  }

  begin(): void {
    if (this.memory) this.bot.recentOpenings = this.memory.load();
    this.seen.set(polyglotKey(this.start), (this.seen.get(polyglotKey(this.start)) ?? 0) + 1);
    // A game from a line's position: its moves are on the board at once (a resumed game has them already).
    if (!this.moves.length) {
      for (const san of this.prelude) {
        const pos = this.position;
        const move = parseSan(pos, san);
        if (!move || !('from' in move) || !pos.isLegal(move)) break;
        const after = pos.clone();
        after.play(move);
        this.moves.push({ move, san: sanOf(pos, move), after, source: 'opening', games: 0, window: 0 });
        const key = polyglotKey(after);
        this.seen.set(key, (this.seen.get(key) ?? 0) + 1);
      }
      // Show the line's position at once, also when the player moves first from it.
      if (this.moves.length) this.notify();
    }
    if (this.moves.length) this.tick();
    if (this.isOver) return this.notify();
    if (this.position.turn !== this.human) void this.botTurn();
    else void this.bot.prefetchReplies(this.position);
    this.ticker = setInterval(() => this.tick(), 100);
  }

  remaining(side: Color): number {
    if (!this.timed) return 0;
    let t = side === 'white' ? this.white : this.black;
    if (this.clockRunning && this.turnStart !== undefined && this.position.turn === side) {
      t -= this.now() - this.turnStart;
    }
    return Math.max(0, t);
  }

  /** Plays the player's move; false if it is not their turn or not legal. */
  play(move: NormalMove): boolean {
    const pos = this.position;
    if (!this.myTurn || !pos.isLegal(move)) return false;
    this.apply(move);
    if (!this.isOver) void this.botTurn();
    return true;
  }

  resign(): void {
    if (!this.isOver) this.finish('resignation', this.botSide);
  }

  abort(): void {
    if (this.canAbort) this.finish('aborted', undefined);
  }

  private async botTurn(): Promise<void> {
    this.botThinking = true;
    this.notify();
    const started = this.now();
    let choice: BotChoice | undefined;
    try {
      choice = await this.bot.choose(this.position, this.sans, this.playingRating(), this.opening, this.playerRating, this.engineLimit(), (p) => this.seen.get(polyglotKey(p)) ?? 0);
    } catch (e) {
      console.warn('FIDE bot:', e);
    }
    if (this.disposed || this.isOver) return;
    if (!choice) {
      this.botThinking = false;
      this.notify();
      return;
    }
    const rest = this.thinkTime(choice.source, choice.confidence, choice.move) - (this.now() - started);
    if (rest > 0) await this.wait(rest);
    if (this.disposed || this.isOver) return;
    this.botThinking = false;
    this.apply(choice.move, choice);
  }

  /**
   * How long the engines may work on the bot's move, so its clock lasts the
   * game (the engines are slower on a phone than the time a player would
   * take, above all in bullet): most of the move's budget, never more than
   * an eighth of what is left. None without a clock, or while the clocks
   * haven't started.
   */
  engineLimit(): number | undefined {
    if (!this.timed || this.moves.length - this.prelude.length < 2) return undefined;
    const left = this.remaining(this.botSide);
    const budget = moveBudget({ left, increment: this.timeControl.increment * 1000, moveNo: this.position.fullmoves, rating: this.rating });
    return Math.round(Math.min(budget * 0.75, left / 8));
  }

  /**
   * The rating the bot plays this move at: in bullet and the fastest blitz, a player short of time plays worse
   * (under a sixth of the starting clock a little, under a twelfth more), as the players it stands for do.
   */
  playingRating(): number {
    if (!this.timed || !isFast(this.timeControl) || this.moves.length - this.prelude.length < 2) return this.rating;
    const share = this.remaining(this.botSide) / (this.timeControl.minutes * 60_000 + this.timeControl.increment * 40_000);
    return share < 1 / 12 ? this.rating - 300 : share < 1 / 6 ? this.rating - 150 : this.rating;
  }

  /** The player's average time a move after the first few (their pace), once there are enough moves to tell. */
  playerPace(): number | undefined {
    const own = this.moves
      .slice(this.prelude.length)
      .filter((m) => m.source === undefined && (m.ms ?? 0) > 0)
      .slice(3)
      .map((m) => m.ms ?? 0);
    return own.length >= 3 ? own.reduce((a, b) => a + b, 0) / own.length : undefined;
  }

  /** How long the bot "thinks" before playing (see moveTime). */
  thinkTime(source: MoveSource, confidence?: number, move?: NormalMove): number {
    if (!this.timed) return 500 + Math.round(this.random() * 900);
    const real = this.realThinkTime(source, confidence, move);
    // In bullet and the fastest blitz the clock decides games: the bot keeps a real player's pace there whatever
    // the pace chosen ("quick" only saves waiting in slower games, where the player has time to spare).
    if (this.pace === 'quick' && !isFast(this.timeControl)) {
      // Quick: a short, natural pause, a little longer when the move is not obvious;
      // never slower than a real player (who in bullet is quicker still).
      const c = confidence ?? 0.5;
      const ms = 500 + this.random() * 900 + (c < 0.5 ? 1000 + this.random() * 1500 : 0);
      return Math.round(Math.min(ms, (this.position.turn === 'white' ? this.white : this.black) / 10, real));
    }
    return real;
  }

  /** A real player's thinking time, for the clock (see moveTime). */
  private realThinkTime(source: MoveSource, confidence?: number, move?: NormalMove): number {
    if (this.moves.length - this.prelude.length < 2) return Math.round(1000 + this.random() * 2000);
    const pos = this.position;
    // Bullet has no games database: its first moves, when they are the natural ones, are played as quickly as known theory.
    const bulletOpening = isFast(this.timeControl) && source === 'engine' && pos.fullmoves <= 8 && (confidence ?? 0) >= 0.3;
    const kind: MoveKind =
      countLegal(pos) === 1
        ? 'forced'
        : source === 'opening' || (source === 'book' && pos.fullmoves <= 10) || bulletOpening
          ? 'theory'
          : move && this.isRecapture(move)
            ? 'recapture'
            : 'normal';
    return moveTime({
      left: this.remaining(this.botSide),
      increment: this.timeControl.increment * 1000,
      moveNo: pos.fullmoves,
      rating: this.rating,
      kind,
      confidence,
      random: this.random,
      fast: isFast(this.timeControl),
      mirror: this.playerPace(),
    });
  }

  /** Whether `move` takes back on the square where the opponent just captured. */
  private isRecapture(move: NormalMove): boolean {
    const n = this.moves.length;
    if (n < 1) return false;
    const last = this.moves[n - 1].move;
    const before = n >= 2 ? this.moves[n - 2].after : this.start;
    return last.to === move.to && before.board.get(last.to) !== undefined;
  }


  private apply(move: NormalMove, choice?: BotChoice): void {
    const pos = this.position;
    const mover = pos.turn;
    const now = this.now();
    let used = 0;
    if (this.clockRunning && this.turnStart !== undefined) {
      used = now - this.turnStart;
      const inc = this.timeControl.increment * 1000;
      if (mover === 'white') this.white = this.white - used + inc;
      else this.black = this.black - used + inc;
    }
    const san = sanOf(pos, move);
    const after = pos.clone();
    after.play(move);
    this.moves.push({ move, san, after, source: choice?.source, engine: choice?.engine, games: choice?.games ?? 0, window: choice?.window ?? 0, ms: Math.max(0, Math.round(used)) });
    this.turnStart = now;
    const key = polyglotKey(after);
    this.seen.set(key, (this.seen.get(key) ?? 0) + 1);
    this.checkEnd(after, key);
    if (choice && !this.isOver) void this.bot.prefetchReplies(after);
    this.notify();
  }

  private checkEnd(pos: Chess, key: bigint): void {
    if (pos.isCheckmate()) this.finish('checkmate', opposite(pos.turn));
    else if (pos.isStalemate()) this.finish('stalemate', undefined);
    else if (pos.isInsufficientMaterial()) this.finish('insufficient', undefined);
    else if ((this.seen.get(key) ?? 0) >= 3) this.finish('threefold', undefined);
    else if (pos.halfmoves >= 100) this.finish('fiftyMoves', undefined);
  }

  /** Checks the clock (runs ten times a second). */
  tick(): void {
    if (this.isOver || !this.clockRunning) return;
    const side = this.position.turn;
    if (this.remaining(side) > 0) return;
    if (side === 'white') this.white = 0;
    else this.black = 0;
    const other = opposite(side);
    // Out of time is a draw when the other side cannot possibly mate.
    this.finish('timeout', this.position.hasInsufficientMaterial(other) ? undefined : other);
  }

  /** How long the side to move had been thinking when the game ended (ms): the last, unplayed move's time. */
  endThinking = 0;

  private finish(how: GameEnd, winner: Color | undefined): void {
    if (this.isOver) return;
    const side = this.position.turn;
    if (this.clockRunning && this.turnStart !== undefined) this.endThinking = Math.max(0, Math.round(this.now() - this.turnStart));
    if (this.clockRunning && how !== 'timeout') {
      if (side === 'white') this.white = this.remaining('white');
      else this.black = this.remaining('black');
    }
    this.end = how;
    this.winner = winner;
    this.botThinking = false;
    clearInterval(this.ticker);
    if (how !== 'aborted') this.memory?.add(this.sans);
    this.notify();
  }

  /** "1-0", "0-1", "½-½", or "" for an aborted game. */
  get result(): string {
    if (this.end === 'aborted') return '';
    return this.winner === 'white' ? '1-0' : this.winner === 'black' ? '0-1' : '½-½';
  }

  get endReason(): string {
    switch (this.end) {
      case 'checkmate':
        return 'Checkmate';
      case 'stalemate':
        return 'Stalemate';
      case 'insufficient':
        return 'Neither side can checkmate';
      case 'threefold':
        return 'Same position three times';
      case 'fiftyMoves':
        return '50 moves without a capture or pawn move';
      case 'timeout':
        return this.winner === undefined
          ? 'Time ran out, but the other side cannot checkmate'
          : `${this.winner === this.human ? 'Your opponent' : 'You'} ran out of time`;
      case 'resignation':
        return 'You resigned';
      case 'aborted':
        return 'Game aborted';
      default:
        return '';
    }
  }

  get sourceCounts(): Record<MoveSource, number> {
    const c = { opening: 0, book: 0, engine: 0 };
    for (const m of this.moves) if (m.source) c[m.source]++;
    return c;
  }

  dispose(): void {
    this.disposed = true;
    clearInterval(this.ticker);
    this.listeners.clear();
  }
}

export type MoveKind = 'forced' | 'theory' | 'recapture' | 'normal';

/** Bullet and the fastest blitz (up to 3 minutes, counting the increment over 40 moves). */
export const isFast = (tc: TimeControl) => tc.minutes > 0 && tc.minutes + tc.increment * 0.67 <= 3;

/**
 * A move's usual share of the clock: the time left (keeping a reserve) spread
 * over the moves a game still usually lasts, plus most of the increment;
 * stronger players take a little more of their time.
 */
export function moveBudget(o: { left: number; increment: number; moveNo: number; rating: number; fast?: boolean }): number {
  const movesLeft = Math.max(20, 45 - o.moveNo / 2);
  // In bullet everyone spends their whole clock (the reserve is all they keep).
  const pace = o.fast ? 1 : Math.min(1.1, Math.max(0.7, 0.75 + (o.rating - 1200) / 2400));
  return ((o.left * 0.9) / movesLeft) * pace + o.increment * 0.85;
}

/**
 * Thinking time for one move, the way real players use their clock:
 * - a budget from the time left (keeping a reserve) spread over the moves a
 *   game still usually lasts, plus most of the increment, so the pace stays
 *   even instead of slow first and rushed at the end;
 * - quick on known theory, forced moves and recaptures, and on moves that
 *   clearly stand out (`confidence`, 0 to 1);
 * - longer in unclear positions and just after leaving the opening;
 * - stronger players take a little more of their time.
 */
export function moveTime(o: {
  left: number;
  increment: number;
  moveNo: number;
  rating: number;
  kind: MoveKind;
  confidence?: number;
  random: () => number;
  fast?: boolean;
  /** The player's average time a move (fast games: the bot keeps about the same pace). */
  mirror?: number;
}): number {
  const { left, moveNo, random } = o;
  const budget = moveBudget(o);
  let ms: number;
  if (o.kind === 'forced') ms = Math.min(600 + random() * 1200, budget * 0.8);
  else if (o.kind === 'theory') ms = budget * 0.05 + (500 + random() * 2500) * Math.min(1, budget / 8000);
  else if (o.kind === 'recapture') ms = budget * (0.15 + random() * 0.3);
  else {
    const c = o.confidence ?? 0.45;
    const difficulty = c >= 0.75 ? 0.45 : c >= 0.5 ? 0.8 : c >= 0.3 ? 1.1 : 1.45;
    const leavingBook = moveNo >= 10 && moveNo <= 25 ? 1.2 : 1;
    const u = 1 - random();
    const gaussian = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
    ms = budget * difficulty * leavingBook * Math.exp(gaussian * 0.45);
  }
  // Bullet and the fastest blitz: a real player's use of the clock, and close to the player's own pace (half the
  // budget's time, half theirs, give or take), so the games are won on the board rather than on the clock.
  if (o.fast && o.mirror && (o.kind === 'normal' || o.kind === 'recapture')) ms = ms * 0.5 + o.mirror * (0.6 + 0.8 * random()) * 0.5;
  // Never more than a fifth of what is left, and never instant (in bullet, a little quicker).
  return Math.max(Math.min(450, budget * 0.4), Math.round(Math.min(ms, left / 5)));
}

function countLegal(pos: Chess): number {
  let n = 0;
  for (const [, dests] of pos.allDests()) n += dests.size();
  return n;
}

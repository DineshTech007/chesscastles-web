import { Room, type GameHost, type RoomStatus } from '$lib/classroom/api';
import { lineAt } from '$lib/classroom/tasks';
import { FideBot } from '$lib/bot/fideBot';
import { opponentBook } from '$lib/book/profiles';
import { bookGuard, humanMove } from '$lib/game/engineMove';
import { maia } from '$lib/engine/maia';
import { makeUci } from 'chessops/util';
import { isFast, moveBudget, moveTime, type TimeControl } from '$lib/game/fideGame';
import type { CupGame, CupView } from './api';

/**
 * A Castle Cup as it happens (server/api-worker src/cup.ts, "cup:<id>"): the players, this round's games, the
 * standings. It is the game board's host (GameBoard.svelte) for the child's own game, and it plays the computer
 * player's moves when the child is paired with one: the FIDE opponents' engine in this browser, at the computer
 * player's rating, using its clock the way the FIDE opponents do (fideGame.ts moveTime: quick on theory and
 * recaptures, longer in unclear positions, and in bullet close to the child's own pace, so games are won on the board,
 * not by a computer that never runs short of time). The room checks every move and clock.
 */
export class CupLive implements GameHost {
  view = $state<CupView | undefined>();
  status = $state<RoomStatus>('connecting');
  now = $state(Date.now());
  /** This room is not there (nobody joined yet, or a wrong link). */
  gone = $state(false);
  me: { uid: string };
  private room: Room;
  private tick: ReturnType<typeof setInterval>;
  private bots = new Map<string, FideBot>();
  private thinking = '';
  /** When each game's last move arrived, and my own thinking times (the computer keeps close to my pace in bullet). */
  private lastAt = new Map<string, number>();
  private myTimes: number[] = [];

  constructor(
    readonly id: string,
    uid: string,
    private tc: TimeControl,
  ) {
    this.me = { uid };
    this.room = new Room(
      id,
      (m) => this.on(m),
      (s, why) => {
        this.status = s;
        if (s === 'closed' && why === 'refused') this.gone = true;
      },
      false,
      'cup',
    );
    this.tick = setInterval(() => (this.now = this.room.now()), 250);
  }

  /** My game in the round being played. */
  get myGame(): CupGame | undefined {
    const v = this.view;
    return v?.games.find((g) => g.round === v.round && g.black && (g.white === this.me.uid || g.black === this.me.uid));
  }
  get mine() {
    return this.view?.players.find((p) => p.uid === this.me.uid);
  }

  private on(m: any) {
    if (m.t === 'cup') {
      this.view = m;
      this.gone = false;
    } else if (m.t === 'move') {
      const g = this.view?.games.find((x) => x.id === m.game);
      // My thinking time: from the move before mine to mine (after the first few moves).
      if (g && g === this.myGame) {
        const mover = g.moves.length % 2 === 0 ? g.white : g.black;
        const t = Date.now();
        const was = this.lastAt.get(g.id);
        if (mover === this.me.uid && was && g.moves.length >= 6) this.myTimes = [...this.myTimes, t - was].slice(-10);
        this.lastAt.set(g.id, t);
      }
      if (g && g.moves.length < 600) {
        g.moves.push(m.uci);
        g.clock = m.clock;
        g.draw = '';
        if (m.result) {
          g.result = m.result;
          g.reason = m.reason;
        }
      }
    } else if (m.t === 'game') {
      const v = this.view;
      const i = v?.games.findIndex((x) => x.id === m.game.id) ?? -1;
      if (v && i >= 0) v.games[i] = { ...v.games[i], ...m.game };
    }
    // The whole cup or a game again (after a reconnect, or a move the room turned down): the computer thinks again.
    if (m.t === 'cup' || m.t === 'game') this.thinking = '';
    void this.botTurn();
  }

  gameMove(game: string, uci: string) {
    this.room.send({ t: 'move', game, uci });
  }
  flag(game: string) {
    this.room.send({ t: 'flag', game });
  }
  offerDraw(game: string) {
    this.room.send({ t: 'draw', game });
  }
  resign(game: string) {
    this.room.send({ t: 'resign', game });
  }
  sync() {
    this.room.send({ t: 'sync' });
  }

  /** The computer player's move, when my opponent is one and it's its turn. */
  private async botTurn() {
    const g = this.myGame;
    if (!g || g.result || !g.bot) return;
    const at = lineAt(g.root, g.moves, g.moves.length);
    if (!at.pos || at.turn !== g.bot) return;
    const key = `${g.id}:${g.moves.length}`;
    if (this.thinking === key) return;
    this.thinking = key;
    const opp = this.view?.players.find((p) => p.uid === g[g.bot!]);
    const rating = opp?.rating ?? 1200;
    let bot = this.bots.get(g.id);
    if (!bot) {
      void maia.autoLoad(0);
      bot = new FideBot(opponentBook(Math.min(2800, Math.max(1400, rating))), humanMove(this.tc), Math.random, bookGuard(this.tc));
      this.bots.set(g.id, bot);
    }
    const c = g.clock;
    const left = c ? c[g.bot] - (g.moves.length >= 2 ? this.room.now() - c.at : 0) : 60_000;
    const increment = this.tc.increment * 1000;
    const fast = isFast(this.tc);
    const moveNo = at.pos.fullmoves;
    // The engines get part of a move's usual time; the rest of the pause comes after (moveTime below).
    const budget = moveBudget({ left, increment, moveNo, rating, fast });
    const t0 = Date.now();
    let uci = '';
    let want = 600;
    try {
      const choice = await bot.choose(at.pos.clone(), at.sans, rating, undefined, this.mine?.rating, Math.max(150, Math.min(budget * 0.5, left / 20)));
      if (choice) {
        uci = makeUci(choice.move);
        const mine = this.myTimes.length >= 3 ? this.myTimes.reduce((a, b) => a + b, 0) / this.myTimes.length : undefined;
        const kind = g.moves.length < 2 ? 'theory' : choice.source === 'opening' || (choice.source === 'book' && moveNo <= 10) ? 'theory' : 'normal';
        want = moveTime({ left, increment, moveNo, rating, kind, confidence: choice.confidence, random: Math.random, fast, mirror: mine });
      }
    } catch {
      /* the engine failed: any legal move below */
    }
    if (!uci) {
      const dests = [...at.pos.allDests()].flatMap(([from, to]) => [...to].map((t) => ({ from, to: t })));
      const m = dests[Math.floor(Math.random() * dests.length)];
      if (m) uci = makeUci(m);
    }
    const wait = want - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    // Still the same position (the game didn't end or move on meanwhile).
    const now = this.myGame;
    if (!uci || !now || now.id !== g.id || now.result || now.moves.length !== g.moves.length) {
      if (this.thinking === key) this.thinking = '';
      return;
    }
    if (!this.room.send({ t: 'move', game: g.id, uci, bot: true }) && this.thinking === key) this.thinking = '';
  }

  close() {
    clearInterval(this.tick);
    this.room.close();
  }
}

<script lang="ts">
  /**
   * A class game (simul, game zone, or the coach against one student): the opponent above, me below, clocks when the
   * game has them, resign and draw offers. The room checks every move and the clocks; a flag is claimed when the
   * clock of the side to move shows zero. A Castle Cup uses it too (src/lib/cups): `host` is whatever room the game is
   * in, and `tag` adds a note to a name (a rating, "computer").
   */
  import type { Key } from '@lichess-org/chessground/types';
  import { makeUci } from 'chessops/util';
  import ClassBoard from './ClassBoard.svelte';
  import { lineAt } from './tasks';
  import type { Game, GameHost } from './api';
  import { destsOf, moveFromKeys } from '$lib/chess/position';
  import { promotionFor } from '$lib/chess/promotion';
  import { sounds } from '$lib/sound';
  import { makeBoardFen } from 'chessops/fen';
  import { keyOf } from '$lib/chess/position';
  import { PremoveQueue } from '$lib/game/premoves';
  import { premovesOn } from '$lib/preferences';
  import { t } from '$lib/i18n';
  import EvalBar from '$lib/cups/EvalBar.svelte';

  let { live, game, coordinates = true, tag, evalBar = false }: { live: GameHost; game: Game; coordinates?: boolean; tag?: (uid: string) => string; /** A little engine bar between the players (never in a game of the viewer's own). */ evalBar?: boolean } = $props();

  const me = $derived(live.me.uid);
  const mine = $derived<'white' | 'black' | undefined>(game.white === me ? 'white' : game.black === me ? 'black' : undefined);
  const at = $derived(lineAt(game.root, game.moves, game.moves.length));
  const orient = $derived(mine ?? 'white');
  const myTurn = $derived(!game.result && !!mine && at.turn === mine && !!at.pos);
  let remount = $state(0);
  let sent = -1;

  // A move the room turned down (out of turn, too late): the board shows the game as it is again.
  $effect(() => {
    const n = game.moves.length;
    if (sent >= 0 && n === sent && !game.result) remount++;
    sent = -1;
  });
  // Every move is heard, the first too (owner, 2026-10-23: "there should be some sound after a move"): a capture and
  // a check sound different; the board opened on a game already going is quiet.
  let heard = -1;
  $effect(() => {
    const n = game.moves.length;
    const san = at.sans[at.sans.length - 1] ?? '';
    if (heard >= 0 && n > heard) (san.includes('+') || san.includes('#') ? sounds.check : san.includes('x') ? sounds.capture : sounds.move)();
    heard = n;
  });
  // My clock under 10 seconds: one warning sound, as on Lichess and chess.com.
  let warned = '';
  $effect(() => {
    if (!mine || game.result || !game.clock) return;
    const l = left(mine);
    if (l !== undefined && l < 10_000 && l > 0 && warned !== game.id) {
      warned = game.id;
      sounds.lowTime();
    }
  });
  // The end: its sound, once (not for a game that was already over when the board opened).
  // svelte-ignore state_referenced_locally
  let ended = game.result ? game.id : '';
  $effect(() => {
    if (!game.result || ended === game.id) return;
    ended = game.id;
    if (!mine) return sounds.end();
    (won === 'win' ? sounds.win : won === 'loss' ? sounds.loss : sounds.draw)();
  });

  // Premoves (owner, 2026-10-22: "we can't do premoves in game zone"): queued while the opponent thinks, the first
  // played the moment their move arrives (as in online games: src/lib/game/premoves.ts).
  const queue = new PremoveQueue();
  let qv = $state(0);
  let cb = $state<ReturnType<typeof ClassBoard>>();
  function onpremove(orig: Key, dest: Key) {
    if (!at.pos || !mine) return;
    const shown = at.pos.clone();
    shown.board = queue.preview(shown.board);
    queue.add(moveFromKeys(shown, orig, dest));
    cb?.cancelPremove();
    qv++;
  }
  function clearPremoves() {
    queue.clear();
    cb?.cancelPremove();
    qv++;
  }
  $effect(() => {
    void game.moves.length;
    if (game.result && queue.length) return clearPremoves();
    if (!myTurn || !queue.length || !at.pos) return;
    const next = queue.takeNext(at.pos);
    qv++;
    if (!next) return cb?.cancelPremove();
    sent = game.moves.length;
    live.gameMove(game.id, makeUci(next));
  });
  /** With premoves queued, the board shows where they lead (the opponent's replies not known yet). */
  const shownFen = $derived.by(() => {
    void qv;
    return queue.length && !myTurn && at.pos ? `${makeBoardFen(queue.preview(at.pos.board))} ${at.pos.turn[0]} - - 0 1` : at.fen;
  });
  const queued = $derived.by(() => {
    void qv;
    return queue.moves.flatMap((m) => [keyOf(m.from), keyOf(m.to)]) as Key[];
  });
  const playing = $derived(!game.result && !!mine && !!at.pos);

  async function onmove(orig: Key, dest: Key) {
    if (!myTurn || !at.pos) return;
    const role = await promotionFor(at.pos, orig, dest);
    if (role === null) return void remount++;
    sent = game.moves.length;
    live.gameMove(game.id, makeUci(moveFromKeys(at.pos, orig, dest, role ?? undefined)));
  }

  /** Time left now (ms): the side to move's clock runs from the last move (each side's first move is free). */
  function left(side: 'white' | 'black'): number | undefined {
    const c = game.clock;
    if (!c) return undefined;
    if (game.result || side !== at.turn || game.moves.length < 2) return c[side];
    return c[side] - (live.now - c.at);
  }
  let flagged = '';
  $effect(() => {
    const t = left(at.turn);
    if (t !== undefined && t <= 0 && !game.result && flagged !== game.id + game.moves.length) {
      flagged = game.id + game.moves.length;
      live.flag(game.id);
    }
  });
  const fmt = (ms: number | undefined) => {
    if (ms === undefined) return '';
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const top = $derived(orient === 'white' ? 'black' : 'white');
  const nameOf = (side: 'white' | 'black') => (side === 'white' ? game.whiteName : game.blackName);
  const tagOf = (side: 'white' | 'black') => tag?.(side === 'white' ? game.white : game.black) ?? '';
  const RESULT = $derived<Record<string, string>>({ '1-0': $t('kidsclass.gb.whiteWon'), '0-1': $t('kidsclass.gb.blackWon'), '1/2-1/2': 'Draw' });
  /** How the game ended (the room says it in English: src/classroom.ts end()), in the player's language. */
  function reasonText(r: string): string {
    if (r === 'Not enough pieces to mate') return $t('kidsclass.gb.noMate');
    if (r === 'Time') return $t('kidsclass.gb.time');
    if (r === 'Draw agreed') return $t('kidsclass.gb.drawAgreed');
    if (r === 'Ended by the coach') return $t('kidsclass.gb.byCoach');
    if (r.endsWith(' resigned')) return $t('kidsclass.gb.resigned', { name: r.slice(0, -' resigned'.length) });
    // A Castle Cup's endings (server/api-worker src/cup.ts).
    const cup: Record<string, string> = {
      'No first move': $t('cups.end.noFirst'),
      'Left the game': $t('cups.end.left'),
      Withdrew: $t('cups.end.withdrew'),
      'Cup called off': $t('cups.end.called'),
      Checkmate: $t('cups.end.mate'),
      Stalemate: $t('cups.end.stalemate'),
      '50-move rule': $t('cups.end.fifty'),
      Repetition: $t('cups.end.repetition'),
    };
    return cup[r] ?? r;
  }
  const won = $derived(game.result && mine ? (game.result === '1/2-1/2' ? 'draw' : (game.result === '1-0') === (mine === 'white') ? 'win' : 'loss') : '');
  let confirm = $state(false);
</script>

<div class="gb">
  <div class="player" class:turn={!game.result && at.turn === top}>
    <span class="nm">{top === 'white' ? '♔' : '♚'} {nameOf(top)}{#if tagOf(top)} <span class="tag">{tagOf(top)}</span>{/if}</span>
    {#if game.clock}<span class="clk num" class:low={(left(top) ?? 1) < 20_000}>{fmt(left(top))}</span>{/if}
  </div>
  {#if evalBar && !mine}<EvalBar fen={shownFen} />{/if}
  <div class="bwrap">
  {#key remount}
    <ClassBoard
      bind:this={cb}
      fen={shownFen}
      orientation={orient}
      lastMove={at.last as Key[] | undefined}
      check={at.check}
      movable={playing ? mine : undefined}
      dests={myTurn && at.pos ? destsOf(at.pos) : new Map()}
      premovable={$premovesOn && playing}
      {queued}
      {coordinates}
      label="Game board"
      {onmove}
      {onpremove}
    />
  {/key}
  {#if game.result}
    <!-- The result in the middle of the board (owner, 2026-10-23: "Black won by resignation… in the centre"). -->
    <div class="over {won}" aria-live="polite">
      <strong>{game.result === '1/2-1/2' ? '🤝 Draw' : RESULT[game.result]}</strong>
      <span>{reasonText(game.reason)}</span>
    </div>
  {/if}
  </div>
  <div class="player" class:turn={!game.result && at.turn === orient}>
    <span class="nm">{orient === 'white' ? '♔' : '♚'} {nameOf(orient)}{mine ? ` ${$t('kidsclass.gb.you')}` : ''}{#if tagOf(orient)} <span class="tag">{tagOf(orient)}</span>{/if}</span>
    {#if game.clock}<span class="clk num" class:low={(left(orient) ?? 1) < 20_000}>{fmt(left(orient))}</span>{/if}
  </div>
  {#if game.result}
    <div class="result {won}">{won === 'win' ? $t('kidsclass.gb.youWon') : won === 'loss' ? $t('kidsclass.gb.youLost') : won === 'draw' ? '🤝 Draw' : RESULT[game.result]} · {reasonText(game.reason)}</div>
  {:else if mine}
    <!-- Two rows of a fixed height, whatever happens (owner, 2026-10-23: "the screen moves up and down for each move"):
         the line saying whose move it is (with the premove button at its end), then the draw and resign buttons. -->
    <div class="acts">
      <div class="st">
        {#if myTurn}<span class="your">{$t('kidsclass.gb.yourMove')}</span>{:else}<span class="muted">{$t('kidsclass.gb.toMove', { name: nameOf(at.turn) })}</span>{/if}
        {#if queued.length}<button class="btn ghost small" onclick={clearPremoves}>{$t('kidsclass.gb.cancelPremoves', { n: queued.length / 2 })}</button>{/if}
      </div>
      <div class="btns">
        {#if game.draw && game.draw !== me}
          <button class="btn primary" onclick={() => live.offerDraw(game.id)}>{$t('kidsclass.gb.acceptDraw')}</button>
        {:else}
          <button class="btn ghost" onclick={() => live.offerDraw(game.id)} disabled={game.draw === me}>{game.draw === me ? $t('kidsclass.gb.drawOffered') : $t('kidsclass.gb.offerDraw')}</button>
        {/if}
        {#if confirm}
          <button class="btn" onclick={() => live.resign(game.id)}>{$t('kidsclass.gb.yesResign')}</button>
          <button class="btn ghost" onclick={() => (confirm = false)}>{$t('kidsclass.gb.no')}</button>
        {:else}
          <button class="btn ghost" onclick={() => (confirm = true)}>🏳 Resign</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .gb {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bwrap {
    position: relative;
  }
  /* Over the board, not in the way: taps go through to the board (to look at the final position). */
  .over {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 58%;
    max-width: 90%;
    padding: 12px 18px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--card) 88%, transparent);
    border: 2px solid var(--border);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    text-align: center;
    pointer-events: none;
    animation: pop-in 0.35s ease-out;
  }
  .over strong {
    font: 800 22px var(--font-title);
  }
  .over span {
    font-size: 14px;
    color: var(--muted);
    font-weight: 700;
  }
  .over.win {
    border-color: var(--win);
  }
  .over.loss {
    border-color: var(--loss);
  }
  @keyframes pop-in {
    from {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .over {
      animation: none;
    }
  }
  .player {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--raised);
    border: 1px solid transparent;
  }
  .player.turn {
    border-color: var(--gold);
  }
  .nm {
    font-weight: 700;
  }
  .tag {
    margin-left: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .clk {
    font: 800 20px var(--font-title);
    background: var(--card);
    padding: 2px 10px;
    border-radius: 8px;
  }
  .clk.low {
    color: var(--loss);
  }
  .result {
    text-align: center;
    padding: 10px;
    border-radius: 12px;
    background: var(--raised);
    font: 700 18px var(--font-title);
  }
  .result.win {
    background: color-mix(in srgb, var(--win) 22%, var(--raised));
  }
  .result.loss {
    background: color-mix(in srgb, var(--loss) 18%, var(--raised));
  }
  .acts {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .st {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 38px;
  }
  .btns {
    display: flex;
    gap: 6px;
    min-height: 44px;
  }
  .btns .btn {
    flex: 1;
    min-width: 0;
    padding-left: 6px;
    padding-right: 6px;
    white-space: nowrap;
  }
  .your,
  .muted {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .your {
    color: var(--win);
    font-weight: 700;
  }
  .muted {
    color: var(--muted);
  }
</style>

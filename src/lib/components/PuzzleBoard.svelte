<script lang="ts">
  /**
   * Solve a puzzle on the board: the opponent's first move (if any) is
   * played, then the solver finds each move; the opponent's replies come by
   * themselves. A different move that checkmates also counts. `tries` wrong
   * moves are allowed before the answer is shown. `onfirst` tells the first
   * result once, for the puzzle rating: solved with no wrong move and no hint,
   * or not (a wrong move or a hint, at once; trying again changes nothing).
   */
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { parseUci } from 'chessops/util';
  import Board from './Board.svelte';
  import { promotionFor } from '$lib/chess/promotion';
  import { destsOf, fenOf, keyOf, moveFromKeys, positionFromFen } from '$lib/chess/position';
  import { playMoveSound, sounds } from '$lib/sound';

  let {
    fen,
    moves,
    opponentFirst = true,
    tries = 1,
    onresult,
    onfirst,
    hintButton = false,
  }: {
    /** The position before the first move. */
    fen: string;
    /** UCI moves: [opponent's move,] solution, reply, solution… */
    moves: string[];
    opponentFirst?: boolean;
    tries?: number;
    onresult?: (solved: boolean, wrongTries: number) => void;
    onfirst?: (clean: boolean) => void;
    /** A Hint button: it shows the piece to move, and the puzzle no longer counts as solved cleanly. */
    hintButton?: boolean;
  } = $props();
  let hinted = $state(false);
  let firstSent = false;
  function first(clean: boolean) {
    if (firstSent) return;
    firstSent = true;
    onfirst?.(clean);
  }
  function useHint() {
    hinted = true;
    first(false);
  }

  // A new puzzle comes as a new component (the page keys it), so the props are read once.
  // svelte-ignore state_referenced_locally
  const line = moves.map((u) => parseUci(u) as NormalMove);
  // svelte-ignore state_referenced_locally
  let pos = $state(positionFromFen(fen));
  // svelte-ignore state_referenced_locally
  let step = $state(opponentFirst ? 0 : 0);
  let last = $state<Key[] | undefined>();
  let status = $state<'wait' | 'yours' | 'wrong' | 'solved' | 'failed'>('wait');
  let wrong = $state(0);
  let v = $state(0);
  // svelte-ignore state_referenced_locally
  const side = opponentFirst ? (positionFromFen(fen).turn === 'white' ? 'black' : 'white') : positionFromFen(fen).turn;

  function play(m: NormalMove) {
    playMoveSound(pos, m);
    pos.play(m);
    last = [keyOf(m.from), keyOf(m.to)];
    step++;
    v++;
  }

  // The opponent's first move, after a moment.
  $effect(() => {
    if (status !== 'wait') return;
    const t = setTimeout(() => {
      if (opponentFirst && line[0]) play(line[0]);
      status = 'yours';
    }, opponentFirst ? 600 : 0);
    return () => clearTimeout(t);
  });

  async function onmove(orig: Key, dest: Key) {
    if (status !== 'yours' && status !== 'wrong') return;
    const want = line[step];
    const promotion = await promotionFor(pos, orig, dest, want);
    if (promotion === null) return board?.resync();
    const m = moveFromKeys(pos, orig, dest, promotion);
    const after = pos.clone();
    after.play(m);
    const same = want && m.from === want.from && m.to === want.to && (m.promotion ?? 'queen') === (want.promotion ?? 'queen');
    if (!same && !after.isCheckmate()) {
      wrong++;
      first(false);
      sounds.error();
      v++;
      if (wrong >= tries) {
        status = 'failed';
        onresult?.(false, wrong);
        reveal();
      } else status = 'wrong';
      return;
    }
    play(m);
    if (after.isCheckmate() || step >= line.length) {
      status = 'solved';
      first(wrong === 0 && !hinted);
      onresult?.(true, wrong);
      return;
    }
    status = 'yours';
    setTimeout(() => line[step] && play(line[step]), 450);
  }

  /** Plays the rest of the solution on the board (not after the board is gone: a page may move on at once). */
  let revealing: ReturnType<typeof setInterval> | undefined;
  function reveal() {
    revealing = setInterval(() => {
      if (step >= line.length) return clearInterval(revealing);
      play(line[step]);
    }, 800);
  }
  $effect(() => () => clearInterval(revealing));

  const view = $derived.by(() => {
    void v;
    const mine = (status === 'yours' || status === 'wrong') && pos.turn === side;
    return { fen: fenOf(pos), dests: mine ? destsOf(pos) : new Map(), check: pos.isCheck(), turn: pos.turn };
  });
  const hint = $derived((status === 'wrong' || (hinted && status === 'yours')) && line[step] && pos.turn === side ? [{ orig: keyOf(line[step].from), brush: 'yellow' }] : []);
  let board: Board | undefined = $state();
</script>

<div class="pb">
  <Board bind:this={board} fen={view.fen} orientation={side} turnColor={view.turn} movable={side} dests={view.dests} lastMove={last} check={view.check} shapes={hint as never} {onmove} label="Puzzle board" />
  <p class="msg" class:ok={status === 'solved'} class:bad={status === 'failed' || status === 'wrong'} role="status">
    {#if status === 'wait'}Get ready…
    {:else if status === 'yours'}{side === 'white' ? 'White' : 'Black'} to move: find the best move.
    {:else if status === 'wrong'}Not that one. Try again (the yellow square is the piece to move).
    {:else if status === 'solved'}Solved!
    {:else}Here is the answer.{/if}
  </p>
  {#if hintButton && (status === 'yours' || status === 'wrong') && !hinted}
    <button class="btn hint" onclick={useHint} title="Shows the piece to move. The puzzle then counts as missed for your rating.">Hint (counts as missed)</button>
  {/if}
</div>

<style>
  .pb {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .msg {
    margin: 0;
    font-weight: 600;
  }
  .msg.ok {
    color: var(--win);
  }
  .msg.bad {
    color: var(--loss);
  }
  .hint {
    align-self: flex-start;
  }
</style>

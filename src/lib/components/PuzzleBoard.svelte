<script lang="ts">
  /**
   * Solve a puzzle on the board: the opponent's first move (if any) is
   * played, then the solver finds each move; the opponent's replies come by
   * themselves. A different move that checkmates also counts. `tries` wrong
   * moves are allowed before the answer is shown.
   */
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { parseUci } from 'chessops/util';
  import Board from './Board.svelte';
  import { destsOf, fenOf, keyOf, moveFromKeys, positionFromFen } from '$lib/chess/position';
  import { playMoveSound, sounds } from '$lib/sound';

  let {
    fen,
    moves,
    opponentFirst = true,
    tries = 1,
    onresult,
  }: {
    /** The position before the first move. */
    fen: string;
    /** UCI moves: [opponent's move,] solution, reply, solution… */
    moves: string[];
    opponentFirst?: boolean;
    tries?: number;
    onresult?: (solved: boolean, wrongTries: number) => void;
  } = $props();

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

  function onmove(orig: Key, dest: Key) {
    if (status !== 'yours' && status !== 'wrong') return;
    const m = moveFromKeys(pos, orig, dest);
    const want = line[step];
    const after = pos.clone();
    after.play(m);
    const same = want && m.from === want.from && m.to === want.to && (m.promotion ?? 'queen') === (want.promotion ?? 'queen');
    if (!same && !after.isCheckmate()) {
      wrong++;
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
      onresult?.(true, wrong);
      return;
    }
    status = 'yours';
    setTimeout(() => line[step] && play(line[step]), 450);
  }

  /** Plays the rest of the solution on the board. */
  function reveal() {
    const timer = setInterval(() => {
      if (step >= line.length) return clearInterval(timer);
      play(line[step]);
    }, 800);
  }

  const view = $derived.by(() => {
    void v;
    const mine = (status === 'yours' || status === 'wrong') && pos.turn === side;
    return { fen: fenOf(pos), dests: mine ? destsOf(pos) : new Map(), check: pos.isCheck(), turn: pos.turn };
  });
  const hint = $derived(status === 'wrong' && line[step] ? [{ orig: keyOf(line[step].from), brush: 'yellow' }] : []);
</script>

<div class="pb">
  <Board fen={view.fen} orientation={side} turnColor={view.turn} movable={side} dests={view.dests} lastMove={last} check={view.check} shapes={hint as never} {onmove} label="Puzzle board" />
  <p class="msg" class:ok={status === 'solved'} class:bad={status === 'failed' || status === 'wrong'} role="status">
    {#if status === 'wait'}Get ready…
    {:else if status === 'yours'}{side === 'white' ? 'White' : 'Black'} to move: find the best move.
    {:else if status === 'wrong'}Not that one. Try again (the yellow square is the piece to move).
    {:else if status === 'solved'}Solved!
    {:else}Here is the answer.{/if}
  </p>
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
</style>

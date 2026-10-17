<script lang="ts">
  import { onMount } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { destsOf, fenOf, keyOf, moveFromKeys, moveToUci, uciToMove } from '$lib/chess/position';
  import { dailyPuzzle, type DailyPuzzle } from '$lib/lichess';
  import { POINTS, study } from '$lib/study/progress';

  let puzzle = $state<DailyPuzzle | undefined>();
  let error = $state('');
  let pos = $state<Chess | undefined>();
  let step = $state(0);
  let last = $state<Key[] | undefined>();
  let status = $state<'yours' | 'wrong' | 'right' | 'solved'>('yours');
  let v = $state(0);
  let hinted = $state(false);

  onMount(async () => {
    try {
      puzzle = await dailyPuzzle();
      reset();
    } catch (e) {
      error = e instanceof Error ? e.message : 'The puzzle could not load.';
    }
  });

  function reset() {
    if (!puzzle) return;
    pos = puzzle.start.clone();
    step = 0;
    last = puzzle.lastMove?.map(keyOf);
    status = 'yours';
    hinted = false;
  }

  function apply(m: NormalMove) {
    pos!.play(m);
    last = [keyOf(m.from), keyOf(m.to)];
    step++;
    v++;
  }

  function onmove(orig: Key, dest: Key) {
    if (!puzzle || !pos || status === 'solved') return;
    const m = moveFromKeys(pos, orig, dest);
    const want = puzzle.solution[step];
    const after = pos.clone();
    after.play(m);
    const lastStep = step === puzzle.solution.length - 1;
    if (moveToUci(m) === want || (lastStep && after.isCheckmate())) {
      apply(m);
      if (step >= puzzle.solution.length) {
        status = 'solved';
        study.log('puzzle', hinted ? POINTS.puzzleWithHint : POINTS.puzzleSolved, `Puzzle ${puzzle.id}`);
        return;
      }
      status = 'right';
      // The opponent answers.
      setTimeout(() => {
        const reply = uciToMove(puzzle!.solution[step]);
        if (reply) apply(reply);
        status = 'yours';
      }, 450);
    } else {
      status = 'wrong';
      v++; // the board snaps back
    }
  }

  function showMove() {
    if (!puzzle || !pos || status === 'solved') return;
    hinted = true;
    const m = uciToMove(puzzle.solution[step]);
    if (m) onmove(keyOf(m.from), keyOf(m.to));
  }

  const view = $derived.by(() => {
    void v;
    if (!pos || !puzzle) return undefined;
    const solverTurn = pos.turn === puzzle.start.turn && status !== 'solved';
    return {
      fen: fenOf(pos),
      turn: pos.turn,
      dests: solverTurn ? destsOf(pos) : new Map(),
      check: pos.isCheck(),
    };
  });

  const solver = $derived(puzzle?.start.turn ?? 'white');
</script>

<svelte:head><title>Puzzle of the day · Chess Castles</title></svelte:head>

<div class="puzzles">
  <section class="board-col" aria-label="Puzzle board">
    {#if view}
      <Board
        fen={view.fen}
        orientation={solver}
        turnColor={view.turn}
        movable={status === 'solved' ? undefined : solver}
        dests={view.dests}
        lastMove={last}
        check={view.check}
        label="Puzzle board"
        {onmove}
      />
    {:else}
      <div class="placeholder">{error || 'Loading today’s puzzle…'}</div>
    {/if}
  </section>

  <aside class="side">
    <div class="card more-puzzles">
      <a class="btn" href="/puzzles/themes"><Icon name="puzzle" size={16} />Puzzles by theme</a>
      <a class="btn" href="/insights/mistakes"><Icon name="history" size={16} />Your own mistakes</a>
      <a class="btn" href="/vision/blind"><Icon name="eye" size={16} />Blindfold puzzles</a>
    </div>
    <div class="card">
      <span class="label">Puzzle of the day · from Lichess</span>
      <h1 class="display h">
        {#if status === 'solved'}Solved!{:else if status === 'wrong'}Not that one{:else}{solver === 'white' ? 'White' : 'Black'} to play{/if}
      </h1>
      <p class="msg" class:ok={status === 'solved' || status === 'right'} class:bad={status === 'wrong'}>
        {#if status === 'solved'}
          {hinted ? 'Done, with a little help. Try again tomorrow without hints.' : 'Every move found. Brilliant.'}
        {:else if status === 'wrong'}
          That move doesn't work here. Look for something more forcing.
        {:else if status === 'right'}
          Good move. Keep going…
        {:else}
          Find the best move{puzzle && puzzle.solution.length > 1 ? ', then keep finding them' : ''}.
        {/if}
      </p>
      {#if puzzle}
        <div class="meta">
          <span class="pill gold">Rating {puzzle.rating}</span>
          {#each puzzle.themes.slice(0, 3) as t (t)}
            <span class="pill theme">{t.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
          {/each}
        </div>
        <div class="actions">
          {#if status !== 'solved'}
            <button class="btn" onclick={showMove}><Icon name="learn" size={18} />Show the move</button>
          {/if}
          <button class="btn" onclick={reset}><Icon name="replay" size={18} />Start again</button>
        </div>
        <p class="label progress">Move {Math.min(Math.ceil((step + 1) / 2), Math.ceil(puzzle.solution.length / 2))} of {Math.ceil(puzzle.solution.length / 2)}</p>
      {/if}
    </div>
  </aside>
</div>

<style>
  .more-puzzles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .puzzles {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    max-width: 1240px;
    margin: 0 auto;
    justify-content: center;
    align-items: flex-start;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 140px), 760px);
    min-width: min(100%, 300px);
  }
  .placeholder {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--muted);
  }
  .side {
    flex: 1 1 320px;
    max-width: 420px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .h {
    font-size: 40px;
  }
  .msg {
    margin: 0;
    font-size: 16px;
    color: var(--text-2);
  }
  .msg.ok {
    color: var(--win);
  }
  .msg.bad {
    color: var(--loss);
  }
  .meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .theme {
    background: var(--raised);
    color: var(--text-2);
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .progress {
    margin: 0;
  }
</style>

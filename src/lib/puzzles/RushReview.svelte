<script lang="ts" module>
  export interface RushPuzzle {
    id: string;
    /** The position before the opponent's first move, and the line (UCI): opponent, answer, reply, answer… */
    fen: string;
    moves: string[];
    r: number;
    ok: boolean;
    /** The wrong move: where in the line, and what was played. */
    miss?: { ply: number; uci: string };
  }
</script>

<script lang="ts">
  /**
   * One Puzzle Rush puzzle again, after the rush (owner, 2026-10-22: "click on the puzzle and see why his move was
   * wrong"): where it went wrong, the player's move in red and the answer in green, the whole solution to step
   * through, and the puzzle to try again or to open on the analysis board. ‹ › go through the rush's puzzles.
   */
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { makeFen } from 'chessops/fen';
  import { makeSan } from 'chessops/san';
  import { parseUci } from 'chessops/util';
  import Board from '$lib/components/Board.svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import { keyOf, positionFromFen } from '$lib/chess/position';

  let { list, at = $bindable(), onclose }: { list: RushPuzzle[]; at: number; onclose: () => void } = $props();

  const p = $derived(list[at]);
  const line = $derived(p.moves.map((u) => parseUci(u) as NormalMove));
  /** The position after each number of moves of the line (0: before the opponent's first move). */
  const positions = $derived.by(() => {
    const pos = positionFromFen(p.fen);
    const out = [pos.clone()];
    for (const m of line) {
      if (!pos.isLegal(m)) break;
      pos.play(m);
      out.push(pos.clone());
    }
    return out;
  });
  const sans = $derived(line.slice(0, positions.length - 1).map((m, i) => makeSan(positions[i], m)));
  const side = $derived(positions[0].turn === 'white' ? 'black' : 'white');
  /** The player's moves are the odd ones (after the opponent's first). */
  const mine = (i: number) => i % 2 === 1;

  let ply = $state(1);
  let trying = $state(false);
  let tryKey = $state(0);
  // A new puzzle: open where it went wrong (or after the opponent's first move).
  $effect(() => {
    void at;
    ply = p.miss ? Math.min(p.miss.ply, positions.length - 1) : 1;
    trying = false;
  });

  const missMove = $derived(p.miss ? (parseUci(p.miss.uci) as NormalMove | undefined) : undefined);
  const missSan = $derived.by(() => {
    if (!p.miss || !missMove) return '';
    const before = positions[p.miss.ply];
    return before && before.isLegal(missMove) ? makeSan(before, missMove) : p.miss.uci;
  });
  const atMiss = $derived(!!p.miss && ply === p.miss.ply);
  const shapes = $derived.by(() => {
    if (!atMiss || !missMove || !line[ply]) return [];
    // The square the player moved to ringed too: the answer's arrow can cover theirs (the same piece, the same way).
    return [
      { orig: keyOf(missMove.from), dest: keyOf(missMove.to), brush: 'red' },
      { orig: keyOf(missMove.to), brush: 'red' },
      { orig: keyOf(line[ply].from), dest: keyOf(line[ply].to), brush: 'green' },
    ];
  });
  const pos = $derived(positions[Math.min(ply, positions.length - 1)]);
  const last = $derived(ply > 0 && line[ply - 1] ? ([keyOf(line[ply - 1].from), keyOf(line[ply - 1].to)] as Key[]) : undefined);
  const go = (n: number) => (ply = Math.max(1, Math.min(positions.length - 1, n)));
  const analyse = $derived(`/analysis?fen=${encodeURIComponent(makeFen(pos.toSetup()))}`);

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    else if (trying) return;
    else if (e.key === 'ArrowLeft') go(ply - 1);
    else if (e.key === 'ArrowRight') go(ply + 1);
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Puzzle {p.r}">
  <header class="dh">
    <button class="btn ghost nav" onclick={() => (at = at - 1)} disabled={at <= 0} aria-label="Previous puzzle">‹</button>
    <span class="what">
      <b>Puzzle {at + 1} of {list.length}</b>
      <span class="pill" class:ok={p.ok} class:bad={!p.ok}>{p.ok ? '✓ Solved' : '✕ Missed'} · {p.r}</span>
    </span>
    <button class="btn ghost nav" onclick={() => (at = at + 1)} disabled={at >= list.length - 1} aria-label="Next puzzle">›</button>
    <button class="btn ghost" onclick={onclose} aria-label="Close">✕</button>
  </header>

  {#if trying}
    {#key tryKey}
      <PuzzleBoard fen={p.fen} moves={p.moves} tries={99} hintButton />
    {/key}
    <div class="row">
      <button class="btn" onclick={() => tryKey++}>Start again</button>
      <button class="btn ghost" onclick={() => (trying = false)}>Back to the answer</button>
    </div>
  {:else}
    {#if p.miss}
      <p class="say">You played <b class="bad">{missSan}</b>. The answer was <b class="good">{sans[p.miss.ply] ?? '?'}</b>.</p>
    {:else}
      <p class="say">You solved it. The whole line:</p>
    {/if}
    <div class="board">
      <Board fen={makeFen(pos.toSetup())} orientation={side} lastMove={last} check={pos.isCheck()} {shapes} viewOnly label="Puzzle {p.r}" />
    </div>
    <div class="tools">
      <button class="btn ghost" onclick={() => go(1)} disabled={ply <= 1} aria-label="Start">⏮</button>
      <button class="btn ghost" onclick={() => go(ply - 1)} disabled={ply <= 1} aria-label="Back">◀</button>
      <button class="btn ghost" onclick={() => go(ply + 1)} disabled={ply >= positions.length - 1} aria-label="Forward">▶</button>
      <button class="btn ghost" onclick={() => go(positions.length - 1)} disabled={ply >= positions.length - 1} aria-label="End">⏭</button>
    </div>
    <ol class="line" aria-label="The solution">
      {#each sans as s, i (i)}
        {#if i > 0}
          <li>
            <button class:mine={mine(i)} class:on={ply === i + 1} class:wrongat={p.miss?.ply === i} onclick={() => go(i + 1)}>{s}</button>
          </li>
        {/if}
      {/each}
    </ol>
    {#if atMiss}<p class="key"><span class="sw red"></span>Your move <span class="sw green"></span>The answer</p>{/if}
    <div class="row">
      <button class="btn primary" onclick={() => (trying = true)}>Try it again</button>
      <a class="btn" href={analyse}>Analyse</a>
    </div>
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(5, 10, 20, 0.6);
  }
  .dialog {
    position: fixed;
    z-index: 81;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, calc(100vw - 16px));
    max-height: calc(100dvh - 16px);
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-panel);
    padding: 12px 14px 14px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dh {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .what {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .nav {
    font-size: 22px;
    padding: 2px 12px;
  }
  .pill.ok {
    color: var(--win);
  }
  .pill.bad {
    color: var(--loss);
  }
  .say {
    margin: 0;
    text-align: center;
    font-size: 15px;
  }
  .good {
    color: var(--win);
  }
  .bad {
    color: var(--loss);
  }
  .board {
    width: 100%;
    max-width: min(460px, calc(100dvh - 300px));
    align-self: center;
  }
  .tools,
  .row {
    display: flex;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .line {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  }
  .line button {
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text-2);
    border-radius: 8px;
    padding: 3px 8px;
    font: 600 14px var(--font-body);
    cursor: pointer;
  }
  .line button.mine {
    color: var(--text);
    font-weight: 800;
  }
  .line button.wrongat {
    border-color: var(--loss);
  }
  .line button.on {
    background: var(--gold);
    color: #1b1300;
    border-color: var(--gold);
  }
  .key {
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }
  .sw {
    display: inline-block;
    width: 18px;
    height: 4px;
    border-radius: 2px;
  }
  .sw.red {
    background: #e04040;
  }
  .sw.green {
    background: #15781b;
    margin-left: 8px;
  }
</style>

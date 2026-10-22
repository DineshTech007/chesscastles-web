<script lang="ts">
  /**
   * Stockfish on this device for the board's position (no cost per use): the evaluation and the three best lines
   * (owner, 2026-10-22: "show top 3 engine moves"). `info` (the best line) and `lines` are bindable, so the page can
   * draw the bar beside the board and the three arrows from the same run; `onplay`: a line tapped plays its first move.
   */
  import { engine, evalLabel, type EngineInfo } from '$lib/engine/stockfish';
  import { positionFromFen } from '$lib/chess/position';
  import { sanLine } from './tasks';

  let {
    fen,
    info = $bindable(),
    lines = $bindable([]),
    onplay,
  }: { fen: string; info?: EngineInfo; lines?: EngineInfo[]; onplay?: (uci: string) => void } = $props();

  $effect(() => {
    const f = fen;
    info = undefined;
    lines = [];
    try {
      if (positionFromFen(f).isEnd()) return;
    } catch {
      return;
    }
    const t = setTimeout(
      () =>
        void engine.analyse(
          f,
          (i) => {
            if (i.fen === f) info = i;
          },
          22,
          undefined,
          3,
          (l) => {
            if (l[0]?.fen === f) lines = l;
          },
        ),
      150,
    );
    return () => {
      clearTimeout(t);
      engine.stopAnalysis();
    };
  });
  const shown = $derived(lines.length ? lines : info ? [info] : []);
</script>

<div class="lines">
  {#each shown as l, i (i)}
    {#if onplay}
      <button class="row" onclick={() => l.pv[0] && onplay(l.pv[0])} title="Play this move on the board">
        <span class="n">{i + 1}</span><b class="ev num">{evalLabel(l)}</b><span class="line">{sanLine(fen, l.pv.slice(0, 8))}</span>
      </button>
    {:else}
      <div class="row"><span class="n">{i + 1}</span><b class="ev num">{evalLabel(l)}</b><span class="line">{sanLine(fen, l.pv.slice(0, 8))}</span></div>
    {/if}
  {:else}
    <p class="muted">Thinking…</p>
  {/each}
  {#if info}<small class="muted depth">depth {info.depth}</small>{/if}
</div>

<style>
  .lines {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 3px 6px;
    border-radius: 8px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    width: 100%;
  }
  button.row {
    cursor: pointer;
  }
  button.row:hover {
    background: var(--raised);
  }
  .n {
    flex: none;
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--raised);
    font: 800 11px var(--font-body);
    color: var(--muted);
  }
  .row:first-child .n {
    background: #3b82f6;
    color: #fff;
  }
  .ev {
    flex: none;
    min-width: 46px;
    font: 800 16px var(--font-title);
    color: var(--engine);
  }
  .line {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    color: var(--muted);
    margin: 0;
  }
  .depth {
    align-self: flex-end;
  }
</style>

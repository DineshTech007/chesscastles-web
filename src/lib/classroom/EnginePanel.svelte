<script lang="ts">
  /**
   * Stockfish on this device for the board's position (no cost per use): the evaluation and the best line. `info` is
   * bindable, so the page can draw the bar beside the board from the same run.
   */
  import { engine, evalLabel, type EngineInfo } from '$lib/engine/stockfish';
  import { positionFromFen } from '$lib/chess/position';
  import { sanLine } from './tasks';

  let { fen, info = $bindable() }: { fen: string; info?: EngineInfo } = $props();

  $effect(() => {
    const f = fen;
    info = undefined;
    try {
      if (positionFromFen(f).isEnd()) return;
    } catch {
      return;
    }
    const t = setTimeout(() => void engine.analyse(f, (i) => (info = i), 22), 150);
    return () => {
      clearTimeout(t);
      engine.stopAnalysis();
    };
  });
</script>

<div class="row">
  <b class="ev num">{info ? evalLabel(info) : '…'}</b>
  <span class="line">{info ? sanLine(fen, info.pv.slice(0, 8)) : 'Thinking…'}</span>
  {#if info}<small class="muted">depth {info.depth}</small>{/if}
</div>

<style>
  .row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .ev {
    font: 800 18px var(--font-title);
    color: var(--engine);
  }
  .line {
    flex: 1;
    min-width: 0;
  }
  .muted {
    color: var(--muted);
  }
</style>

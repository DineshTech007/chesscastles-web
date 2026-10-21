<script lang="ts">
  /** Stockfish on this device for the board's position: the evaluation and the best line (no cost per use). */
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
  import { positionFromFen } from '$lib/chess/position';
  import { sanLine } from './tasks';

  let { fen }: { fen: string } = $props();
  let info = $state<EngineInfo | undefined>();

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
  const white = $derived(info ? whiteChances(info) : 0.5);
</script>

<div class="eng">
  <div class="bar" aria-hidden="true"><span style="width: {white * 100}%"></span></div>
  <div class="row">
    <b class="ev num">{info ? evalLabel(info) : '…'}</b>
    <span class="line">{info ? sanLine(fen, info.pv.slice(0, 8)) : 'Thinking…'}</span>
    {#if info}<small class="muted">depth {info.depth}</small>{/if}
  </div>
</div>

<style>
  .eng {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bar {
    height: 10px;
    border-radius: 6px;
    background: #222;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: #f4f1ea;
    transition: width 0.3s;
  }
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

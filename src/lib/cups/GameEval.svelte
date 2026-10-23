<script lang="ts">
  /**
   * A little engine bar between the two players of a game being watched (owner, 2026-10-23: "during the game, between
   * the two players, a little horizontal engine bar"): white's share of the chances, and the number. Stockfish in this
   * browser, looking at the position a moment after it changes. The cup page never shows it for a game the viewer is
   * playing: an engine must not help anyone in their own game.
   */
  import { onDestroy } from 'svelte';
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';

  let { fen, depth = 12 }: { fen: string; depth?: number } = $props();
  let info = $state<EngineInfo | undefined>();
  let share = $state(0.5);
  let text = $state('');

  $effect(() => {
    const f = fen;
    const timer = setTimeout(() => {
      void engine.analyse(
        f,
        (i) => {
          if (i.fen === f) info = i;
        },
        depth,
      );
    }, 400);
    return () => clearTimeout(timer);
  });
  $effect(() => {
    if (!info) return;
    share = whiteChances(info);
    text = evalLabel(info);
  });
  onDestroy(() => engine.stopAnalysis());
</script>

<div class="eb" role="img" aria-label="Engine: {text || 'thinking'}">
  <span class="w" style="width: {share * 100}%"></span>
  <span class="t num" class:right={share < 0.5}>{text}</span>
</div>

<style>
  .eb {
    position: relative;
    height: 16px;
    border-radius: 6px;
    overflow: hidden;
    background: #2a2f3c;
  }
  .w {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: #f2f5fb;
    transition: width 0.4s ease;
  }
  .t {
    position: absolute;
    left: 6px;
    top: 0;
    line-height: 16px;
    font-size: 11px;
    font-weight: 800;
    color: #1b1f2a;
  }
  .t.right {
    left: auto;
    right: 6px;
    color: #f2f5fb;
  }
</style>

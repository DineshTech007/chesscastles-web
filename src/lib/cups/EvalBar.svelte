<script lang="ts">
  /**
   * A horizontal engine bar for a game being watched (owner, 2026-10-23): white's share of the chances and the number.
   * The same bar goes between the players of the big board, in the pairings and on every small board. It keeps its last
   * value while the next position is looked at, so it moves instead of blinking. Never for a game the viewer is playing:
   * the callers leave it out there (an engine must not help anyone in their own game).
   */
  import { evalOf, evalTick, wantEval } from './evals';

  let { fen, thin = false }: { fen: string; thin?: boolean } = $props();
  let share = $state(0.5);
  let text = $state('');
  let ready = $state(false);

  $effect(() => {
    const f = fen;
    void $evalTick;
    const hit = evalOf(f);
    if (hit) {
      share = hit.share;
      text = hit.text;
      ready = true;
      return;
    }
    // A moment after the position changes (a move every second or two is not worth a look each).
    const timer = setTimeout(() => wantEval(f), 500);
    return () => clearTimeout(timer);
  });
</script>

<div class="eb" class:thin class:wait={!ready} role="img" aria-label="Engine: {text || 'looking'}">
  <span class="w" style="width: {share * 100}%"></span>
  {#if !thin}<span class="t num" class:right={share < 0.5}>{text}</span>{/if}
</div>

<style>
  .eb {
    position: relative;
    height: 14px;
    border-radius: 6px;
    overflow: hidden;
    background: #2a2f3c;
  }
  .eb.thin {
    height: 7px;
    border-radius: 4px;
  }
  .eb.wait {
    opacity: 0.55;
  }
  .w {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: #f2f5fb;
    transition: width 0.5s ease;
  }
  .t {
    position: absolute;
    left: 6px;
    top: 0;
    line-height: 14px;
    font-size: 10.5px;
    font-weight: 800;
    color: #1b1f2a;
  }
  .t.right {
    left: auto;
    right: 6px;
    color: #f2f5fb;
  }
</style>

<script lang="ts">
  /**
   * Big move-navigation buttons under a move list: first, back, Play, next, last (easy-to-hit buttons), with an
   * optional flip button. Play runs through the moves by itself, one a second (from the start when at the end);
   * any other button, or the last move, stops it.
   */
  import { onDestroy } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    ply,
    max,
    go,
    onflip,
  }: {
    /** The move shown (0: the start). */
    ply: number;
    /** The last move there is. */
    max: number;
    go: (ply: number) => void;
    onflip?: () => void;
  } = $props();

  let playing = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  function stop() {
    clearInterval(timer);
    timer = undefined;
    playing = false;
  }
  function play() {
    if (playing) return stop();
    if (ply >= max) go(0);
    playing = true;
    timer = setInterval(() => {
      if (ply >= max) return stop();
      go(ply + 1);
    }, 1000);
  }
  // The game ended up at its last move (or the moves changed): playing stops.
  $effect(() => {
    if (playing && ply >= max) stop();
  });
  onDestroy(stop);
  const step = (to: number) => {
    stop();
    go(to);
  };
</script>

<div class="nav" role="group" aria-label="Move navigation">
  <button class="nb" onclick={() => step(0)} disabled={ply <= 0} aria-label="First move" title="First move (Home)"><Icon name="first" size={24} /></button>
  <button class="nb" onclick={() => step(ply - 1)} disabled={ply <= 0} aria-label="Previous move" title="Previous move (←)"><Icon name="back" size={24} /></button>
  <button class="nb play" class:on={playing} onclick={play} disabled={max <= 0} aria-pressed={playing} aria-label={playing ? 'Pause' : 'Play the moves'} title={playing ? 'Pause' : 'Play the moves one by one'}><Icon name={playing ? 'pause' : 'play'} size={22} fill color="currentColor" /></button>
  <button class="nb" onclick={() => step(ply + 1)} disabled={ply >= max} aria-label="Next move" title="Next move (→)"><Icon name="chevron" size={24} /></button>
  <button class="nb" onclick={() => step(max)} disabled={ply >= max} aria-label="Last move" title="Last move (End)"><Icon name="last" size={24} /></button>
  {#if onflip}<button class="nb flip" onclick={onflip} aria-label="Flip board" title="Flip board (F)"><Icon name="flip" size={22} /></button>{/if}
</div>

<style>
  .nav {
    display: flex;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--border);
  }
  .nb {
    flex: 1 1 0;
    min-width: 0;
    height: 50px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--text) 18%, var(--border));
    background: color-mix(in srgb, var(--text) 10%, var(--raised));
    color: var(--text);
    cursor: pointer;
    transition: background 0.12s;
  }
  .nb:hover:not(:disabled) {
    background: color-mix(in srgb, var(--brand) 35%, var(--raised));
    border-color: var(--brand);
  }
  .nb:active:not(:disabled) {
    transform: translateY(1px);
  }
  .nb:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .nb.flip {
    flex: 0 0 54px;
  }
  .nb.play {
    color: var(--gold);
  }
  .nb.play.on {
    background: var(--gold);
    border-color: var(--gold);
    color: #1b1300;
  }
</style>

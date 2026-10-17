<script lang="ts">
  /**
   * Big move-navigation buttons under a move list: first, back, next, last
   * (four equal, easy-to-hit buttons), with an optional flip button.
   */
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
</script>

<div class="nav" role="group" aria-label="Move navigation">
  <button class="nb" onclick={() => go(0)} disabled={ply <= 0} aria-label="First move" title="First move (Home)"><Icon name="first" size={24} /></button>
  <button class="nb" onclick={() => go(ply - 1)} disabled={ply <= 0} aria-label="Previous move" title="Previous move (←)"><Icon name="back" size={24} /></button>
  <button class="nb" onclick={() => go(ply + 1)} disabled={ply >= max} aria-label="Next move" title="Next move (→)"><Icon name="chevron" size={24} /></button>
  <button class="nb" onclick={() => go(max)} disabled={ply >= max} aria-label="Last move" title="Last move (End)"><Icon name="last" size={24} /></button>
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
</style>

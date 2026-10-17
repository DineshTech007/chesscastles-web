<script lang="ts">
  import type { MoveSource } from '$lib/bot/fideBot';
  import type { MoveClass } from '$lib/review/badges';
  import MoveBadge from '$lib/review/MoveBadge.svelte';
  import { revealIn } from '$lib/scroll';

  let {
    sans,
    sources = [],
    current,
    onselect,
    badges = [],
  }: {
    sans: string[];
    /** Per ply, where a bot move came from (undefined for the player's). */
    sources?: (MoveSource | undefined)[];
    /** The ply shown on the board (sans.length = the latest). */
    current?: number;
    onselect?: (ply: number) => void;
    /** Per ply, the review badge (brilliant … blunder), once the game is reviewed. */
    badges?: (MoveClass | undefined)[];
  } = $props();

  let box: HTMLDivElement;
  const rows = $derived(
    Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => ({ no: i + 1, w: 2 * i, b: 2 * i + 1 })),
  );
  const at = $derived(current ?? sans.length);
  const DOT: Record<MoveSource, string> = { book: 'var(--win)', opening: 'var(--accent)', engine: 'var(--engine)' };

  $effect(() => {
    void sans.length;
    void at;
    queueMicrotask(() => revealIn(box, box?.querySelector('.cur')));
  });
</script>

<div class="moves" bind:this={box} role="list" aria-label="Moves">
  {#if !sans.length}
    <p class="empty label">No moves yet</p>
  {/if}
  {#each rows as r (r.no)}
    <div class="row" role="listitem">
      <span class="no num">{r.no}.</span>
      {#each [r.w, r.b] as ply (ply)}
        {#if ply < sans.length}
          <button class="mv" class:cur={ply + 1 === at} onclick={() => onselect?.(ply + 1)} disabled={!onselect}>
            {#if sources[ply]}<span class="src" style="background: {DOT[sources[ply]!]}" title="From {sources[ply]}"></span>{/if}
            {sans[ply]}
            {#if badges[ply] && badges[ply] !== 'good'}<MoveBadge kind={badges[ply]!} size={24} />{/if}
          </button>
        {:else}
          <span class="mv"></span>
        {/if}
      {/each}
    </div>
  {/each}
</div>

<style>
  .moves {
    overflow-y: auto;
    padding: 6px 0;
    font-size: 15px;
  }
  .empty {
    padding: 8px 14px;
    margin: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 40px 1fr 1fr;
    align-items: center;
    padding: 1px 10px;
  }
  .row:nth-child(even) {
    background: color-mix(in srgb, var(--text) 3%, transparent);
  }
  .no {
    color: var(--muted);
  }
  .mv {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .mv :global(.badge) {
    margin-left: auto;
  }
  .mv:disabled {
    cursor: default;
  }
  .mv:not(:disabled):hover {
    background: var(--raised);
  }
  .mv.cur {
    background: color-mix(in srgb, var(--brand) 30%, transparent);
  }
  .src {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
</style>

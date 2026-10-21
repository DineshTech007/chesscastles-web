<script lang="ts">
  /**
   * The piece for a promotion. On the promotion square itself when the board is known (owner, 2026-10-21: as on
   * Lichess and chess.com): the queen on the square and the other pieces in a column running into the board.
   * Otherwise in the middle of the screen. Reuses the board's own piece art (chessground.cburnett.css is already
   * loaded by Board.svelte), so the pieces look exactly like the board's.
   */
  import type { Color, Role } from 'chessops/types';
  import type { PromotionAnchor } from '$lib/chess/promotion';

  let { color, anchor, oncancel, onpick }: { color: Color; anchor?: PromotionAnchor; oncancel: () => void; onpick: (role: Role) => void } = $props();
  const ROLES: Role[] = ['queen', 'knight', 'rook', 'bishop'];
  // The queen always on the promotion square: first going down the board, last going up it.
  const order = $derived(anchor && !anchor.down ? [...ROLES].reverse() : ROLES);
  // The column, kept on the screen when the board is partly scrolled away.
  const top = $derived.by(() => {
    if (!anchor) return 0;
    const t = anchor.down ? anchor.top : anchor.top - 3 * anchor.size;
    const max = typeof innerHeight === 'number' ? innerHeight - 4 * anchor.size - 4 : t;
    return Math.max(4, Math.min(t, max));
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && oncancel()} />

<div class="scrim" class:light={!!anchor} role="presentation" onclick={oncancel}></div>
{#if anchor}
  <div class="picker column" role="dialog" aria-modal="true" aria-label="Choose a piece" style="left: {anchor.left}px; top: {top}px; width: {anchor.size}px">
    {#each order as r (r)}
      <button class="sq" onclick={() => onpick(r)} aria-label={r} style="width: {anchor.size}px; height: {anchor.size}px">
        <span class="crop" style="width: {anchor.size}px; height: {anchor.size}px"><span class="cg-wrap" style="width: {anchor.size * 8}px; height: {anchor.size * 8}px"><piece class="{r} {color}"></piece></span></span>
      </button>
    {/each}
  </div>
{:else}
  <div class="picker card" role="dialog" aria-modal="true" aria-label="Choose a piece">
    {#each ROLES as r (r)}
      <button class="opt" onclick={() => onpick(r)} aria-label={r}>
        <span class="crop"><span class="cg-wrap"><piece class="{r} {color}"></piece></span></span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 95;
    background: rgba(5, 10, 20, 0.45);
  }
  .scrim.light {
    background: rgba(5, 10, 20, 0.28);
  }
  .picker.card {
    position: fixed;
    z-index: 96;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 8px;
    padding: 12px;
  }
  .opt {
    border: 1px solid var(--border);
    background: var(--raised);
    border-radius: 10px;
    padding: 4px;
    cursor: pointer;
  }
  .opt:hover {
    border-color: var(--accent);
  }
  .opt .crop {
    display: block;
    width: 52px;
    height: 52px;
    overflow: hidden;
    border-radius: 6px;
  }
  .opt .cg-wrap {
    position: relative;
    width: 416px;
    height: 416px;
  }
  /* On the square: light discs over the board, as on Lichess; the one under the finger glows gold. */
  .picker.column {
    position: fixed;
    z-index: 96;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
    animation: open 0.12s ease-out;
  }
  @keyframes open {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
  }
  .sq {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: radial-gradient(circle, #f4f1ea 35%, #a9a196 100%);
    cursor: pointer;
  }
  .sq:hover,
  .sq:focus-visible {
    background: radial-gradient(circle, #fff3c4 35%, #edb040 100%);
    outline: none;
  }
  .sq .crop {
    display: block;
    overflow: hidden;
  }
  .sq .cg-wrap {
    position: relative;
    display: block;
  }
  @media (prefers-reduced-motion: reduce) {
    .picker.column {
      animation: none;
    }
  }
</style>

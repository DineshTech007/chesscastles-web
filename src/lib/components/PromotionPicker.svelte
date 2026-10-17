<script lang="ts">
  /**
   * The underpromotion choice: shown only when "auto-queen" is turned off in
   * Settings. Reuses the board's own piece art (chessground.cburnett.css is
   * already loaded by Board.svelte), so the pieces look exactly like the board.
   */
  import type { Color, Role } from 'chessops/types';

  let { color, oncancel, onpick }: { color: Color; oncancel: () => void; onpick: (role: Role) => void } = $props();
  const ROLES: Role[] = ['queen', 'knight', 'rook', 'bishop'];
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && oncancel()} />

<div class="scrim" role="presentation" onclick={oncancel}></div>
<div class="picker card" role="dialog" aria-modal="true" aria-label="Choose a piece">
  {#each ROLES as r (r)}
    <button class="opt" onclick={() => onpick(r)} aria-label={r}>
      <span class="crop"><span class="cg-wrap"><piece class="{r} {color}"></piece></span></span>
    </button>
  {/each}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 95;
    background: rgba(5, 10, 20, 0.45);
  }
  .picker {
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
  .crop {
    display: block;
    width: 52px;
    height: 52px;
    overflow: hidden;
    border-radius: 6px;
  }
  .cg-wrap {
    position: relative;
    width: 416px;
    height: 416px;
  }
</style>

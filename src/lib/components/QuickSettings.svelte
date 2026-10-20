<script lang="ts">
  /**
   * The settings gear, in the same place on every page (the top bar on phones, tablets and computers, and each
   * game's own bar): the board and pieces, "Always promote to Queen", move sounds and premoves at a tap, and
   * the full Settings page. (It took the palette button's place: the board and pieces are its first item.)
   */
  import { page } from '$app/state';
  import Icon from './Icon.svelte';
  import { boardThemeOpen } from '$lib/boardTheme';
  import { autoQueen, premovesOn } from '$lib/preferences';
  import { setSound, soundOn } from '$lib/sound';

  let { size = 20 }: { size?: number } = $props();
  let open = $state(false);
  let root: HTMLElement | undefined = $state();

  // Another page: closed.
  $effect(() => {
    void page.url.pathname;
    open = false;
  });
  function outside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
  function boardAndPieces() {
    open = false;
    $boardThemeOpen = true;
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<span class="qs" bind:this={root}>
  <button class="icon-btn gear" class:on={open} onclick={() => (open = !open)} aria-label="Settings" aria-expanded={open} aria-haspopup="dialog" title="Settings">
    <Icon name="settings" {size} />
  </button>
  {#if open}
    <div class="menu card" role="dialog" aria-label="Quick settings">
      <p class="mh">Settings</p>
      <button class="item" onclick={boardAndPieces}><Icon name="palette" size={18} color="var(--accent)" /><span>Board and pieces</span><Icon name="chevron" size={16} color="var(--muted)" /></button>
      <label class="item">
        <span><strong>Always promote to Queen</strong><small>Off: you choose the piece</small></span>
        <input type="checkbox" checked={$autoQueen} onchange={(e) => autoQueen.set(e.currentTarget.checked)} />
      </label>
      <label class="item">
        <span><strong>Move sounds</strong></span>
        <input type="checkbox" checked={$soundOn} onchange={(e) => setSound(e.currentTarget.checked)} />
      </label>
      <label class="item">
        <span><strong>Premoves</strong><small>Move while the opponent thinks</small></span>
        <input type="checkbox" checked={$premovesOn} onchange={(e) => premovesOn.set(e.currentTarget.checked)} />
      </label>
      <a class="item all" href="/settings">All settings<Icon name="chevron" size={16} /></a>
    </div>
  {/if}
</span>

<style>
  .qs {
    position: relative;
    display: inline-flex;
  }
  .gear.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 90;
    width: min(290px, calc(100vw - 24px));
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  }
  @media (max-width: 600px) {
    .menu {
      position: fixed;
      right: 12px;
      top: calc(env(safe-area-inset-top, 0px) + 60px);
    }
  }
  .mh {
    margin: 4px 8px 6px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 46px;
    padding: 6px 10px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 15px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  .item:hover {
    background: var(--raised);
  }
  button.item {
    justify-content: flex-start;
  }
  button.item span {
    flex: 1;
    font-weight: 700;
  }
  .item small {
    display: block;
    font-size: 12px;
    color: var(--muted);
  }
  .item input {
    width: 22px;
    height: 22px;
    flex: none;
    accent-color: var(--accent);
  }
  .all {
    justify-content: space-between;
    margin-top: 4px;
    border-top: 1px solid var(--border);
    border-radius: 0 0 10px 10px;
    font-weight: 700;
    color: var(--accent);
  }
</style>

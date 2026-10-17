<script lang="ts">
  /** The board colour picker: classic wood or something more fun, for every board on the site. */
  import { BOARD_THEMES, applyBoardTheme, loadBoardTheme } from '$lib/boardTheme';
  import { track } from '$lib/analytics';
  import Icon from './Icon.svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();
  let current = $state('classic');

  $effect(() => {
    if (open) current = loadBoardTheme();
  });

  function pick(id: string) {
    current = id;
    applyBoardTheme(id);
    track('feature', `board_theme_${id}`);
    open = false;
  }
  const close = () => (open = false);
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#if open}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="board-theme-h">
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <h2 id="board-theme-h" class="title">Board colour</h2>
    <p class="label">Pick a look for every chess board on the site.</p>
    <div class="grid">
      {#each BOARD_THEMES as t (t.id)}
        <button class="swatch" class:on={current === t.id} onclick={() => pick(t.id)} aria-pressed={current === t.id}>
          <span class="mini" style="background: {t.light}; background-image: repeating-conic-gradient({t.dark} 0 25%, {t.light} 0 50%); background-size: 50% 50%;" aria-hidden="true"></span>
          <span class="name">{t.emoji} {t.name}</span>
          {#if current === t.id}<Icon name="check" size={16} color="var(--accent)" />{/if}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 10, 20, 0.6);
    z-index: 95;
  }
  .dialog {
    position: fixed;
    z-index: 96;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .x {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  .label {
    margin: 0 0 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--raised);
    cursor: pointer;
    text-align: left;
  }
  .swatch.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--raised));
  }
  .mini {
    width: 36px;
    height: 36px;
    border-radius: 7px;
    flex: none;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset;
  }
  .name {
    flex: 1;
    font-size: 14.5px;
    font-weight: 600;
  }
</style>

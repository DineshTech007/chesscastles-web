<script lang="ts">
  /** The board and piece picker: premium materials, classic colours or something fun, and the piece set, for every board on the site. */
  import { BOARD_THEMES, applyBoardTheme, loadBoardTheme } from '$lib/boardTheme';
  import { PIECE_SETS, applyPieceSet, loadPieceSet, pieceImage } from '$lib/pieceSets';
  import { track } from '$lib/analytics';
  import Icon from './Icon.svelte';
  import { goto } from '$app/navigation';
  import { ITEM, owns, priceOf } from '$lib/economy/core';
  import { today, wallet, wear } from '$lib/economy/wallet';
  import Coin from '$lib/economy/Coin.svelte';
  import Gem from '$lib/economy/Gem.svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();
  let current = $state('stone');
  let pieces = $state('merida');

  $effect(() => {
    if (open) {
      current = loadBoardTheme();
      pieces = loadPieceSet();
    }
  });

  function pick(id: string) {
    // A Shop board not won yet: to the Shop, to look at it closely.
    if (ITEM[id] && !owns($wallet, id)) {
      open = false;
      void goto('/shop?tab=board');
      return;
    }
    current = id;
    applyBoardTheme(id);
    // What the player wears (the Treasury): the board everyone sees on their profile.
    void wear('board', id);
    track('feature', `board_theme_${id}`);
  }
  function pickPieces(id: string) {
    // A Shop piece set not bought yet: to the Shop.
    if (ITEM[id] && !owns($wallet, id)) {
      open = false;
      void goto('/shop?tab=pieces');
      return;
    }
    pieces = id;
    applyPieceSet(id);
    void wear('pieces', id);
    track('feature', `piece_set_${id}`);
  }
  const premium = BOARD_THEMES.filter((t) => t.image);
  const colours = BOARD_THEMES.filter((t) => !t.image && !t.shop);
  const shop = BOARD_THEMES.filter((t) => t.shop);
  const day = today();
  const close = () => (open = false);
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#if open}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="board-theme-h">
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <h2 id="board-theme-h" class="title">Board and pieces</h2>
    <p class="label">Pick a look for every chess board on the site.</p>
    <div class="preview" aria-hidden="true">
      <span class="pv-board" style={BOARD_THEMES.find((t) => t.id === current)?.image ? `background-image: url(${BOARD_THEMES.find((t) => t.id === current)?.image}); background-size: 200% 200%;` : `background: ${BOARD_THEMES.find((t) => t.id === current)?.light}; background-image: repeating-conic-gradient(${BOARD_THEMES.find((t) => t.id === current)?.dark} 0 25%, ${BOARD_THEMES.find((t) => t.id === current)?.light} 0 50%); background-size: 50% 50%;`}>
        <img src={pieceImage(pieces, 'wK')} alt="" /><img src={pieceImage(pieces, 'bQ')} alt="" /><img src={pieceImage(pieces, 'bN')} alt="" /><img src={pieceImage(pieces, 'wP')} alt="" />
      </span>
    </div>
    <h3 class="sub-h">Premium boards</h3>
    <div class="grid">
      {#each premium as t (t.id)}
        <button class="swatch" class:on={current === t.id} onclick={() => pick(t.id)} aria-pressed={current === t.id}>
          <span class="mini" style="background-image: url({t.image}); background-size: 200% 200%;" aria-hidden="true"></span>
          <span class="name">{t.emoji} {t.name}</span>
          {#if current === t.id}<Icon name="check" size={16} color="var(--accent)" />{/if}
        </button>
      {/each}
    </div>
    <h3 class="sub-h">✨ Shop boards</h3>
    <div class="grid">
      {#each shop as t (t.id)}
        {@const got = owns($wallet, t.id)}
        {@const p = priceOf(ITEM[t.id], day)}
        <button class="swatch" class:on={current === t.id} class:locked={!got} onclick={() => pick(t.id)} aria-pressed={current === t.id}>
          <span class="mini bprev" data-b={t.id} style="--board-light: {t.light}; --board-dark: {t.dark}; background-color: {t.light};" aria-hidden="true"></span>
          <span class="name">{t.emoji} {t.name}</span>
          {#if current === t.id}<Icon name="check" size={16} color="var(--accent)" />{:else if !got}<span class="cost">{#if p}{#if p.currency === 'gold'}<Coin size={13} />{:else}<Gem size={12} />{/if}{p.amount}{:else}<Icon name="lock" size={13} />{/if}</span>{/if}
        </button>
      {/each}
    </div>
    <h3 class="sub-h">Colours</h3>
    <div class="grid">
      {#each colours as t (t.id)}
        <button class="swatch" class:on={current === t.id} onclick={() => pick(t.id)} aria-pressed={current === t.id}>
          <span class="mini" style="background: {t.light}; background-image: repeating-conic-gradient({t.dark} 0 25%, {t.light} 0 50%); background-size: 50% 50%;" aria-hidden="true"></span>
          <span class="name">{t.emoji} {t.name}</span>
          {#if current === t.id}<Icon name="check" size={16} color="var(--accent)" />{/if}
        </button>
      {/each}
    </div>
    <h3 class="sub-h">Pieces</h3>
    <div class="grid pieces">
      {#each PIECE_SETS as p (p.id)}
        {@const got = !p.shop || owns($wallet, p.id)}
        {@const cost = p.shop ? priceOf(ITEM[p.id], day) : undefined}
        <button class="swatch" class:on={pieces === p.id} class:locked={!got} onclick={() => pickPieces(p.id)} aria-pressed={pieces === p.id} title={p.credit}>
          <span class="pset" aria-hidden="true"><img src={pieceImage(p.id, 'wN')} alt="" /><img src={pieceImage(p.id, 'bQ')} alt="" /></span>
          <span class="name">{p.shop ? '✨ ' : ''}{p.name}{p.kids ? ' 🧒' : ''}</span>
          {#if pieces === p.id}<Icon name="check" size={16} color="var(--accent)" />{:else if !got}<span class="cost">{#if cost}{#if cost.currency === 'gold'}<Coin size={13} />{:else}<Gem size={12} />{/if}{cost.amount}{:else}<Icon name="lock" size={13} />{/if}</span>{/if}
        </button>
      {/each}
    </div>
    <p class="label credits">Pieces from the Lichess collection, by their authors: {PIECE_SETS.map((p) => `${p.name} (${p.credit})`).join(', ')}.</p>
    <button class="btn primary done" onclick={close}>Done</button>
  </div>
{/if}

<style>
  .mini.bprev {
    position: relative;
    overflow: hidden;
  }
  .swatch.locked .pset {
    opacity: 0.75;
  }
  .swatch.locked .mini {
    opacity: 0.75;
  }
  .swatch.locked .name {
    color: var(--muted);
  }
  .cost {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    font-weight: 800;
    color: var(--text-2);
    white-space: nowrap;
  }
  .preview {
    display: flex;
    justify-content: center;
    margin: 4px 0 8px;
  }
  .pv-board {
    display: grid;
    grid-template-columns: repeat(2, 56px);
    grid-template-rows: repeat(2, 56px);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  }
  .pv-board img {
    width: 56px;
    height: 56px;
  }
  .sub-h {
    margin: 12px 0 6px;
    font-size: 14px;
    color: var(--gold);
  }
  .pset {
    display: inline-flex;
    gap: 0;
    flex: none;
  }
  .pset img {
    width: 26px;
    height: 26px;
  }
  .credits {
    margin: 10px 0 0;
    font-size: 11px;
  }
  .done {
    margin-top: 12px;
    width: 100%;
  }
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

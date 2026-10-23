<script lang="ts">
  /**
   * What an item looks like, before it is bought: a board with pieces on it, a finish on the player's own piece set,
   * a frame around a picture, a name in its style, a banner, a victory effect playing in miniature.
   */
  import { BOARD_THEMES } from '$lib/boardTheme';
  import { DEFAULT_PIECES, loadPieceSet, pieceImage } from '$lib/pieceSets';
  import { onMount } from 'svelte';
  import Avatar from './Avatar.svelte';
  import Banner from './Banner.svelte';
  import { ITEM } from './core';

  let { id, name = 'Your Name', photo = '/avatars/knight.webp', big = false, finish = '' }: { id: string; name?: string; photo?: string; big?: boolean; /** A board shown with this piece finish on it. */ finish?: string } = $props();
  const item = $derived(ITEM[id]);
  const theme = $derived(BOARD_THEMES.find((b) => b.id === id));
  let set = $state(DEFAULT_PIECES);
  onMount(() => (set = loadPieceSet()));
  /** Each sound pack's picture. */
  const SPK: Record<string, string> = { sarcade: '🕹️', scrystal: '🔔', smarble: '🏛️', sroyal: '🎺', sdrums: '🥁' };
  const boardOf = (bid: string) => BOARD_THEMES.find((b) => b.id === bid) ?? BOARD_THEMES.find((b) => b.id === 'stone')!;
  /** A few pieces in a position worth looking at. */
  const PIECES: [string, number, number][] = [
    ['bK', 6, 0],
    ['bQ', 3, 1],
    ['bN', 5, 2],
    ['wB', 2, 4],
    ['wQ', 4, 5],
    ['wN', 1, 5],
    ['wK', 6, 7],
    ['wP', 3, 6],
  ];
</script>

{#snippet board(bid: string, finish: string, pset = set)}
  {@const b = boardOf(bid)}
  <span class="bprev finish-{finish}" data-b={bid} style={b.image ? `background-image: url(${b.image}); background-size: 100% 100%;` : `--board-light: ${b.light}; --board-dark: ${b.dark}; background-color: ${b.light};`}>
    {#each PIECES as [p, x, y] (p)}
      <img class={p[0] === 'w' ? 'pw' : 'pb'} src={pieceImage(pset, p)} alt="" style="left: {x * 12.5}%; top: {y * 12.5}%" />
    {/each}
  </span>
{/snippet}

<div class="art {item?.slot ?? 'board'}" class:big>
  {#if item?.slot === 'board' || (!item && theme)}
    {@render board(id, finish)}
  {:else if item?.slot === 'finish'}
    {@render board('stone', id)}
  {:else if item?.slot === 'pieces'}
    {@render board('classic', '', id)}
  {:else if item?.slot === 'sound'}
    <span class="stage snd snd-{id}" aria-hidden="true">
      <span class="spk">{SPK[id] ?? '🔊'}</span>
      <span class="waves">{#each Array(9) as _, i (i)}<span style="--i: {i}"></span>{/each}</span>
    </span>
  {:else if item?.slot === 'frame'}
    <span class="stage"><Avatar src={photo} frame={id} size={big ? 120 : 64} /></span>
  {:else if item?.slot === 'name'}
    <span class="stage namebox">
      <span class="plate">
        <Avatar src={photo} size={big ? 64 : 38} border="2px solid var(--gold)" />
        <span class="nm nfx nfx-{id}" style="font-size: {big ? 34 : 19}px">{name}</span>
      </span>
    </span>
  {:else if item?.slot === 'banner'}
    <span class="bannerbox"><Banner {id} /><span class="me"><Avatar src={photo} size={big ? 56 : 34} border="2px solid #fff" /></span></span>
  {:else if item?.slot === 'victory'}
    <span class="stage fx fx-{id}" aria-hidden="true">
      <span class="trophy">🏆</span>
      {#each Array(12) as _, i (i)}<span class="p" style="--i: {i}"></span>{/each}
    </span>
  {:else if item?.slot === 'guru'}
    <span class="stage guru"><img src="/coach/{id.slice(2)}.webp" alt="" loading="lazy" /></span>
  {:else if item?.slot === 'shield'}
    <span class="stage"><span class="shield">🛡️</span></span>
  {/if}
</div>

<style>
  .stage.guru {
    background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--gold) 30%, #16224a), #0f1733 75%);
  }
  .stage.guru img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 20%;
  }
  .art {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 14px;
    overflow: hidden;
    background: radial-gradient(120% 100% at 50% 0%, #22346a, #0d1730);
    display: grid;
    place-items: center;
  }
  :global(:root[data-theme='light']) .art {
    background: radial-gradient(120% 100% at 50% 0%, #fff6e0, #efe7d6);
  }
  .bprev {
    position: absolute;
    inset: 0;
    display: block;
  }
  .bprev img {
    position: absolute;
    width: 12.5%;
    height: 12.5%;
    z-index: 1;
  }
  .stage {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }
  .namebox {
    padding: 0 8px;
  }
  .plate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    padding: 14px 12px;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  :global(:root[data-theme='light']) .plate {
    background: rgba(255, 255, 255, 0.7);
    border-color: var(--border);
  }
  .nm {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.01em;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bannerbox {
    position: absolute;
    inset: 0;
  }
  .me {
    position: absolute;
    left: 10%;
    bottom: 10%;
  }
  .shield {
    font-size: 54px;
    filter: drop-shadow(0 0 14px rgba(120, 190, 255, 0.6));
    animation: bob 2.4s ease-in-out infinite;
  }
  .big .shield {
    font-size: 110px;
  }
  @keyframes bob {
    50% {
      transform: translateY(-5px);
    }
  }
  /* Sound packs: an instrument and a moving sound wave. */
  .snd {
    flex-direction: column;
    gap: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .spk {
    font-size: 44px;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
  }
  .big .spk {
    font-size: 90px;
  }
  .waves {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 34px;
  }
  .waves span {
    width: 5px;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(180deg, #8fe6f5, #7c5cf0);
    animation: wave 1.1s ease-in-out infinite;
    animation-delay: calc(var(--i) * -0.13s);
    transform-origin: center;
  }
  .snd-sdrums .waves span,
  .snd-sroyal .waves span {
    background: linear-gradient(180deg, #ffd76a, #c98a1b);
  }
  .snd-sarcade .waves span {
    background: linear-gradient(180deg, #4ade80, #16a34a);
    border-radius: 0;
  }
  @keyframes wave {
    0%,
    100% {
      transform: scaleY(0.25);
    }
    50% {
      transform: scaleY(1);
    }
  }
  /* Victory effects, in miniature. */
  .trophy {
    font-size: 40px;
    z-index: 1;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
  }
  .big .trophy {
    font-size: 84px;
  }
  .p {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    border-radius: 2px;
  }
  .fx-vconfetti .p {
    background: hsl(calc(var(--i) * 30) 90% 60%);
    animation: confetti 2.2s ease-in infinite;
    animation-delay: calc(var(--i) * -0.18s);
    left: calc(8% + var(--i) * 7.5%);
    top: -10%;
  }
  @keyframes confetti {
    to {
      transform: translateY(130px) rotate(540deg);
    }
  }
  .big .fx-vconfetti .p,
  .big.victory .p {
    --fall: 260px;
  }
  .fx-vfireworks .p {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: hsl(calc(var(--i) * 30 + 20) 95% 65%);
    box-shadow: 0 0 6px currentColor;
    animation: spark 1.6s ease-out infinite;
    --a: calc(var(--i) * 30deg);
  }
  @keyframes spark {
    0% {
      transform: rotate(var(--a)) translateX(0) scale(1);
      opacity: 1;
    }
    100% {
      transform: rotate(var(--a)) translateX(46px) scale(0.3);
      opacity: 0;
    }
  }
  .fx-vgoldrain .p {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff4c2, #f5c451 45%, #b87a12);
    left: calc(6% + var(--i) * 7.8%);
    top: -12%;
    animation: confetti 1.9s ease-in infinite;
    animation-delay: calc(var(--i) * -0.16s);
  }
  .fx-vfanfare {
    background: repeating-conic-gradient(from 0deg, rgba(255, 220, 140, 0.18) 0 10deg, transparent 10deg 24deg);
    animation: rot 12s linear infinite;
  }
  .fx-vfanfare .trophy {
    animation: rot 12s linear infinite reverse;
  }
  .fx-vfanfare .trophy::before {
    content: '👑';
    position: absolute;
    left: 50%;
    top: -0.55em;
    font-size: 0.5em;
    transform: translateX(-50%);
  }
  .fx-vfanfare .p {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff4c2, #f5c451 45%, #b87a12);
    animation: spark 2s ease-out infinite;
    animation-delay: calc(var(--i) * -0.15s);
    --a: calc(var(--i) * 30deg);
  }
  @keyframes rot {
    to {
      transform: rotate(360deg);
    }
  }
</style>

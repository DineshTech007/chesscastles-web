<script lang="ts">
  /** A badge's medal (rewards.ts BADGE_ART) with its number; grey with a lock until earned. */
  import { BADGE_ART, medalSrc, type Badge } from './rewards';
  let { badge, got = true, size = 72 }: { badge: Badge; got?: boolean; size?: number } = $props();
  const art = $derived(BADGE_ART[badge.id]);
</script>

<span class="medal" class:locked={!got} style="--s: {size}px">
  {#if art}
    <img src={medalSrc(art.medal)} alt="" width={size} height={size} loading="lazy" />
    {#if art.n}<span class="n num">{art.n}</span>{/if}
  {:else}
    <span class="emoji" aria-hidden="true">{badge.icon}</span>
  {/if}
  {#if !got}<span class="lock" aria-hidden="true">🔒</span>{/if}
</span>

<style>
  .medal {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: var(--s);
    height: var(--s);
    flex: none;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
  }
  .n {
    position: absolute;
    bottom: 2%;
    left: 50%;
    transform: translateX(-50%);
    min-width: 34%;
    padding: 1px 6px;
    border-radius: 999px;
    background: #0b1426;
    border: 1.5px solid #f2c14e;
    color: #f7d27a;
    font-weight: 900;
    font-size: calc(var(--s) * 0.17);
    line-height: 1.2;
    text-align: center;
  }
  .emoji {
    font-size: calc(var(--s) * 0.6);
  }
  .locked img,
  .locked .emoji {
    filter: grayscale(1) brightness(0.75);
    opacity: 0.45;
  }
  .locked .n {
    border-color: var(--border);
    color: var(--muted);
  }
  .lock {
    position: absolute;
    top: 0;
    right: 0;
    font-size: calc(var(--s) * 0.24);
  }
</style>

<script lang="ts">
  /**
   * The home page for visitors: the latest kind words (a few lines each) and a link to all of them (/wishes).
   * Nothing shows while there are none, or while they fail to load.
   */
  import { onMount } from 'svelte';
  import WishCard from '$lib/components/WishCard.svelte';
  import { t } from '$lib/i18n';
  import { fetchWishes, type Wish } from '$lib/wishes';

  let { limit = 3 }: { limit?: number } = $props();
  let wishes = $state<Wish[]>([]);
  // Loaded once the page is idle, so the first paint never waits on it.
  onMount(() => {
    const load = async () => {
      try {
        wishes = (await fetchWishes()).slice(0, limit);
      } catch {
        /* the strip stays away */
      }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(() => void load(), { timeout: 3000 });
    else setTimeout(() => void load(), 800);
  });
</script>

{#if wishes.length}
  <section class="kind" aria-labelledby="kind-h">
    <header class="sec-head">
      <p class="eyebrow">{$t('wishes.eyebrow')}</p>
      <h2 id="kind-h" class="display">{$t('wishes.h')}</h2>
    </header>
    <div class="list">
      {#each wishes as w (w.id)}<WishCard wish={w} compact />{/each}
    </div>
    <a class="btn all" href="/wishes">{$t('wishes.all')}</a>
  </section>
{/if}

<style>
  .kind {
    margin: 28px 0 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .sec-head {
    text-align: center;
  }
  .eyebrow {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    font-weight: 800;
    font-size: 12.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h2 {
    margin: 6px 0 0;
    font-size: clamp(24px, 4vw, 32px);
  }
  .list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    align-items: start;
  }
  .all {
    align-self: center;
  }
</style>

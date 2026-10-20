<script lang="ts">
  /**
   * Kind words: what chess players, coaches and well-wishers wrote about Chess Castles, as they wrote it (the owner
   * adds them on the admin page; nothing here is made up).
   */
  import { onMount } from 'svelte';
  import WishCard from '$lib/components/WishCard.svelte';
  import { fetchWishes, type Wish } from '$lib/wishes';

  let wishes = $state<Wish[] | undefined>();
  let error = $state('');

  async function load() {
    error = '';
    try {
      wishes = await fetchWishes();
    } catch (e) {
      error = e instanceof Error ? e.message : 'The kind words could not be loaded.';
    }
  }
  onMount(load);
</script>

<svelte:head>
  <title>Kind words · Chess Castles</title>
  <meta name="description" content="What chess players, coaches and well-wishers say about Chess Castles, in their own words." />
</svelte:head>

<div class="page">
  <header class="head">
    <p class="eyebrow label">Kind words</p>
    <h1 class="display">In their own words</h1>
    <p class="lead">Messages from chess players, coaches and well-wishers about Chess Castles.</p>
  </header>

  {#if error}
    <div class="card pad">
      <p>{error}</p>
      <button class="btn" onclick={load}>Try again</button>
    </div>
  {:else if !wishes}
    <p class="label pad" aria-busy="true">Loading…</p>
  {:else if !wishes.length}
    <p class="card pad label">No messages here yet.</p>
  {:else}
    <div class="list">
      {#each wishes as w (w.id)}<WishCard wish={w} />{/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 780px;
    margin: 0 auto;
  }
  .head {
    margin: 8px 0 20px;
  }
  .eyebrow {
    margin: 0 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--gold);
  }
  h1 {
    margin: 0;
    font-size: clamp(30px, 6vw, 42px);
  }
  .lead {
    margin: 8px 0 0;
    color: var(--text-2);
    font-size: 16px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .pad {
    padding: 18px;
  }
</style>

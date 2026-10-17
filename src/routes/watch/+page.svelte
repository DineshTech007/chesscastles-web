<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { topBroadcasts, type Broadcast } from '$lib/lichess';

  let list = $state<Broadcast[] | undefined>();
  let error = $state(false);
  onMount(() => topBroadcasts().then((b) => (list = b), () => (error = true)));
</script>

<svelte:head><title>Watch · Chess Castles</title></svelte:head>

<div class="page">
  <header>
    <h1 class="display">Watch</h1>
    <p class="label">Top tournaments, live. Open one to follow every board, with clocks and the engine.</p>
  </header>

  {#if error}
    <div class="card">The live events couldn't load. Check your connection and try again.</div>
  {:else if !list}
    <div class="grid">
      {#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="tile skeleton"></div>{/each}
    </div>
  {:else if !list.length}
    <div class="card">No broadcasts right now. Check back soon.</div>
  {:else}
    <div class="grid">
      {#each list as b (b.id)}
        <a class="tile" href="/watch/{b.id}">
          <div class="img">
            {#if b.image}<img src={b.image} alt="" loading="lazy" />{/if}
            {#if b.live}<span class="pill live on-img"><span class="dot"></span>Live</span>{/if}
          </div>
          <div class="body">
            <span class="title name">{b.name}</span>
            <span class="label">{b.round}</span>
            <span class="label meta">{[b.location, b.timeControl].filter(Boolean).join(' · ')}</span>
          </div>
          <span class="go">Watch all boards<Icon name="chevron" size={16} /></span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1140px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  h1 {
    font-size: 42px;
  }
  header .label {
    margin: 6px 0 0;
    font-size: 15px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-card);
    overflow: hidden;
    color: var(--text);
    text-decoration: none;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .tile:hover {
    border-color: var(--brand);
    transform: translateY(-2px);
    text-decoration: none;
  }
  .img {
    position: relative;
    aspect-ratio: 2 / 1;
    background: var(--raised);
  }
  .img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .on-img {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(10, 18, 38, 0.85);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--live);
  }
  .body {
    padding: 12px 14px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-size: 17px;
  }
  .meta {
    font-size: 12.5px;
  }
  .go {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px 14px;
    color: var(--accent);
    font-weight: 600;
    font-size: 14px;
    margin-top: auto;
  }
  .skeleton {
    min-height: 240px;
    background: linear-gradient(90deg, var(--raised), var(--card), var(--raised));
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
</style>

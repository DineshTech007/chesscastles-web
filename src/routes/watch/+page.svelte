<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import { searchBroadcasts, topBroadcasts, type Broadcast, type BroadcastLists } from '$lib/lichess';

  // Search: the lists below filter as you type; from 3 letters Lichess is searched for more tournaments.
  let q = $state(page.url.searchParams.get('q') ?? '');
  let found = $state<Broadcast[] | undefined>();
  let searching = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const hit = (b: Broadcast) => !q.trim() || norm(`${b.name} ${b.location ?? ''}`).includes(norm(q));
  $effect(() => {
    const term = q.trim();
    clearTimeout(searchTimer);
    if (term.length < 3) {
      found = undefined;
      return;
    }
    searching = true;
    searchTimer = setTimeout(async () => {
      const r = await searchBroadcasts(term).catch(() => []);
      if (q.trim() === term) {
        found = r;
        searching = false;
      }
    }, 350);
  });
  const others = $derived.by(() => {
    if (!found || !lists) return found ?? [];
    const here = new Set([...lists.live, ...lists.soon, ...lists.finished].map((b) => b.id));
    return found.filter((b) => !here.has(b.id));
  });

  let lists = $state<BroadcastLists | undefined>();
  let error = $state(false);
  let tab = $state<'live' | 'soon' | 'finished'>('live');
  onMount(() =>
    topBroadcasts().then(
      (b) => {
        lists = b;
        // Nothing live right now: open on what's coming up.
        if (!b.live.length) tab = b.soon.length ? 'soon' : 'finished';
      },
      () => (error = true),
    ),
  );
  const shown = $derived(lists ? lists[tab].filter(hit) : undefined);

  /** "in 3 hours", "tomorrow, 14:30", "Sat, 14:30". */
  function startsText(t?: number): string {
    if (!t) return '';
    const mins = Math.round((t - Date.now()) / 60_000);
    if (mins <= 0) return 'Starting now';
    if (mins < 60) return `Starts in ${mins} min`;
    if (mins < 12 * 60) return `Starts in ${Math.round(mins / 60)} h`;
    return 'Starts ' + new Date(t).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
</script>

<svelte:head><title>Watch · Chess Castles</title></svelte:head>

<div class="page">
  <header>
    <h1 class="display">Watch</h1>
    <p class="label">Top tournaments, live. Open one to follow every board, with clocks and the engine.</p>
  </header>

  <a class="card here" href="/live"><span class="here-dot"></span><span><strong>Live on Chess Castles</strong><span class="label">Games being played on Chess Castles right now</span></span><Icon name="chevron" color="var(--muted)" /></a>

  <label class="search">
    <Icon name="search" size={18} color="var(--muted)" />
    <input type="search" bind:value={q} placeholder="Search a tournament, e.g. Chennai, Olympiad, Tata Steel" aria-label="Search tournaments" />
    {#if q}<button class="clear" onclick={() => (q = '')} aria-label="Clear the search"><Icon name="close" size={16} /></button>{/if}
  </label>

  {#if lists}
    <div class="tabs segmented" role="group" aria-label="Tournaments">
      <button aria-pressed={tab === 'live'} onclick={() => (tab = 'live')}>
        {#if lists.live.length}<span class="dot"></span>{/if}Live now <span class="n">{lists.live.length}</span>
      </button>
      <button aria-pressed={tab === 'soon'} onclick={() => (tab = 'soon')}>Coming up <span class="n">{lists.soon.length}</span></button>
      <button aria-pressed={tab === 'finished'} onclick={() => (tab = 'finished')}>Finished <span class="n">{lists.finished.length}</span></button>
    </div>
  {/if}

  {#if error}
    <div class="card">The live events couldn't load. Check your connection and try again.</div>
  {:else if !shown}
    <div class="grid">
      {#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="tile skeleton"></div>{/each}
    </div>
  {:else if !shown.length}
    <div class="card">{q.trim() ? `No ${tab === 'live' ? 'live' : tab === 'soon' ? 'coming' : 'finished'} tournament matches “${q.trim()}” here.${q.trim().length >= 3 ? ' More results from Lichess are below.' : ''}` : tab === 'live' ? 'No tournament is being played right now.' : tab === 'soon' ? 'Nothing coming up yet. Check back soon.' : 'No finished tournaments to show.'}</div>
  {:else}
    <div class="grid">
      {#each shown as b (b.id)}
        <a class="tile" href="/watch/{b.id}">
          <div class="img">
            {#if b.image}<img src={b.image} alt="" loading="lazy" />{/if}
            {#if b.live}<span class="pill live on-img"><span class="dot"></span>Live</span>{/if}
          </div>
          <div class="body">
            <span class="title name">{b.name}</span>
            <span class="label">{b.round}{#if tab === 'soon' && b.startsAt} · {startsText(b.startsAt)}{:else if tab === 'finished'} · Finished{/if}</span>
            <span class="label meta">{[b.location, b.timeControl].filter(Boolean).join(' · ')}</span>
          </div>
          <span class="go">{tab === 'soon' ? 'See the rounds' : tab === 'finished' ? 'Replay the games' : 'Watch all boards'}<Icon name="chevron" size={16} /></span>
        </a>
      {/each}
    </div>
  {/if}

  {#if q.trim().length >= 3}
    <section class="more-found">
      <h2 class="title">More tournaments for “{q.trim()}”</h2>
      {#if searching && !found}
        <p class="label">Searching Lichess broadcasts…</p>
      {:else if !others.length}
        <p class="label">No other tournament with that name on Lichess.</p>
      {:else}
        <div class="grid">
          {#each others as b (b.id)}
            <a class="tile" href="/watch/{b.id}">
              <div class="img">{#if b.image}<img src={b.image} alt="" loading="lazy" />{/if}</div>
              <div class="body">
                <span class="title name">{b.name}</span>
                <span class="label meta">{[b.location, b.timeControl].filter(Boolean).join(' · ')}</span>
              </div>
              <span class="go">Open<Icon name="chevron" size={16} /></span>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .here {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    margin: 0 0 14px;
    border-color: color-mix(in srgb, #e5534b 45%, var(--border));
  }
  .here > span:nth-child(2) {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .here-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #e5534b;
    flex: none;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    min-height: 48px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 16px;
    outline: none;
  }
  .search:focus-within {
    border-color: var(--gold);
  }
  .clear {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: var(--raised);
    color: var(--text);
    cursor: pointer;
  }
  .more-found {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .more-found h2 {
    margin: 6px 0 0;
    font-size: 18px;
  }
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
  .tabs {
    max-width: 520px;
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .tabs .n {
    font-size: 12px;
    opacity: 0.7;
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

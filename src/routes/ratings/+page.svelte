<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import FideRankings from '$lib/components/FideRankings.svelte';
  import { displayName, fideSearch, rankResults, type FidePlayer } from '$lib/api';
  import { session, startSignIn } from '$lib/auth';
  import CastlePlayers from '$lib/components/CastlePlayers.svelte';

  type Tab = 'fide' | 'search' | 'chesscastles';
  let tab = $state<Tab>('fide');


  // Search.
  let q = $state('');
  let results = $state<FidePlayer[] | undefined>();
  let searching = $state(false);
  /** How many search results are listed (more on request). */
  let shown = $state(50);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;


  onMount(() => {
    const t = page.url.searchParams.get('tab');
    if (t === 'search' || t === 'chesscastles') tab = t;
    else if (t === 'knight24') tab = 'chesscastles'; // old links
  });

  function onSearch() {
    clearTimeout(searchTimer);
    const query = q.trim();
    if (query.length < 3) {
      results = undefined;
      return;
    }
    searchTimer = setTimeout(async () => {
      searching = true;
      try {
        let found = await fideSearch(query);
        // FIDE matches "First Last" exactly; if nothing came back, try the words the other way round.
        const words = query.split(/\s+/);
        if (!found.length && words.length > 1) found = await fideSearch([...words.slice(1), words[0]].join(' '));
        if (q.trim() !== query) return;
        results = rankResults(found, query);
        shown = 50;
      } catch {
        results = [];
      } finally {
        searching = false;
      }
    }, 350);
  }


  const me = $derived($session.status === 'in' ? $session.uid : undefined);
</script>

<svelte:head><title>Ratings · Chess Castles</title></svelte:head>

<div class="page">
  <header class="head">
    <div>
      <h1 class="display">Ratings</h1>
      <p class="label">FIDE's official top lists and player ratings, and the Chess Castles leaderboards.</p>
    </div>
    <div class="segmented tabs" role="group" aria-label="Ratings">
      <button aria-pressed={tab === 'fide'} onclick={() => (tab = 'fide')}>FIDE rankings</button>
      <button aria-pressed={tab === 'search'} onclick={() => (tab = 'search')}>Search all FIDE</button>
      <button aria-pressed={tab === 'chesscastles'} onclick={() => (tab = 'chesscastles')}>Chess Castles</button>
    </div>
  </header>

  {#if tab === 'fide'}
    <FideRankings />
  {:else if tab === 'search'}
    <section class="card">
      <label class="search">
        <Icon name="search" size={20} color="var(--muted)" />
        <span class="sr-only">Player name or FIDE ID</span>
        <input type="search" placeholder="Name or FIDE ID, e.g. Gukesh or 46616543" bind:value={q} oninput={onSearch} />
      </label>
      {#if searching}
        <p class="label">Searching FIDE…</p>
      {:else if results && !results.length}
        <p class="label">No FIDE-rated player found. Try the surname only.</p>
      {:else if results}
        <p class="label found">{results.length === 1 ? '1 player found' : `${results.length} players found`}{results.length > shown ? `, showing the first ${shown}` : ''}. Closest matches and players from India come first.</p>
        <ul class="results">
          {#each results.slice(0, shown) as p (p.fideId)}
            <li>
              <a href="/ratings/player/{p.fideId}">
                <span class="r-name">{p.title ? `${p.title} ` : ''}{displayName(p.name)}</span>
                <span class="label">{[p.federation, p.birthYear].filter(Boolean).join(' · ')}</span>
                <span class="r-ratings num">
                  <span>Std <b>{p.standard ?? '—'}</b></span><span>Rapid <b>{p.rapid ?? '—'}</b></span><span>Blitz <b>{p.blitz ?? '—'}</b></span>
                </span>
              </a>
            </li>
          {/each}
        </ul>
        {#if results.length > shown}
          <button class="btn more" onclick={() => (shown += 100)}>Show {Math.min(100, results.length - shown)} more</button>
        {/if}
      {:else}
        <p class="label">Type at least three letters of a name, or a FIDE ID.</p>
      {/if}
    </section>
  {:else}
    <section class="card">
      {#if $session.status !== 'in'}
        <div class="signin">
          <p>Chess Castles' own players: the best CC Ratings (Classical, Rapid, Blitz and Bullet) and puzzle ratings, with their countries and profiles.</p>
          <button class="btn primary" onclick={() => startSignIn()}>Sign in to see them</button>
        </div>
      {:else}
        <CastlePlayers {me} />
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 980px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 42px;
  }
  .head .label {
    margin: 6px 0 0;
  }
  .tabs {
    min-width: min(100%, 420px);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
  .found {
    margin: 10px 0 0;
  }
  .more {
    margin-top: 12px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
  }
  .search input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 0;
    outline: none;
    color: var(--text);
    font: inherit;
    font-size: 16px;
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .results a {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    padding: 10px 8px;
    border-bottom: 1px solid var(--border-soft);
    color: var(--text);
    text-decoration: none;
  }
  .results a:hover {
    background: var(--raised);
  }
  .r-name {
    font-weight: 600;
  }
  .r-ratings {
    grid-row: 1 / span 2;
    grid-column: 2;
    align-self: center;
    display: flex;
    gap: 12px;
    font-size: 13.5px;
    color: var(--text-2);
  }
  .signin {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .signin p {
    margin: 0;
    color: var(--text-2);
  }
  @media (max-width: 640px) {
    .r-ratings {
      grid-row: auto;
      grid-column: 1 / -1;
    }
  }
</style>

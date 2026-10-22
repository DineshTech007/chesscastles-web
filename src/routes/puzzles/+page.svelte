<script lang="ts">
  /**
   * Puzzles: rated puzzles at the player's level, one after another (never
   * the same twice), with the rating, levels, timer, stars, goal, charts and
   * badges around the board (RatedPuzzles); and Lichess's puzzle of the day.
   */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import RatedPuzzles from '$lib/puzzles/RatedPuzzles.svelte';
  import DailyPuzzle from '$lib/puzzles/DailyPuzzle.svelte';

  const tab = $derived(page.url.searchParams.get('tab') === 'daily' ? 'daily' : 'rated');
  function show(t: 'rated' | 'daily') {
    const u = new URL(page.url);
    if (t === 'daily') u.searchParams.set('tab', 'daily');
    else u.searchParams.delete('tab');
    void goto(u, { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<svelte:head><title>{tab === 'daily' ? 'Puzzle of the day' : 'Puzzles'} · Chess Castles</title></svelte:head>

<div class="page">
  <div class="bar">
    <div class="segmented tabs" role="group" aria-label="Puzzles">
      <button aria-pressed={tab === 'rated'} onclick={() => show('rated')}>Rated puzzles</button>
      <button aria-pressed={tab === 'daily'} onclick={() => show('daily')}>Puzzle of the day</button>
    </div>
    <div class="more">
      <a class="btn racer" href="/puzzles/racer">🏎️ Puzzle Racer</a>
      <a class="btn rush" href="/puzzles/rush"><Icon name="flame" size={16} />Puzzle Rush</a>
      <a class="btn" href="/puzzles/themes"><Icon name="puzzle" size={16} />By theme</a>
      <a class="btn" href="/insights/mistakes"><Icon name="history" size={16} />Your own mistakes</a>
      <a class="btn" href="/vision/blind"><Icon name="eye" size={16} />Blindfold</a>
    </div>
  </div>
  {#if tab === 'daily'}
    <DailyPuzzle />
  {:else}
    <RatedPuzzles />
  {/if}
</div>

<style>
  .page {
    max-width: 1240px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .tabs {
    min-width: min(100%, 360px);
  }
  .more {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .more .racer {
    border-color: #38bdf8;
    background: linear-gradient(135deg, color-mix(in srgb, #38bdf8 22%, transparent), color-mix(in srgb, #a855f7 16%, transparent));
    font-weight: 800;
  }
  .more .rush {
    border-color: color-mix(in srgb, var(--gold) 65%, var(--border));
    color: var(--gold);
    font-weight: 800;
  }
  /* Phones: the shortcuts in one short row, so the board and the puzzle card fit on the screen. */
  @media (max-width: 600px) {
    .page {
      gap: 10px;
    }
    .more {
      flex-wrap: nowrap;
      overflow-x: auto;
      width: 100%;
      scrollbar-width: none;
    }
    .more .btn {
      flex: none;
      min-height: 38px;
      padding: 0 12px;
      font-size: 13.5px;
    }
  }
</style>

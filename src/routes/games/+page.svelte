<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import ShareGame from '$lib/components/ShareGame.svelte';
  import { session } from '$lib/auth';
  import { onMount } from 'svelte';
  import { syncGames, syncState } from '$lib/stores/gameSync';

  // Opening My games always checks the account for games from other devices.
  onMount(() => {
    const s = $session;
    if (s.status === 'in') void syncGames(s.uid);
  });
  $effect(() => {
    if ($session.status === 'in' && $syncState.status === 'idle') void syncGames($session.uid);
  });
  import { formatDate } from '$lib/format';
  import { KIND_LABEL, opponentOf, outcome, type GameKind, type SavedGame } from '$lib/stores/myGames';
  import { shownGames } from '$lib/stores/me';

  let filter = $state<GameKind | 'all'>('all');
  const games = $derived($shownGames.filter((g) => filter === 'all' || g.kind === filter));
  const letter = (g: SavedGame) => ({ won: 'W', lost: 'L', draw: 'D', unfinished: '–' })[outcome(g)];
  const moves = (g: SavedGame) => Math.ceil(g.uci.length / 2);
</script>

<svelte:head><title>My games · Chess Castles</title></svelte:head>

<div class="page">
  <header>
    <h1 class="display">My games</h1>
    <p class="label">{$session.status === 'in' ? 'Your games on every device where you sign in.' : 'Kept in this browser. Sign in to have them on every device.'} Open one to go through it with the engine and the FIDE games database.</p>
    {#if $session.status === 'in'}
      <p class="sync label" role="status">
        {#if $syncState.status === 'syncing'}Syncing your games with your account…
        {:else if $syncState.status === 'done'}Synced with your account{$syncState.added ? ` · ${$syncState.added} new from your other devices` : ''}.
        {:else if $syncState.status === 'error'}<span class="bad">Couldn't sync: {$syncState.message}</span>{/if}
        {#if $syncState.status !== 'syncing'}<button class="link" onclick={() => $session.status === 'in' && syncGames($session.uid)}>Sync now</button>{/if}
      </p>
    {/if}
  </header>

  <div class="chips" role="group" aria-label="Show">
    <button class="chip" aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
    {#each ['fide', 'computer', 'lichess'] as const as k (k)}
      <button class="chip" aria-pressed={filter === k} onclick={() => (filter = k)}>{KIND_LABEL[k]}</button>
    {/each}
  </div>

  {#if !games.length}
    <div class="empty card">
      <Icon name="history" size={34} color="var(--muted)" />
      <p>{$shownGames.length ? 'No games of this kind yet.' : 'Games you play on this site appear here.'}</p>
      <a class="btn primary" href="/play">Play a game</a>
    </div>
  {:else}
    <ul class="list">
      {#each games as g (g.id)}
        {@const o = outcome(g)}
        <li class="item">
          <a class="open" href="/analysis?game={g.id}">
            <span class="res {o}" aria-label={o}>{letter(g)}</span>
            <span class="text">
              <span class="title who">vs {opponentOf(g)}</span>
              <span class="label">
                {KIND_LABEL[g.kind]}{g.timeControl ? ` · ${g.timeControl}` : ''} · {moves(g)} moves{g.reason ? ` · ${g.reason}` : ''}
              </span>
              <span class="label date">{formatDate(g.playedAt)}</span>
            </span>
            <Icon name="chevron" color="var(--muted)" />
          </a>
          <div class="acts">
            <a class="btn small review" href="/analysis?game={g.id}" title="Review this game: engine, database or Chess Guru"><Icon name="analyse" size={16} />Review</a>
            {#if g.result !== '*'}<ShareGame game={() => g} small />{/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .sync {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: center;
    margin: 6px 0 0;
    font-size: 13.5px;
  }
  .sync .bad {
    color: var(--loss);
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .page {
    max-width: 860px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  h1 {
    font-size: 42px;
  }
  header .label {
    margin: 6px 0 0;
    font-size: 15px;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-card);
    padding: 6px 10px 6px 6px;
  }
  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px;
    border-radius: var(--r-control);
    color: var(--text);
    text-decoration: none;
  }
  .open:hover {
    background: var(--raised);
    text-decoration: none;
  }
  .res {
    width: 42px;
    height: 42px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid currentColor;
    font-family: var(--font-title);
    font-weight: 700;
    font-size: 18px;
  }
  .res.won {
    color: var(--win);
  }
  .res.lost {
    color: var(--loss);
  }
  .res.draw {
    color: var(--accent);
  }
  .res.unfinished {
    color: var(--muted);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .who {
    font-size: 17px;
  }
  .text .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .date {
    font-size: 12.5px;
  }
  .acts {
    display: flex;
    gap: 8px;
    flex: none;
  }
  .acts :global(.btn) {
    gap: 6px;
    min-height: 38px;
    padding: 0 14px;
    font-size: 14px;
    white-space: nowrap;
  }
  /* Phones: the game on top, its buttons on their own row underneath, easy to tap. */
  @media (max-width: 640px) {
    h1 {
      font-size: 34px;
    }
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .chips > :global(*) {
      flex: none;
    }
    .item {
      flex-wrap: wrap;
      padding: 6px 6px 10px;
    }
    .open {
      flex: 1 1 100%;
    }
    .open :global(svg) {
      display: none;
    }
    .acts {
      flex: 1 1 100%;
      padding-left: 60px;
    }
    .acts > :global(*) {
      flex: 1;
      justify-content: center;
    }
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 18px;
    text-align: center;
  }
  .empty p {
    margin: 0;
    color: var(--text-2);
  }
</style>

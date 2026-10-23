<script lang="ts">
  /**
   * Every Chess Castles leaderboard in one place: CC Rating, Lichess and puzzle
   * ratings of Chess Castles players, the Blindfold Gym, study this week and books
   * read; everyone or just friends.
   */
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { fedName } from '$lib/fideFeds';
  import { friendsList } from '$lib/social';
  import { BOARDS, loadBoard, type BoardKind, type Row } from '$lib/leaderboards';

  let kind = $state<BoardKind>('kfide');
  let variant = $state('main');
  let who = $state<'all' | 'friends'>('all');
  let q = $state('');
  let rows = $state<Row[] | undefined>();
  let error = $state('');
  let friendIds = $state<Set<string> | undefined>();

  onMount(() => {
    const h = location.hash.slice(1) as BoardKind;
    if (BOARDS.some((b) => b.id === h)) pick(h);
  });

  const board = $derived(BOARDS.find((b) => b.id === kind)!);
  const needsSignIn = $derived(board.signIn && $session.status !== 'in');

  function pick(k: BoardKind) {
    kind = k;
    variant = BOARDS.find((b) => b.id === k)!.variants[0]?.id ?? '';
    history.replaceState(history.state, '', `#${k}`);
  }

  $effect(() => {
    const k = kind;
    const v = variant;
    if ($session.status === 'loading' || needsSignIn) return;
    rows = undefined;
    error = '';
    loadBoard(k, v).then(
      (r) => {
        if (kind === k && variant === v) rows = r;
      },
      (e) => ((error = e instanceof Error ? e.message : 'The leaderboard could not be loaded.'), (rows = [])),
    );
  });
  $effect(() => {
    if (who !== 'friends' || friendIds || $session.status !== 'in') return;
    friendsList().then(
      (f) => (friendIds = new Set(f.friends.map((p) => p.uid))),
      () => (friendIds = new Set()),
    );
  });

  /** Players shown, keeping their real place on the full board. */
  const shown = $derived.by(() => {
    const ranked = (rows ?? []).map((r, i) => ({ ...r, rank: i + 1 }));
    const friends = kind !== 'vision' && who === 'friends' ? ranked.filter((r) => r.me || (r.uid && friendIds?.has(r.uid))) : ranked;
    const s = q.trim().toLowerCase();
    return s ? friends.filter((r) => r.name.toLowerCase().includes(s)) : friends;
  });
  const mine = $derived(shown.find((r) => r.me));
  const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '');
  const EMPTY: Record<BoardKind, [string, string, string]> = {
    kfide: ['No CC Ratings at this speed yet.', 'Play a FIDE-level opponent', '/play?mode=fide'],
    lichess: ['No Chess Castles player has a Lichess rating at this speed yet.', 'Play online', '/play?mode=online'],
    puzzles: ['No puzzle ratings yet.', 'Solve puzzles', '/puzzles'],
    racer: ['No Puzzle Racer scores yet. Win the first race!', 'Race now', '/puzzles/racer'],
    rush: ['No Puzzle Rush scores yet. Be the first!', 'Play Puzzle Rush', '/puzzles/rush'],
    endless: ['No Rush Unlimited scores yet. Be the first!', 'Play Rush Unlimited', '/puzzles/rush?mode=unlimited'],
    vision: ['No one on this board yet.', 'Train in the Blindfold Gym', '/vision'],
    study: ['No one has studied yet this week.', 'Study now', '/learn'],
    books: ['No one has finished a chapter yet.', 'Open the library', '/books'],
  };
</script>

<svelte:head><title>Leaderboard · Chess Castles</title></svelte:head>

<div class="page">
  <header>
    <h1 class="display">Leaderboard</h1>
    <p class="label">How Chess Castles players compare: ratings, training and reading.</p>
  </header>

  <div class="tabs" role="tablist" aria-label="Leaderboard">
    {#each BOARDS as b (b.id)}
      <button role="tab" aria-selected={kind === b.id} class:on={kind === b.id} onclick={() => pick(b.id)}>{b.label}</button>
    {/each}
  </div>

  <div class="filters">
    {#if board.variants.length}
      <div class="chips" role="group" aria-label="Show">
        {#each board.variants as v (v.id)}<button class="chip" aria-pressed={variant === v.id} onclick={() => (variant = v.id)}>{v.label}</button>{/each}
      </div>
    {/if}
    {#if kind !== 'vision' && $session.status === 'in'}
      <div class="chips" role="group" aria-label="Who">
        <button class="chip" aria-pressed={who === 'all'} onclick={() => (who = 'all')}>Everyone</button>
        <button class="chip" aria-pressed={who === 'friends'} onclick={() => (who = 'friends')}><Icon name="users" size={14} />Friends</button>
      </div>
    {/if}
    <label class="search">
      <Icon name="search" size={16} color="var(--muted)" />
      <input bind:value={q} placeholder="Find a player" aria-label="Find a player on the leaderboard" />
    </label>
  </div>

  {#if needsSignIn}
    <div class="card empty">
      <p>This leaderboard is for Chess Castles players. Sign in to see where you stand.</p>
      <div class="row">
        <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
        <button class="btn" onclick={() => pick('vision')}>See the Blindfold Gym board</button>
      </div>
    </div>
  {:else if error}
    <p class="card empty">{error}</p>
  {:else if !rows}
    <div class="card skel"></div>
  {:else}
    {#if mine && !q}
      <div class="mine card"><span class="rank num">#{mine.rank}</span><span>That's you: <strong class="num">{mine.value}</strong> {kind === 'puzzles' && variant === 'solved' ? 'puzzles solved' : board.unit}</span></div>
    {/if}
    <ol class="board card" aria-label="{board.label} leaderboard">
      {#each shown as r (r.key)}
        <li class:me={r.me}>
          <span class="rank num">{medal(r.rank) || r.rank}</span>
          <svelte:element this={r.uid ? 'a' : 'span'} class="who" href={r.uid ? `/players/${encodeURIComponent(r.uid)}` : undefined}>
            {#if r.title}<span class="ttl">{r.title}</span>{/if}
            <strong>{r.name}</strong>
            {#if r.plan}<PlanBadge plan={r.plan} />{/if}
            {#if r.country}<img class="flag" src="/flags/{r.country}.svg" alt={fedName(r.country)} title={fedName(r.country)} width="18" height="12" />{/if}
          </svelte:element>
          <span class="sub label">{r.sub ?? ''}</span>
          <strong class="val num">{r.value}</strong>
        </li>
      {:else}
        <li class="none">
          <span class="label">{q ? `No one called “${q}” on this board.` : who === 'friends' ? 'None of your friends is on this board yet.' : EMPTY[kind][0]}</span>
          {#if !q && who === 'all'}<a class="btn small" href={EMPTY[kind][2]}>{EMPTY[kind][1]}</a>{/if}
        </li>
      {/each}
    </ol>
    {#if kind === 'lichess'}<p class="label foot">Lichess ratings of the players who use Chess Castles.</p>{/if}
    {#if kind === 'puzzles'}<p class="label foot">Puzzles solved on Chess Castles, and the puzzle rating here.</p>{/if}
    {#if kind === 'study'}<p class="label foot">Points from puzzles, lessons, games and reading, Monday to Sunday.</p>{/if}
  {/if}
</div>

<style>
  .page {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 40px;
  }
  header p {
    margin: 4px 0 0;
  }
  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
    scrollbar-width: none;
    /* A fade at the right edge shows there are more tabs to swipe to. */
    mask-image: linear-gradient(90deg, #000 88%, transparent);
    padding-right: 24px;
  }
  .tabs button {
    flex: none;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-weight: 700;
    padding: 10px 14px;
    border-bottom: 3px solid transparent;
    cursor: pointer;
  }
  .tabs button.on {
    color: var(--text);
    border-bottom-color: var(--gold);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    border-radius: 999px;
    padding: 6px 12px;
    font: inherit;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
  .chip[aria-pressed='true'] {
    background: var(--action);
    color: var(--on-action);
    border-color: transparent;
  }
  .search {
    flex: 1 1 180px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--raised);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    padding: 7px 0;
    outline: none;
  }
  .empty {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .empty p {
    margin: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .skel {
    height: 320px;
  }
  .mine {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-color: var(--gold);
  }
  .board {
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }
  .board li {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto 64px;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
  }
  .board li:first-child {
    border-top: 0;
  }
  .board li.me {
    background: color-mix(in srgb, var(--gold) 12%, transparent);
  }
  .board li.none {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 18px 16px;
  }
  .small {
    min-height: 36px;
    padding: 0 14px;
  }
  .rank {
    font-weight: 800;
    font-size: 17px;
    text-align: center;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--text);
    text-decoration: none;
    overflow: hidden;
    white-space: nowrap;
  }
  .ttl {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--gold);
    color: #1b1300;
  }
  .flag {
    border-radius: 2px;
  }
  .val {
    text-align: right;
    font-size: 18px;
  }
  .foot {
    margin: 0;
  }
  @media (max-width: 520px) {
    .board li {
      grid-template-columns: 34px minmax(0, 1fr) 56px;
    }
    .sub {
      display: none;
    }
  }
</style>

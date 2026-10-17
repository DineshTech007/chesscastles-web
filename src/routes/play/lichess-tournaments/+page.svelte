<script lang="ts">
  /** Lichess arena tournaments happening now and soon; rapid and classical ones can be played from Chess Castles. */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { arenas, type Arena } from '$lib/lichess';

  let list = $state<Arena[] | undefined>();
  let error = $state('');
  let now = $state(Date.now());

  onMount(() => {
    arenas().then(
      (a) => (list = a),
      (e) => (error = e instanceof Error ? e.message : 'Tournaments could not be loaded.'),
    );
    const t = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(t);
  });

  const playable = $derived((list ?? []).filter((a) => a.playable));
  const others = $derived((list ?? []).filter((a) => !a.playable));
  const when = (a: Arena) => {
    if (a.status === 'started') {
      const m = Math.max(0, Math.round((a.finishesAt - now) / 60000));
      return `Live · ${m} min left`;
    }
    const m = Math.max(0, Math.round((a.startsAt - now) / 60000));
    return m < 60 ? `Starts in ${m} min` : `Starts at ${new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };
</script>

<svelte:head><title>Arena tournaments · Chess Castles</title></svelte:head>

{#snippet row(a: Arena)}
  <a class="arena card" href="/play/lichess-tournaments/{a.id}">
    <span class="tc num">{a.minutes}+{a.increment}</span>
    <span class="info">
      <strong>{a.name}</strong>
      <span class="label">{a.speed[0]?.toUpperCase() + a.speed.slice(1)} · {a.players} players{a.rated ? ' · rated' : ''}</span>
    </span>
    <span class="when" class:live={a.status === 'started'}>{when(a)}</span>
    <Icon name="chevron" color="var(--muted)" />
  </a>
{/snippet}

<div class="page">
  <a class="back" href="/play?mode=online"><Icon name="back" size={16} />Play online</a>
  <header>
    <h1 class="display">Arena tournaments</h1>
    <p class="label">Play as many games as you can before the clock runs out. Wins in a row score double.</p>
  </header>

  {#if error}
    <p class="card">{error}</p>
  {:else if !list}
    <div class="card skel"></div>
  {:else}
    <section>
      <h2 class="title">Join</h2>
      {#if !playable.length}<p class="label card">No arena open to join right now. A new one starts every hour.</p>{/if}
      <div class="list">{#each playable as a (a.id)}{@render row(a)}{/each}</div>
    </section>
    <section>
      <h2 class="title">Watch live</h2>
      <div class="list">{#each others.slice(0, 20) as a (a.id)}{@render row(a)}{/each}</div>
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 36px;
  }
  header p {
    margin: 0;
    max-width: 70ch;
  }
  section h2 {
    margin: 0 0 8px;
    font-size: 19px;
  }
  section > p {
    margin: 0 0 8px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .arena {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    color: var(--text);
    text-decoration: none;
  }
  .arena:hover {
    outline: 1px solid var(--brand);
  }
  .tc {
    width: 62px;
    flex: none;
    font-weight: 800;
    font-size: 18px;
    text-align: center;
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .when {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    white-space: nowrap;
  }
  .when.live {
    color: var(--loss);
  }
  .skel {
    height: 300px;
  }
  @media (max-width: 520px) {
    .when {
      display: none;
    }
  }
</style>

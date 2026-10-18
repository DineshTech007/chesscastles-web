<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { formatClock } from '$lib/format';
  import {
    broadcastRound,
    broadcastTour,
    runningClock,
    type BroadcastGame,
    type BroadcastPlayer,
    type BroadcastRound,
    type BroadcastTour,
  } from '$lib/lichess';

  let tour = $state<BroadcastTour | undefined>();
  let round = $state<BroadcastRound | undefined>();
  let games = $state<BroadcastGame[] | undefined>();
  let error = $state('');
  let timer: ReturnType<typeof setInterval> | undefined;
  // The clocks of the side to move run on between refreshes.
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 250);

  onMount(async () => {
    try {
      tour = await broadcastTour(page.params.tour!);
      const wanted = page.url.searchParams.get('round');
      const pick =
        tour.rounds.find((r) => r.id === wanted) ??
        tour.rounds.find((r) => r.id === tour!.defaultRoundId) ??
        tour.rounds.find((r) => r.ongoing) ??
        tour.rounds.findLast((r) => r.finished) ??
        tour.rounds[0];
      if (pick) await choose(pick);
    } catch {
      error = 'This tournament could not be loaded. Check your connection and try again.';
    }
  });
  onDestroy(() => {
    clearInterval(timer);
    clearInterval(tick);
  });

  async function choose(r: BroadcastRound) {
    round = r;
    games = undefined;
    clearInterval(timer);
    await refresh();
    // While a round is being played, refresh the boards every 15 seconds.
    if (!r.finished) timer = setInterval(refresh, 15_000);
    history.replaceState(history.state, '', `?round=${r.id}`);
  }

  async function refresh() {
    if (!tour || !round) return;
    try {
      games = await broadcastRound(tour, round);
    } catch {
      games ??= [];
    }
  }

  const live = $derived(games?.some((g) => g.status === '*') ?? false);
  const lastMove = (g: BroadcastGame) => (g.lastMove ? ([g.lastMove.slice(0, 2), g.lastMove.slice(2, 4)] as Key[]) : undefined);
  const name = (p: BroadcastPlayer) => `${p.title ? p.title + ' ' : ''}${p.name}`;
  const toMove = (g: BroadcastGame) => (g.fen.split(' ')[1] === 'b' ? 'black' : 'white');
  /** A player's clock: running for the side to move. */
  const clockOf = (g: BroadcastGame, side: 'white' | 'black') => {
    const cs = g[side].clock;
    if (cs === undefined) return undefined;
    return toMove(g) === side ? runningClock(cs * 10, g, now) : cs * 10;
  };
  const previous = $derived(tour && round ? tour.rounds[tour.rounds.findIndex((r) => r.id === round!.id) - 1] : undefined);
</script>

<svelte:head><title>{tour?.name ?? 'Tournament'} · Watch · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/watch"><Icon name="back" size={16} />Watch</a>
  {#if error}
    <div class="card">{error}</div>
  {:else if !tour}
    <div class="hero skeleton"></div>
  {:else}
    <header class="hero">
      {#if tour.image}<img src={tour.image} alt="" />{/if}
      <div class="hero-text">
        <h1 class="title t-name">{tour.name}</h1>
        <p class="label">{[tour.location, tour.format, tour.timeControl].filter(Boolean).join(' · ')}</p>
      </div>
      {#if live}<span class="pill live"><span class="dot"></span>Live</span>{/if}
    </header>

    <div class="rounds" role="tablist" aria-label="Rounds">
      {#each tour.rounds as r (r.id)}
        <button role="tab" aria-selected={round?.id === r.id} class="chip" class:on={round?.id === r.id} onclick={() => choose(r)}>
          {r.name}{#if r.ongoing}<span class="live-dot" title="Live"></span>{/if}
        </button>
      {/each}
    </div>

    {#if !games}
      <div class="grid">{#each Array(8) as _, i (i)}<div class="g skeleton"></div>{/each}</div>
    {:else if !games.length}
      <div class="card">
        {#if round?.startsAt && round.startsAt > Date.now()}
          This round starts {new Date(round.startsAt).toLocaleString('en-IN', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}.
        {:else if round?.ongoing}
          The organisers haven't sent the boards of this round yet. They appear here as soon as they do; this page checks every 15 seconds.
        {:else}
          No games in this round.
        {/if}
        {#if previous}<button class="link prev" onclick={() => choose(previous!)}>See {previous.name}</button>{/if}
      </div>
    {:else}
      <div class="grid">
        {#each games as g (g.id)}
          <a class="g" href="/watch/{tour.id}/{round?.id}/{g.id}">
            <div class="pl">
              <span class="who">{name(g.black)}{#if g.black.rating}<span class="label"> {g.black.rating}</span>{/if}</span>
              {#if g.status === '*' && g.black.clock !== undefined}<span class="clk num" class:on={toMove(g) === 'black'}>{formatClock(clockOf(g, 'black')!)}</span>{/if}
            </div>
            <Board fen={g.fen} viewOnly coordinates={false} lastMove={lastMove(g)} label="{g.white.name} against {g.black.name}" />
            <div class="pl">
              <span class="who">{name(g.white)}{#if g.white.rating}<span class="label"> {g.white.rating}</span>{/if}</span>
              {#if g.status === '*' && g.white.clock !== undefined}
                <span class="clk num" class:on={toMove(g) === 'white'}>{formatClock(clockOf(g, 'white')!)}</span>
              {:else if g.status !== '*'}
                <span class="result title">{g.status}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
    <p class="label src">Live games from <a href={tour.url} target="_blank" rel="noopener">Lichess broadcasts</a>.</p>
  {/if}
</div>

<style>
  .page {
    max-width: 1180px;
    margin: 8px auto 0;
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
    align-self: flex-start;
  }
  .hero {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-panel);
    padding: 14px;
  }
  .hero.skeleton {
    height: 110px;
  }
  .hero img {
    width: 200px;
    aspect-ratio: 2 / 1;
    object-fit: cover;
    border-radius: 12px;
  }
  .hero-text {
    flex: 1;
    min-width: 220px;
  }
  .t-name {
    font-size: 24px;
  }
  .hero-text .label {
    margin: 4px 0 0;
  }
  .dot,
  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--live);
    display: inline-block;
  }
  .live-dot {
    margin-left: 6px;
  }
  .rounds {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .rounds .chip {
    flex: none;
    display: inline-flex;
    align-items: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 16px;
  }
  .g {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: var(--r-card);
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .g:hover {
    border-color: var(--brand);
    transform: translateY(-2px);
    text-decoration: none;
  }
  .g.skeleton {
    aspect-ratio: 0.82;
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
  .pl {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-size: 13.5px;
    min-height: 26px;
  }
  .who {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clk {
    font-family: var(--font-title);
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 6px;
    background: var(--raised);
  }
  .clk.on {
    background: var(--action);
    color: var(--on-action);
  }
  .result {
    font-size: 15px;
  }
  .src {
    margin: 0;
  }
  .prev {
    display: block;
    margin-top: 10px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>

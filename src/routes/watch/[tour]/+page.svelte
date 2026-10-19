<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { formatClock } from '$lib/format';
  import {
    broadcastRound,
    broadcastStandings,
    broadcastTour,
    runningClock,
    type BroadcastGame,
    type BroadcastPlayer,
    type BroadcastRound,
    type BroadcastStanding,
    type BroadcastTour,
  } from '$lib/lichess';

  let tour = $state<BroadcastTour | undefined>();
  let round = $state<BroadcastRound | undefined>();
  let games = $state<BroadcastGame[] | undefined>();
  let error = $state('');
  /** The boards of a round, or the standings (who won, with the score table). */
  let view = $state<'games' | 'standings'>('games');
  let standings = $state<BroadcastStanding[] | undefined>();
  let standingsAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  // The clocks of the side to move run on between refreshes.
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 250);

  onMount(async () => {
    try {
      tour = await broadcastTour(page.params.tour!);
      const wanted = page.url.searchParams.get('round');
      // A finished event opens on its result (unless a round was asked for); the standings load either way.
      const ended = tour.rounds.length > 0 && tour.rounds.every((r) => r.finished);
      if (page.url.searchParams.get('view') === 'standings' || (ended && !wanted)) view = 'standings';
      void loadStandings();
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

  async function loadStandings(force = false) {
    if (!tour || (!force && standings && Date.now() - standingsAt < 60_000)) return;
    standingsAt = Date.now();
    standings = await broadcastStandings(tour).catch(() => standings ?? []);
  }

  function show(v: 'games' | 'standings') {
    view = v;
    if (v === 'standings') void loadStandings();
    history.replaceState(history.state, '', v === 'standings' ? '?view=standings' : round ? `?round=${round.id}` : '?');
  }

  async function choose(r: BroadcastRound) {
    view = 'games';
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
  const finished = $derived(!!tour && tour.rounds.length > 0 && tour.rounds.every((r) => r.finished));
  const podium = $derived(finished && standings ? standings.filter((p) => p.rank <= 3).slice(0, 3) : []);
  /** Each side's points in a finished game: 1, ½ or 0. */
  const points = (g: BroadcastGame, side: 'white' | 'black') =>
    g.status === '1-0' ? (side === 'white' ? '1' : '0') : g.status === '0-1' ? (side === 'black' ? '1' : '0') : g.status === '*' ? '' : '½';
  const won = (g: BroadcastGame, side: 'white' | 'black') => points(g, side) === '1';
  const pts = (n: number) => (Number.isInteger(n) ? String(n) : `${Math.floor(n) || ''}½`);
  const medal = ['🥇', '🥈', '🥉'];
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

    {#if podium.length}
      <section class="podium" aria-label="Final result">
        {#each podium as p, i (p.name)}
          <div class="pod" class:first={p.rank === 1}>
            <span class="medal" aria-hidden="true">{medal[p.rank - 1] ?? medal[i]}</span>
            <span class="label">{p.rank === 1 ? 'Winner' : p.rank === 2 ? 'Second' : 'Third'}</span>
            <strong class="pn">{p.title ? `${p.title} ` : ''}{p.name}</strong>
            <span class="num ps">{pts(p.score)}<span class="label"> / {p.played}</span></span>
          </div>
        {/each}
      </section>
    {/if}

    <div class="views" role="tablist" aria-label="Show">
      <button role="tab" aria-selected={view === 'games'} class:on={view === 'games'} onclick={() => show('games')}><Icon name="knight" size={16} />Games</button>
      <button role="tab" aria-selected={view === 'standings'} class:on={view === 'standings'} onclick={() => show('standings')}><Icon name="trophy" size={16} />{finished ? 'Final standings' : 'Standings'}</button>
    </div>

    {#if view === 'standings'}
      <section class="card stand-card">
        {#if !standings}
          <div class="g skeleton stand-skel"></div>
        {:else if !standings.length}
          <p class="label">No results yet: the standings appear once the first games are over.</p>
        {:else}
          <table class="stand">
            <thead>
              <tr><th>#</th><th class="pl-h">Player</th><th>Rating</th><th>Points</th><th class="wide">Games</th><th class="wide">Perf.</th><th>±</th></tr>
            </thead>
            <tbody>
              {#each standings as p (p.name)}
                <tr class:top={p.rank <= 3 && finished}>
                  <td class="num rk">{finished && p.rank <= 3 ? medal[p.rank - 1] : p.rank}</td>
                  <td class="pn-cell">{#if p.title}<span class="ttl">{p.title}</span>{/if}{p.name}{#if p.fed}<span class="label fed"> {p.fed}</span>{/if}</td>
                  <td class="num">{p.rating ?? '–'}</td>
                  <td class="num sc">{pts(p.score)}</td>
                  <td class="num wide">{p.played}</td>
                  <td class="num wide">{p.perf ?? '–'}</td>
                  <td class="num" class:up={(p.diff ?? 0) > 0} class:down={(p.diff ?? 0) < 0}>{p.diff === undefined ? '–' : p.diff > 0 ? `+${p.diff}` : p.diff}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    {:else}
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
              <span class="who" class:win={won(g, 'black')}>{name(g.black)}{#if g.black.rating}<span class="label"> {g.black.rating}</span>{/if}</span>
              {#if g.status === '*' && g.black.clock !== undefined}<span class="clk num" class:on={toMove(g) === 'black'}>{formatClock(clockOf(g, 'black')!)}</span>
              {:else if g.status !== '*'}<span class="result title" class:win={won(g, 'black')}>{points(g, 'black')}</span>{/if}
            </div>
            <Board fen={g.fen} viewOnly coordinates={false} lastMove={lastMove(g)} label="{g.white.name} against {g.black.name}" />
            <div class="pl">
              <span class="who" class:win={won(g, 'white')}>{name(g.white)}{#if g.white.rating}<span class="label"> {g.white.rating}</span>{/if}</span>
              {#if g.status === '*' && g.white.clock !== undefined}
                <span class="clk num" class:on={toMove(g) === 'white'}>{formatClock(clockOf(g, 'white')!)}</span>
              {:else if g.status !== '*'}
                <span class="result title" class:win={won(g, 'white')}>{points(g, 'white')}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
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
    min-width: 18px;
    text-align: right;
    color: var(--text-2);
  }
  .result.win,
  .who.win {
    color: var(--gold);
  }
  .views {
    display: flex;
    gap: 6px;
    padding: 4px;
    border-radius: 999px;
    background: var(--raised);
    align-self: flex-start;
  }
  .views button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--text-2);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .views button.on {
    background: var(--card);
    color: var(--text);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .podium {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .pod {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 14px 10px;
    border-radius: var(--r-card);
    background: var(--card);
    border: 1px solid var(--border);
    text-align: center;
    min-width: 0;
  }
  .pod.first {
    border: 2px solid var(--gold);
    background: radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--gold) 22%, transparent), var(--card) 70%);
  }
  .medal {
    font-size: 30px;
  }
  .pod.first .medal {
    font-size: 40px;
  }
  .pn {
    font-size: 16px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ps {
    font-family: var(--font-title);
    font-size: 22px;
    font-weight: 800;
  }
  .stand-card {
    padding: 6px 4px;
    overflow-x: auto;
  }
  .stand-skel {
    height: 260px;
    aspect-ratio: auto;
  }
  .stand {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .stand th {
    text-align: right;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-2);
    padding: 6px 8px;
  }
  .stand th.pl-h {
    text-align: left;
  }
  .stand td {
    padding: 8px;
    border-top: 1px solid var(--border);
    text-align: right;
    white-space: nowrap;
  }
  .stand td.rk {
    text-align: center;
    font-weight: 800;
    width: 34px;
  }
  .stand td.pn-cell {
    text-align: left;
    font-weight: 600;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stand tr.top td {
    background: color-mix(in srgb, var(--gold) 8%, transparent);
  }
  .stand td.sc {
    font-weight: 800;
    font-size: 15px;
  }
  .ttl {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 5px;
    margin-right: 5px;
    border-radius: 4px;
    background: var(--gold);
    color: #1b1300;
  }
  .fed {
    font-size: 11.5px;
  }
  .up {
    color: var(--win);
  }
  .down {
    color: var(--loss);
  }
  @media (max-width: 600px) {
    .stand .wide {
      display: none;
    }
    .stand td,
    .stand th {
      padding: 7px 5px;
    }
    .stand td.pn-cell {
      max-width: 150px;
    }
    .podium {
      gap: 6px;
    }
    .pod {
      padding: 10px 4px;
    }
    .pn {
      font-size: 13px;
      white-space: normal;
      line-height: 1.2;
    }
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

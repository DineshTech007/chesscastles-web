<script lang="ts">
  /**
   * One Lichess arena: standings, the top game (watch live), and for rapid
   * and classical arenas, join and play here: while this page is open,
   * Lichess's pairings open the game on Chess Castles.
   */
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import { arena, type ArenaInfo } from '$lib/lichess';
  import * as api from '$lib/lichessBoard';
  import { lichessToken, session, startSignIn } from '$lib/auth';

  const id = page.params.id!;
  let t = $state<ArenaInfo | undefined>();
  let error = $state('');
  let joined = $state(false);
  let busy = $state(false);
  let joinError = $state('');
  let needsPermission = $state(false);
  let now = $state(Date.now());
  let events: AbortController | undefined;

  const load = () =>
    arena(id).then(
      (a) => (t = a),
      (e) => (error = e instanceof Error ? e.message : 'This tournament could not be loaded.'),
    );

  onMount(() => {
    void load();
    const r = setInterval(load, 20_000);
    const c = setInterval(() => (now = Date.now()), 1000);
    return () => {
      clearInterval(r);
      clearInterval(c);
    };
  });
  onDestroy(() => events?.abort());

  /** While joined, a new tournament game opens on the board here. */
  function listen(token: string) {
    events?.abort();
    events = new AbortController();
    void api
      .streamEvents(
        token,
        (e) => {
          if (e.type === 'gameStart' && (!e.game?.tournamentId || e.game.tournamentId === id)) goto(`/play/online/${e.game.gameId}?c=${e.game.color}&t=${id}`);
        },
        events.signal,
      )
      .catch(() => {});
  }

  async function join() {
    const token = lichessToken()?.token;
    if (!token) return startSignIn();
    busy = true;
    joinError = '';
    try {
      await api.joinTournament(token, id);
      joined = true;
      listen(token);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (/scope|permission|403|401/i.test(m)) needsPermission = true;
      else joinError = m || 'Lichess did not let you join.';
    } finally {
      busy = false;
    }
  }

  async function leave() {
    const token = lichessToken()?.token;
    events?.abort();
    joined = false;
    if (token) await api.withdrawTournament(token, id).catch(() => {});
  }

  // Back from a game: still in the tournament.
  onMount(() => {
    if (page.url.searchParams.get('joined')) {
      joined = true;
      const token = lichessToken()?.token;
      if (token) listen(token);
    }
  });

  const clock = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
</script>

<svelte:head><title>{t?.name ?? 'Tournament'} · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/play/lichess-tournaments"><Icon name="back" size={16} />Lichess tournaments</a>
  {#if error}
    <p class="card">{error}</p>
  {:else if !t}
    <div class="card skel"></div>
  {:else}
    <section class="card head">
      <div class="h-main">
        <span class="label">{t.minutes}+{t.increment} · {t.speed} · {t.players} players{t.rated ? ' · rated' : ''}</span>
        <h1 class="display">{t.name}</h1>
      </div>
      <div class="timer">
        {#if t.status === 'started'}<span class="label">Ends in</span><strong class="num">{clock(t.finishesAt - now)}</strong>
        {:else if t.status === 'created'}<span class="label">Starts in</span><strong class="num">{clock(t.startsAt - now)}</strong>
        {:else}<strong>Finished</strong>{/if}
      </div>
    </section>

    {#if t.status !== 'finished'}
      <section class="card action">
        {#if !t.playable}
          <p>Watch the standings and the top game live.</p>
        {:else if $session.status !== 'in'}
          <p>Sign in to play in this arena.</p>
          <button class="btn primary" onclick={() => startSignIn()}>Sign in with Lichess</button>
        {:else if needsPermission}
          <p>To join tournaments, Chess Castles needs one more permission from Lichess. Sign in again and allow “Create, update, and join tournaments”.</p>
          <button class="btn primary" onclick={() => startSignIn()}>Sign in again</button>
        {:else if joined}
          <p class="ok"><span class="pulse"></span><strong>You're in.</strong> Keep this page open: when Lichess pairs you, your game opens here. After each game, come back for the next one.</p>
          <button class="btn" onclick={leave}>Pause (leave the arena)</button>
        {:else}
          <p>Play as many games as you can until the arena ends. Each win is 2 points, a draw 1, and after two wins in a row you score double.</p>
          <button class="btn primary big" disabled={busy} onclick={join}><Icon name="play" size={18} fill color="currentColor" />{busy ? 'Joining…' : 'Join and play'}</button>
          {#if joinError}<p class="err">{joinError}</p>{/if}
        {/if}
      </section>
    {/if}

    {#if t.featured}
      <a class="card featured" href="/watch/live/{t.featured.id}">
        <span class="pulse"></span>
        <span><strong>Top game</strong><span class="label">{t.featured.white} vs {t.featured.black}</span></span>
        <span class="watch">Watch live <Icon name="chevron" size={14} /></span>
      </a>
    {/if}

    <section class="card">
      <h2 class="title">Standings</h2>
      {#if !t.standings.length}<p class="label">No one has scored yet.</p>{/if}
      <ol class="stand">
        {#each t.standings as p (p.rank)}
          <li>
            <span class="rk num">{p.rank}</span>
            <span class="nm">{#if p.title}<span class="ttl">{p.title}</span>{/if}{p.name} <span class="label num">{p.rating}</span></span>
            <strong class="num sc">{p.fire ? '🔥 ' : ''}{p.score}</strong>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .head h1 {
    margin: 2px 0 0;
    font-size: 30px;
  }
  .timer {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .timer strong {
    font-size: 30px;
  }
  .action {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    border-color: var(--gold);
  }
  .action p {
    margin: 0;
  }
  .big {
    min-height: 48px;
    gap: 8px;
  }
  .ok {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .err {
    color: var(--loss);
  }
  .pulse {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 50%;
    background: var(--loss);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
  .featured {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
  }
  .featured > span:nth-child(2) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .watch {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-weight: 700;
    color: var(--accent);
  }
  .stand {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .stand li {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .rk {
    font-weight: 800;
    text-align: center;
  }
  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .sc {
    font-size: 17px;
  }
  .skel {
    height: 300px;
  }
</style>

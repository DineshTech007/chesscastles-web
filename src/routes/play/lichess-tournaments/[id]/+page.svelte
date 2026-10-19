<script lang="ts">
  /**
   * One Lichess arena: standings (with your own place), the top game (watch live), and for rapid and classical
   * arenas, join and play here. Lichess pairs an app's player only while the app says they are present
   * (`pairMeAsap`, good for 70 seconds), so while you wait this page says so every 50 seconds; when Lichess
   * pairs you, the game opens by itself (anywhere on the site), and after it you come back here for the next.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import { arena, type ArenaInfo, type ArenaStanding } from '$lib/lichess';
  import * as api from '$lib/lichessBoard';
  import { lichessToken, session, startLichessSignIn } from '$lib/auth';
  import { followArena, syncLichessEvents } from '$lib/lichessEvents';

  const id = page.params.id!;
  let t = $state<ArenaInfo | undefined>();
  /** The ten around your place, when you are not in the top ten. */
  let around = $state<ArenaStanding[]>([]);
  let error = $state('');
  let joined = $state(!!page.url.searchParams.get('joined'));
  let busy = $state(false);
  let joinError = $state('');
  let needsPermission = $state(false);
  let now = $state(Date.now());
  let waitingSince = $state(Date.now());
  let lastPing = 0;
  const myId = () => lichessToken()?.username.toLowerCase();
  const isMe = (p: ArenaStanding) => p.name.toLowerCase() === myId();
  const myRow = $derived([...(t?.standings ?? []), ...around].find(isMe));

  async function load() {
    const token = lichessToken()?.token;
    try {
      // With your token Lichess also says where you stand; a token it refuses still lets everyone watch.
      const a = await arena(id, token).catch((e) => (token ? arena(id) : Promise.reject(e)));
      if (token && !busy) {
        const inIt = !!a.me && !a.me.withdraw;
        if (inIt && !joined) waitingSince = Date.now();
        joined = inIt;
      }
      // Back from a game: waiting again from now.
      if (t?.me?.gameId && !a.me?.gameId) waitingSince = Date.now();
      t = a;
      around = a.me && a.me.rank > 10 ? ((await arena(id, token, Math.ceil(a.me.rank / 10)).catch(() => undefined))?.standings ?? []) : [];
    } catch (e) {
      if (!t) error = e instanceof Error ? e.message : 'This tournament could not be loaded.';
    }
  }

  /** "Still here, pair me": while you are in, the arena runs and you are not in a game. */
  async function ping(force = false) {
    const token = lichessToken()?.token;
    if (!token || !joined || !t || t.status === 'finished' || t.me?.gameId) return;
    if (!force && Date.now() - lastPing < 50_000) return;
    lastPing = Date.now();
    try {
      await api.joinTournament(token, id);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (/scope|permission|403|401/i.test(m)) needsPermission = true;
      else if (m) joinError = m;
    }
  }

  onMount(() => {
    void load().then(() => {
      if (joined) {
        followArena(id);
        syncLichessEvents();
        void ping(true);
      }
    });
    const r = setInterval(load, 20_000);
    const c = setInterval(() => {
      now = Date.now();
      void ping();
    }, 1000);
    return () => {
      clearInterval(r);
      clearInterval(c);
    };
  });

  async function join() {
    const token = lichessToken()?.token;
    if (!token) return startLichessSignIn($session.status === 'in');
    busy = true;
    joinError = '';
    try {
      followArena(id);
      syncLichessEvents();
      await api.joinTournament(token, id);
      lastPing = Date.now();
      joined = true;
      waitingSince = Date.now();
      void load();
    } catch (e) {
      followArena(undefined);
      const m = e instanceof Error ? e.message : '';
      if (/scope|permission|403|401/i.test(m)) needsPermission = true;
      else joinError = m || 'Lichess did not let you join.';
    } finally {
      busy = false;
    }
  }

  async function leave() {
    const token = lichessToken()?.token;
    followArena(undefined);
    joined = false;
    if (token) await api.withdrawTournament(token, id).catch(() => {});
    void load();
  }

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
        {:else if $session.status !== 'in' || !lichessToken()}
          <p>{$session.status === 'in' ? 'Connect your free Lichess account to play in this arena.' : 'Sign in to play in this arena.'}</p>
          <button class="btn primary" onclick={() => startLichessSignIn($session.status === 'in')}>{$session.status === 'in' ? 'Connect your Lichess account' : 'Sign in with Lichess'}</button>
        {:else if needsPermission}
          <p>To join tournaments, Chess Castles needs one more permission from Lichess. Sign in again and allow “Create, update, and join tournaments”.</p>
          <button class="btn primary" onclick={() => startLichessSignIn($session.status === 'in')}>Sign in again</button>
        {:else if joined}
          {#if t.me?.gameId}
            <p class="ok"><span class="pulse"></span><strong>Your game is on!</strong></p>
            <a class="btn primary big" href="/play/online/{t.me.gameId}?t={id}"><Icon name="play" size={18} fill color="currentColor" />Open your game</a>
          {:else if t.status === 'created'}
            <p class="ok"><span class="pulse"></span><span><strong>You're in.</strong> The arena starts in {clock(t.startsAt - now)}. Keep this page open: your first game opens by itself.</span></p>
          {:else}
            <p class="ok"><span class="spin" aria-hidden="true"></span><span><strong>Finding your next opponent…</strong> <span class="num">{clock(now - waitingSince)}</span><br /><span class="label">Keep this page open: Lichess pairs you as soon as another player is free, and the game opens by itself.</span></span></p>
          {/if}
          {#if myRow}<p class="mine">Your place: <strong class="num">#{myRow.rank}</strong> · <strong class="num">{myRow.score}</strong> points{myRow.fire ? ' 🔥' : ''}</p>{/if}
          {#if joinError}<p class="err">{joinError}</p>{/if}
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
          {@render row(p)}
        {/each}
      </ol>
      {#if around.length}
        <p class="gap label" aria-hidden="true">⋯</p>
        <ol class="stand">
          {#each around as p (p.rank)}
            {@render row(p)}
          {/each}
        </ol>
      {/if}
    </section>
  {/if}
</div>

{#snippet row(p: ArenaStanding)}
  <li class:me={isMe(p)}>
    <span class="rk num">{p.rank}</span>
    <span class="nm">{#if p.title}<span class="ttl">{p.title}</span>{/if}{p.name}{#if isMe(p)} <span class="you">You</span>{/if} <span class="label num">{p.rating}</span></span>
    <strong class="num sc">{p.fire ? '🔥 ' : ''}{p.score}</strong>
  </li>
{/snippet}

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
  .ok .label {
    font-size: 13.5px;
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
  .stand li.me {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    border-radius: 8px;
  }
  .you {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--accent);
    color: #1b1300;
  }
  .gap {
    margin: 2px 0;
    text-align: center;
  }
  .mine {
    font-size: 15px;
  }
  .spin {
    width: 16px;
    height: 16px;
    flex: none;
    border-radius: 50%;
    border: 3px solid var(--border);
    border-top-color: var(--gold);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .skel {
    height: 300px;
  }
</style>

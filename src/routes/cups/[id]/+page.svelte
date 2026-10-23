<script lang="ts">
  /**
   * A Castle Cup as it happens (src/lib/cups): before the start, the countdown and who's in; during it, the child's
   * own game (clocks, premoves; the computer player's moves come from this page), the break between rounds, and the
   * standings; at the end, the podium and each group's best. A child who isn't playing a round watches the top
   * board. Keeping the page open is what puts a child in the next round.
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer } from '$lib/classroom/api';
  import { t } from '$lib/i18n';
  import { contentLang } from '$lib/contentLang';
  import { track } from '$lib/analytics';
  import { sounds } from '$lib/sound';
  import GameBoard from '$lib/classroom/GameBoard.svelte';
  import CupResults from '$lib/cups/CupResults.svelte';
  import { CupLive } from '$lib/cups/cup.svelte';
  import { countdown, cupTime, GROUP_NAME, joinCup, leaveCup, MIN_GAMES, parseCup, type CupGame } from '$lib/cups/api';
  import { forgetCup, rememberCup } from '$lib/cups/joined';
  import { TIME_CONTROLS } from '$lib/game/fideGame';

  const id = page.params.id ?? '';
  const info = parseCup(id);
  const me = $derived($session.status === 'in' ? $session.uid : (devPlayer() ?? ''));
  const tc = info ? (TIME_CONTROLS.find((x) => x.minutes === info.minutes && x.increment === info.inc) ?? { minutes: info.minutes, increment: info.inc, kind: 'Bullet' as const }) : TIME_CONTROLS[6];

  let live = $state<CupLive>();
  let busy = $state(false);
  let error = $state('');
  let confirmLeave = $state(false);
  function connect() {
    live?.close();
    live = info && me ? new CupLive(id, me, tc) : undefined;
  }
  // Once signed in (the page may open before sign-in has finished).
  let connectedAs = '';
  $effect(() => {
    if (me && me !== connectedAs) {
      connectedAs = me;
      connect();
    }
  });
  onDestroy(() => live?.close());

  const v = $derived(live?.view);
  const now = $derived(live?.now ?? Date.now());
  const myPlayer = $derived(v?.players.find((p) => p.uid === me));
  const inCup = $derived(!!myPlayer && !myPlayer.out);
  const myGame = $derived(live?.myGame);
  const standing = $derived(v?.standings ?? []);
  const myRank = $derived(standing.find((r) => r.uid === me));
  const status = $derived(v?.status ?? 'open');
  const canJoin = $derived(!inCup && (status === 'open' || (status === 'running' && (v?.round ?? 0) < 3)));

  /** The leaders' game this round (what a child without a game watches). */
  const topGame = $derived.by((): CupGame | undefined => {
    if (!v) return undefined;
    const rank = new Map(standing.map((r) => [r.uid, r.rank]));
    const games = v.games.filter((g) => g.round === v.round && g.black && !g.reason.startsWith('Played'));
    return [...games].sort((a, b) => Number(!!a.result) - Number(!!b.result) || Math.min(rank.get(a.white) ?? 99, rank.get(a.black) ?? 99) - Math.min(rank.get(b.white) ?? 99, rank.get(b.black) ?? 99))[0];
  });
  const shown = $derived(myGame ?? topGame);
  const tag = (uid: string) => {
    const p = v?.players.find((x) => x.uid === uid);
    return p ? String(p.rating) : '';
  };
  // A sound when my new game starts.
  let heardRound = 0;
  $effect(() => {
    if (myGame && !myGame.result && v && v.round !== heardRound) {
      heardRound = v.round;
      sounds.start();
    }
  });
  // Running and I'm in it: remembered as started (even if an admin started it early), so "back to your board"
  // shows on other pages (src/lib/cups/CupAlerts.svelte).
  let remembered = '';
  $effect(() => {
    if (!info || !inCup || status !== 'running' || remembered === id) return;
    remembered = id;
    rememberCup({ id, name: info.name, startAt: Math.min(info.startAt, Date.now()) });
  });
  // Phones: the board or the standings, one tap apart (owner, 2026-10-23: "a proper link to the standings").
  let pane = $state<'board' | 'table'>('board');

  // The countdown to the start and to each round: a tick a second for the last five seconds.
  let ticked = 0;
  $effect(() => {
    if (!v || !inCup) return;
    const at = v.status === 'open' ? v.startAt : v.status === 'running' && v.nextAt ? v.nextAt : 0;
    if (!at) return;
    const s = Math.ceil((at - now) / 1000);
    if (s >= 1 && s <= 5 && s !== ticked) {
      ticked = s;
      sounds.tick();
    }
  });

  /** My first move is due (each side has 30 s for it). */
  const firstMoveLeft = $derived.by(() => {
    const g = myGame;
    if (!g || g.result || g.moves.length >= 2) return undefined;
    const myTurn = (g.moves.length === 0) === (g.white === me);
    if (!myTurn) return undefined;
    const since = g.moves.length === 0 ? g.started : (g.clock?.at ?? g.started);
    return Math.max(0, 30_000 - (now - since));
  });

  async function join() {
    if (!me) return startSignIn();
    busy = true;
    error = '';
    try {
      await joinCup(id);
      track('feature', `cup_join_${info?.slot}`);
      if (info) rememberCup({ id, name: info.name, startAt: info.startAt });
      if (!v || live?.gone) connect();
      else live?.sync();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function leave() {
    busy = true;
    try {
      await leaveCup(id);
      forgetCup(id);
      confirmLeave = false;
      live?.sync();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  const medal = (r: number) => ['🥇', '🥈', '🥉'][r - 1] ?? '';
  /** Each group's best kid (with a group: 10 rated games at this speed). */
</script>

<svelte:head><title>{info?.name ?? 'Castle Cup'} · Castle Cups · Chess Castles</title></svelte:head>

<div class="page">
  <header class="top">
    <a class="back" href="/cups" aria-label={$t('cups.allCups')}>‹</a>
    <div class="ttl">
      <h1>🏆 {info?.name ?? 'Castle Cup'}</h1>
      <span class="sub">{info ? cupTime(v?.startAt || info.startAt, $contentLang) : ''} · {info?.test ? $t('cups.testTag') : info?.flash ? $t('cups.flashTag') : (info?.day ?? '')}</span>
    </div>
    {#if status === 'running' && v}<span class="pill live">● {$t('cups.round', { n: v.round, of: v.rounds })}</span>{/if}
  </header>

  {#if !info}
    <p class="note">{$t('cups.notFound')}</p>
  {:else if !me}
    <section class="card center">
      <p>{$t('cups.signIn')}</p>
      <button class="btn primary" onclick={() => startSignIn()}>{$t('cups.signInBtn')}</button>
    </section>
  {:else}
    {#if error}<p class="err" role="alert">{error}</p>{/if}

    {#if !v}
      <!-- Nobody has joined yet (the room isn't there), or it's still connecting. -->
      <section class="card center">
        {#if live?.gone}
          <p class="big">{info.startAt > now ? $t('cups.startsIn', { time: countdown(info.startAt - now) }) : $t('cups.closed')}</p>
          {#if info.startAt > now}<button class="btn primary lg" onclick={join} disabled={busy}>{$t('cups.join')}</button>{/if}
        {:else}
          <p class="muted">{$t('cups.connecting')}</p>
        {/if}
      </section>
    {:else if status === 'open'}
      <section class="card center wait">
        <p class="count num">{v.startAt > now ? countdown(v.startAt - now) : '0:00'}</p>
        <p>{v.startAt > now ? $t('cups.untilStart') : $t('cups.starting')}</p>
        {#if inCup}
          <p class="in">✓ {$t('cups.youreIn')}</p>
          <p class="muted small">{$t('cups.keepOpen')}</p>
          {#if confirmLeave}
            <span class="row"><button class="btn" onclick={leave} disabled={busy}>{$t('cups.leaveYes')}</button><button class="btn ghost" onclick={() => (confirmLeave = false)}>{$t('cups.no')}</button></span>
          {:else}<button class="link" onclick={() => (confirmLeave = true)}>{$t('cups.leave')}</button>{/if}
        {:else}
          <button class="btn primary lg" onclick={join} disabled={busy}>{$t('cups.join')}</button>
        {/if}
      </section>
    {:else if status === 'cancelled' || status === 'skipped'}
      <section class="card center"><p class="big">{status === 'cancelled' ? $t('cups.calledOff') : $t('cups.noEntries')}</p><a class="btn" href="/cups">{$t('cups.allCups')}</a></section>
    {:else if status === 'over'}
      <CupResults {v} {me} name={info.name} />
    {/if}

    {#if status === 'running' && v}
      <div class="panes" role="tablist" aria-label={info.name}>
        <button role="tab" aria-selected={pane === 'board'} class:on={pane === 'board'} onclick={() => (pane = 'board')}>♟ {myGame ? $t('cups.myBoard') : $t('cups.topBoard')}</button>
        <button role="tab" aria-selected={pane === 'table'} class:on={pane === 'table'} onclick={() => (pane = 'table')}>🏆 {$t('cups.standingsH')}{#if myRank} · #{myRank.rank}{/if}</button>
      </div>
      <div class="play">
        <section class="board" class:away={pane !== 'board'}>
          {#if v.nextAt}
            <p class="banner">⏳ {$t('cups.nextRound', { time: countdown(v.nextAt - now) })}</p>
          {:else if myGame && firstMoveLeft !== undefined}
            <p class="banner warn">{$t('cups.firstMove', { s: Math.ceil(firstMoveLeft / 1000) })}</p>
          {:else if !myGame && inCup}
            {@const bye = v.games.some((g) => g.round === v.round && !g.black && g.white === me)}
            <p class="banner">{bye ? $t('cups.bye') : $t('cups.sitOut')}</p>
          {:else if myPlayer?.out}
            <p class="banner">{$t('cups.withdrawn')}</p>
          {/if}
          {#if shown && live}
            {#if !myGame}<p class="label">{$t('cups.topBoard')}</p>{/if}
            {#key shown.id}
              <GameBoard {live} game={shown} {tag} />
            {/key}
          {:else if !v.nextAt}
            <p class="muted center">{$t('cups.waitingGames')}</p>
          {/if}
          {#if canJoin}<button class="btn primary" onclick={join} disabled={busy}>{$t('cups.joinLate')}</button>{/if}
        </section>
        <aside class="side" class:away={pane !== 'table'}>
          {@render table()}
          {#if inCup}
            {#if confirmLeave}
              <span class="row"><button class="btn" onclick={leave} disabled={busy}>{$t('cups.leaveYes')}</button><button class="btn ghost" onclick={() => (confirmLeave = false)}>{$t('cups.no')}</button></span>
            {:else}<button class="link" onclick={() => (confirmLeave = true)}>{$t('cups.withdraw')}</button>{/if}
          {/if}
        </aside>
      </div>
    {:else if v && status === 'open'}
      {@render table()}
    {/if}
  {/if}
</div>

{#snippet table()}
  {#if v && standing.length}
    <section class="card standings">
      <h2>{status === 'open' ? $t('cups.whoIn', { n: v.players.filter((p) => !p.bot && !p.out).length }) : $t('cups.standingsH')}</h2>
      <table>
        <thead>
          <tr><th>#</th><th>{$t('cups.player')}</th><th>{$t('cups.group')}</th>{#if status !== 'open'}<th class="num">{$t('cups.points')}</th><th class="num tb">TB</th>{/if}</tr>
        </thead>
        <tbody>
          {#each standing as r (r.uid)}
            {@const p = v.players.find((x) => x.uid === r.uid)}
            <tr class:me={r.uid === me} class:out={r.out}>
              <td class="num">{status === 'open' ? '' : medal(r.rank) || r.rank}</td>
              <td class="nm">
                <span class="dot" class:on={p?.online} aria-hidden="true"></span>
                {r.name}
                <span class="rt">{r.rating}</span>
              </td>
              <td><span class="grp g-{r.group}" title={r.provisional ? $t('cups.provisional', { n: MIN_GAMES }) : ''}>{GROUP_NAME[r.group]}{r.provisional ? '?' : ''}</span></td>
              {#if status !== 'open'}<td class="num b">{r.score}</td><td class="num tb">{r.buch}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
{/snippet}

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 12px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .back {
    font-size: 28px;
    text-decoration: none;
    color: var(--muted);
    padding: 0 6px;
  }
  .ttl {
    flex: 1;
    min-width: 0;
  }
  h1 {
    margin: 0;
    font: 800 22px var(--font-title);
  }
  .sub {
    color: var(--muted);
    font-size: 13px;
  }
  .pill.live {
    font: 800 12px var(--font-body);
    color: #fff;
    background: #ef4444;
    padding: 3px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .card {
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }
  .big {
    font: 800 20px var(--font-title);
    margin: 0;
  }
  .count {
    margin: 0;
    font: 800 52px var(--font-title);
    line-height: 1;
    color: var(--gold);
  }
  .wait p {
    margin: 0;
  }
  .in {
    color: var(--win);
    font-weight: 800;
    font-size: 18px;
  }
  .lg {
    font-size: 18px;
    padding: 12px 28px;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--muted);
    text-decoration: underline;
    cursor: pointer;
    font-size: 13px;
    align-self: center;
  }
  .panes {
    display: none;
  }
  .next-note {
    margin: 4px 0 0;
    font-weight: 800;
    text-align: center;
  }
  .play {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 14px;
    align-items: start;
  }
  .board {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 640px;
    width: 100%;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .banner {
    margin: 0;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--raised);
    font-weight: 700;
    text-align: center;
  }
  .banner.warn {
    background: color-mix(in srgb, var(--gold) 22%, var(--raised));
  }
  .label {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
  }
  .note,
  .err {
    margin: 0;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--raised);
  }
  .err {
    color: var(--loss);
    font-weight: 700;
  }
  h2 {
    margin: 0 0 8px;
    font: 800 17px var(--font-title);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    text-align: left;
    font-size: 12px;
    color: var(--muted);
    font-weight: 700;
    padding: 4px 6px;
  }
  td {
    padding: 6px;
    border-top: 1px solid var(--border);
  }
  tr.me td {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
  }
  tr.out td {
    opacity: 0.5;
  }
  .nm {
    font-weight: 700;
    word-break: break-word;
  }
  .rt {
    font-weight: 500;
    font-size: 12px;
    color: var(--muted);
  }
  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--border);
    margin-right: 4px;
    vertical-align: middle;
  }
  .dot.on {
    background: var(--win);
  }
  .grp {
    font: 800 11px var(--font-body);
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--raised);
    white-space: nowrap;
  }
  .g-u1200 {
    background: color-mix(in srgb, #22c55e 22%, var(--raised));
  }
  .g-u1400 {
    background: color-mix(in srgb, #38bdf8 22%, var(--raised));
  }
  .g-u1600 {
    background: color-mix(in srgb, #a855f7 22%, var(--raised));
  }
  .num {
    text-align: right;
  }
  .b {
    font-weight: 800;
  }
  @media (max-width: 900px) {
    .play {
      grid-template-columns: 1fr;
    }
    .panes {
      display: flex;
      gap: 6px;
      position: sticky;
      top: 0;
      z-index: 6;
      padding: 4px;
      border-radius: 14px;
      background: var(--card);
      border: 1px solid var(--border);
    }
    .panes button {
      flex: 1;
      border: 0;
      border-radius: 10px;
      padding: 10px 8px;
      background: transparent;
      color: var(--muted);
      font: 800 14px var(--font-body);
      cursor: pointer;
    }
    .panes button.on {
      background: var(--gold);
      color: #1b1300;
    }
    .away {
      display: none !important;
    }
    .board {
      max-width: none;
    }
  }
  @media (max-width: 480px) {
    .tb {
      display: none;
    }
  }
</style>

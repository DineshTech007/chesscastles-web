<script lang="ts">
  /**
   * A club tournament: friends (real players) and computer players. Your game this round (against a computer:
   * played here; against a friend: on Lichess, a game only the two of you can join), the standings, every
   * round's results, and for the organiser: close a round, or delete the tournament. It refreshes by itself.
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { fedName } from '$lib/fideFeds';
  import { TIME_CONTROLS, tcLabel } from '$lib/game/fideGame';
  import { lichessToken, session } from '$lib/auth';
  import * as lb from '$lib/lichessBoard';
  import { placeMedal } from '$lib/tournament/tournament';
  import {
    checkClubGame, closeClubRound, clubDone, clubMe, clubMyGame, clubPlayer, clubStandings, deleteClub, getClub, sendClubGame, type Club,
  } from '$lib/tournament/club';

  const id = page.params.id!;
  let t = $state<Club | undefined>();
  let error = $state('');
  let busy = $state('');
  let note = $state('');
  let confirmClose = $state(false);
  let confirmDelete = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  const uid = $derived($session.status === 'in' ? $session.uid : undefined);
  const me = $derived(t ? clubMe(t, uid) : undefined);
  const mine = $derived(t && me ? clubMyGame(t, me.id) : undefined);
  const opp = $derived(t && me && mine ? clubPlayer(t, mine.white === me.id ? mine.black : mine.white) : undefined);
  const myColor = $derived(mine && me ? (mine.white === me.id ? 'white' : 'black') : 'white');
  const myBye = $derived(!!t && !!me && !clubDone(t) && t.games.some((g) => g.round === t!.round && !g.black && g.white === me!.id));
  const table = $derived(t ? clubStandings(t) : []);
  const done = $derived(!!t && clubDone(t));
  const owner = $derived(!!t && t.owner === uid);
  const myRow = $derived(table.find((s) => s.player.id === me?.id));
  /** Real players whose game this round isn't over yet. */
  const waiting = $derived(
    t && !done
      ? t.games
          .filter((g) => g.round === t!.round && g.black && !g.result)
          .flatMap((g) => [g.white, g.black])
          .map((pid) => clubPlayer(t!, pid))
          .filter((p) => p && !p.bot)
      : [],
  );
  const roundsList = $derived(t ? Array.from({ length: Math.min(t.round, t.rounds) }, (_, i) => i + 1).reverse() : []);
  const resultText = (r?: string) => (r === '1/2-1/2' ? '½–½' : r === '1-0' ? '1–0' : r === '0-1' ? '0–1' : r === '0-0' ? 'not played' : '…');
  const tcName = (c: Club) => tcLabel(TIME_CONTROLS[c.tc] ?? { minutes: c.clock.minutes, increment: c.clock.increment, kind: '' });

  async function load() {
    try {
      t = await getClub(id);
      error = '';
    } catch (e) {
      if (!t) error = e instanceof Error ? e.message : 'This tournament could not be loaded.';
    }
  }

  // Signed in: load it, then every 15 seconds (other players' results come in).
  let started = false;
  $effect(() => {
    if ($session.status !== 'in' || started) return;
    started = true;
    void load().then(() => {
      // Back from a game against a friend: read its result from Lichess.
      if (page.url.searchParams.get('check') && mine && !mine.result && mine.gameId && opp && !opp.bot) void check();
    });
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15_000);
  });
  onDestroy(() => clearInterval(timer));

  /** Opens (or joins) the Lichess game of two friends; the first to come opens it, the other joins it. */
  async function playFriend() {
    const token = lichessToken()?.token;
    if (!token || !me) return void (note = 'Connect your Lichess account to play your friends.');
    busy = 'friend';
    note = '';
    try {
      const fresh = await getClub(id);
      t = fresh;
      const g = clubMyGame(fresh, me.id);
      if (!g) return;
      let gid = g.gameId;
      if (!gid) {
        const white = clubPlayer(fresh, g.white)!.lichess!;
        const black = clubPlayer(fresh, g.black)!.lichess!;
        gid = await lb.openChallenge(token, { white, black, minutes: fresh.clock.minutes, increment: fresh.clock.increment, rated: false });
        t = await sendClubGame(id, gid);
        // If the other player opened one at the same moment, theirs is the one kept.
        gid = (t && clubMyGame(t, me.id)?.gameId) || gid;
      }
      // Already joined (or started): fine.
      await lb.acceptChallenge(token, gid).catch(() => {});
      await goto(`/play/online/${gid}?c=${myColor}&club=${id}`);
    } catch (e) {
      note = e instanceof Error ? e.message : 'The game could not be opened. Try again.';
    } finally {
      busy = '';
    }
  }

  async function check() {
    busy = 'check';
    note = '';
    try {
      const before = mine;
      t = await checkClubGame(id);
      const after = me && t.games.find((g) => before && g.round === before.round && g.white === before.white && g.black === before.black);
      note = after?.result ? 'Result recorded.' : 'Lichess has no result for your game yet: finish it first.';
    } catch (e) {
      note = e instanceof Error ? e.message : 'The result could not be read.';
    } finally {
      busy = '';
    }
  }

  async function closeRound() {
    busy = 'close';
    try {
      t = await closeClubRound(id);
      confirmClose = false;
    } catch (e) {
      note = e instanceof Error ? e.message : 'The round could not be closed.';
    } finally {
      busy = '';
    }
  }
  async function remove() {
    busy = 'delete';
    try {
      await deleteClub(id);
      await goto('/play/tournament', { replaceState: true });
    } catch (e) {
      note = e instanceof Error ? e.message : 'It could not be deleted.';
      busy = '';
    }
  }
</script>

<svelte:head><title>{t?.name ?? 'Tournament'} · Chess Castles</title></svelte:head>

{#snippet who(pid: string, bold = false)}
  {@const p = t ? clubPlayer(t, pid) : undefined}
  {#if p}
    <span class="who" class:me={p.id === me?.id}>
      {#if p.fed}<img class="flag" src="/flags/{p.fed}.svg" alt={fedName(p.fed)} title={fedName(p.fed)} width="16" height="11" />{/if}
      {#if bold}<strong>{p.id === me?.id ? 'You' : p.name}</strong>{:else}{p.id === me?.id ? 'You' : p.name}{/if}
      {#if p.bot}<span class="tag bot" title="A computer player">Computer</span>{:else if p.id !== me?.id}<span class="tag real" title="A real player">Player</span>{/if}
      <span class="label num">{p.rating}</span>
    </span>
  {/if}
{/snippet}

<div class="page">
  <a class="back" href="/play/tournament"><Icon name="back" size={16} />Tournaments</a>
  {#if $session.status === 'out'}
    <p class="card">Sign in to see this tournament.</p>
  {:else if error}
    <p class="card">{error}</p>
  {:else if !t}
    <div class="card skel"></div>
  {:else}
    <header class="thead">
      <div>
        <span class="label">{t.format === 'swiss' ? 'Swiss' : 'Round robin'} · {t.players.length} players ({t.players.filter((p) => !p.bot).length} real) · {tcName(t)}</span>
        <h1 class="display">{t.name}</h1>
      </div>
      <span class="round-pill">{done ? 'Finished' : `Round ${t.round} of ${t.rounds}`}</span>
    </header>

    {#if done}
      <section class="card podium-card">
        <div class="podium">
          {#each [table[1], table[0], table[2]] as s, i (s?.player.id ?? i)}
            {#if s}
              <div class="step p{s.rank}" class:mine={s.player.id === me?.id}>
                <span class="medal">{placeMedal(s.rank)}</span>
                <strong class="pname">{s.player.id === me?.id ? 'You' : s.player.name}</strong>
                <span class="label num">{s.score} pts</span>
                <div class="block"><span class="display">{s.rank}</span></div>
              </div>
            {/if}
          {/each}
        </div>
        {#if myRow}<p class="final title">{placeMedal(myRow.rank)} You finished #{myRow.rank} of {t.players.length} with {myRow.score} out of {t.rounds}.</p>{/if}
      </section>
    {:else if mine && opp}
      <section class="card next">
        <span class="label">Your game · round {t.round}</span>
        <div class="vs">
          <span class="side">{@render who(mine.white, true)}<span class="label">White</span></span>
          <span class="v">vs</span>
          <span class="side">{@render who(mine.black, true)}<span class="label">Black</span></span>
        </div>
        {#if mine.result}
          <p class="title">Played: {resultText(mine.result)}. Waiting for the other games of this round.</p>
        {:else if opp.bot}
          <button class="btn primary big" onclick={() => goto(`/play/tournament/club/${id}/game`)}><Icon name="play" size={18} fill color="currentColor" />Play round {t.round}</button>
        {:else}
          <p class="label">You play {opp.name} on Lichess, {t.clock.minutes}+{t.clock.increment}. {mine.gameId ? 'The game is open: join it.' : 'The first of you to press the button opens the game; the other joins it.'}</p>
          <div class="row">
            <button class="btn primary big" disabled={busy === 'friend'} onclick={playFriend}><Icon name="play" size={18} fill color="currentColor" />{busy === 'friend' ? 'Opening…' : mine.gameId ? 'Join your game' : 'Open our game'}</button>
            {#if mine.gameId}<button class="btn" disabled={busy === 'check'} onclick={check}>{busy === 'check' ? 'Reading…' : 'Game over? Record the result'}</button>{/if}
          </div>
        {/if}
        {#if note}<p class="note">{note}</p>{/if}
      </section>
    {:else if myBye}
      <section class="card next"><p class="title">You have a bye this round: a free point. The next round starts when the others have played.</p></section>
    {/if}

    {#if !done && waiting.length}
      <p class="label waiting">Round {t.round} goes on when these players have played: {[...new Set(waiting.map((p) => (p!.id === me?.id ? 'you' : p!.name)))].join(', ')}.</p>
    {/if}

    <section class="card">
      <h2 class="title">Standings</h2>
      <div class="table-wrap">
        <table class="stand">
          <thead><tr><th>#</th><th>Player</th><th class="r">Pts</th><th class="r" title="Buchholz: the opponents' scores added up">Bh</th><th class="r">Games</th></tr></thead>
          <tbody>
            {#each table as s (s.player.id)}
              <tr class:me={s.player.id === me?.id}>
                <td class="num">{done ? placeMedal(s.rank) || s.rank : s.rank}</td>
                <td>{@render who(s.player.id, s.player.id === me?.id)}</td>
                <td class="r num"><strong>{s.score}</strong></td>
                <td class="r num label">{s.buchholz}</td>
                <td class="r num label">{s.played}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2 class="title">Results</h2>
      {#each roundsList as r (r)}
        <h3 class="rh">Round {r}</h3>
        <ul class="pairings">
          {#each t.games.filter((g) => g.round === r) as g, i (i)}
            <li class:mine={g.white === me?.id || g.black === me?.id}>
              {#if g.black}
                <span class="pw">{@render who(g.white)}</span>
                <span class="res num">{resultText(g.result)}</span>
                <span class="pb">{@render who(g.black)}</span>
              {:else}
                <span class="pw">{@render who(g.white)}</span><span class="res">bye</span><span class="pb label">1 point</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/each}
    </section>

    {#if owner}
      <section class="card org">
        <h2 class="title">Organiser</h2>
        {#if !done}
          {#if confirmClose}
            <p class="label">Close round {t.round} now? A player who hasn't played loses to a computer; between two people, nobody scores.</p>
            <div class="row">
              <button class="btn primary" disabled={busy === 'close'} onclick={closeRound}>Close the round</button>
              <button class="btn" onclick={() => (confirmClose = false)}>Wait</button>
            </div>
          {:else}
            <button class="btn" onclick={() => (confirmClose = true)}>Close round {t.round}</button>
          {/if}
        {/if}
        {#if confirmDelete}
          <p class="label">Delete this tournament for everyone? This can't be undone.</p>
          <div class="row">
            <button class="btn danger" disabled={busy === 'delete'} onclick={remove}>Delete</button>
            <button class="btn" onclick={() => (confirmDelete = false)}>Keep it</button>
          </div>
        {:else}
          <button class="link" onclick={() => (confirmDelete = true)}>Delete the tournament</button>
        {/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 860px;
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
  .skel {
    height: 300px;
  }
  .thead {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  .thead h1 {
    margin: 2px 0 0;
    font-size: 30px;
  }
  .round-pill {
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--raised);
    font-weight: 800;
  }
  .next {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
    border-color: var(--gold);
  }
  .next p {
    margin: 0;
  }
  .vs {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .v {
    font-weight: 800;
    color: var(--muted);
  }
  .big {
    min-height: 48px;
    gap: 8px;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .note {
    color: var(--accent);
    font-weight: 600;
  }
  .waiting {
    margin: -4px 0 0;
  }
  .who {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    min-width: 0;
  }
  .who.me {
    color: var(--gold);
  }
  .flag {
    border-radius: 2px;
  }
  .tag {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }
  .tag.bot {
    color: var(--muted);
  }
  .tag.real {
    color: var(--win);
    border-color: var(--win);
  }
  .table-wrap {
    overflow-x: auto;
  }
  .stand {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .stand th {
    text-align: left;
    font-size: 12px;
    color: var(--muted);
    padding: 6px 8px;
  }
  .stand td {
    padding: 8px;
    border-top: 1px solid var(--border);
  }
  .stand .r {
    text-align: right;
  }
  .stand tr.me td {
    background: color-mix(in srgb, var(--gold) 10%, transparent);
  }
  .rh {
    margin: 12px 0 4px;
    font-size: 14px;
    color: var(--muted);
  }
  .pairings {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .pairings li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 7px 4px;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .pairings li.mine {
    background: color-mix(in srgb, var(--gold) 8%, transparent);
  }
  .pb {
    justify-self: end;
    text-align: right;
  }
  .res {
    font-weight: 800;
    text-align: center;
    white-space: nowrap;
  }
  .podium {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 10px;
  }
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 120px;
    text-align: center;
  }
  .medal {
    font-size: 30px;
  }
  .pname {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .block {
    width: 100%;
    display: grid;
    place-items: center;
    border-radius: 10px 10px 0 0;
    background: var(--raised);
  }
  .p1 .block {
    height: 90px;
    background: color-mix(in srgb, var(--gold) 35%, var(--raised));
  }
  .p2 .block {
    height: 64px;
  }
  .p3 .block {
    height: 44px;
  }
  .step.mine .pname {
    color: var(--gold);
  }
  .final {
    text-align: center;
    margin: 12px 0 0;
  }
  .org {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .org p {
    margin: 0;
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--loss);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .danger {
    background: var(--loss);
    color: #fff;
  }
  @media (max-width: 600px) {
    .pairings li {
      font-size: 13px;
      gap: 6px;
    }
    .step {
      width: 96px;
    }
  }
</style>

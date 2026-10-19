<script lang="ts">
  /**
   * A Chess Castles FIDE tournament: set it up (opponents from the FIDE list near
   * your rating), play your game each round, follow the standings, and get
   * a trophy at the end. With friends picked, it is a club tournament: the friends
   * are real players in it, computer players fill the rest, and Chess Castles'
   * server keeps it so everyone sees the same (src/lib/tournament/club.ts).
   */
  import { myName as displayName } from '$lib/stores/me';
  import { onMount } from 'svelte';
  import { useFeature } from '$lib/plans';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { fedName } from '$lib/fideFeds';
  import { TIME_CONTROLS, TIME_CONTROL_ORDER, tcLabel } from '$lib/game/fideGame';
  import { speedOf } from '$lib/kfide';
  import { kfideAll, myCountry } from '$lib/stores/me';
  import { lichessToken, session } from '$lib/auth';
  import { friendsList, type Player } from '$lib/social';
  import { createClub, listClubs, type ClubSummary } from '$lib/tournament/club';
  import {
    awardTrophy, completeRound, createTournament, finished, loadTournament, loadTrophies, ME, myGame, pickOpponents, placeMedal,
    playerById, rng, saveTournament, standings, type FideRow, type Format, type Tournament, type Trophy,
  } from '$lib/tournament/tournament';

  let t = $state<Tournament | undefined>();
  let trophies = $state<Trophy[]>([]);
  let loading = $state(false);
  let error = $state('');
  let confirmQuit = $state(false);

  // Setup
  let size = $state(7);
  let format = $state<Format>('swiss');
  let rounds = $state(5);
  let tc = $state(2);
  let name = $state('Chess Castles Open');
  // Real players: the friends picked, and how many computer players join them.
  let friends = $state<Player[]>([]);
  let picked = $state<string[]>([]);
  let botCount = $state(4);
  let clubs = $state<ClubSummary[]>([]);
  const withFriends = $derived(picked.length > 0);
  const iCanInvite = $derived(!!lichessToken());
  /** Two people play each other on Lichess: both need a Lichess account. */
  const canPlayFriends = (f: Player) => f.uid.startsWith('lichess:');

  onMount(() => {
    t = loadTournament();
    trophies = loadTrophies();
  });
  $effect(() => {
    if ($session.status !== 'in') return;
    friendsList().then(
      (r) => (friends = r.friends),
      () => {},
    );
    listClubs().then(
      (l) => (clubs = l),
      () => {},
    );
  });
  const togglePick = (uid: string) => (picked = picked.includes(uid) ? picked.filter((x) => x !== uid) : [...picked, uid]);
  // Lichess lets apps play no bullet: with friends, the time control is blitz or slower.
  $effect(() => {
    if (withFriends && TIME_CONTROLS[tc].kind === 'Bullet') tc = 1;
  });

  const speed = $derived(speedOf(tcLabel(TIME_CONTROLS[tc])));
  const myRating = $derived($kfideAll[speed].rating);
  const fed = $derived($myCountry || 'IND');
  const myName = $derived($session.status === 'in' ? $displayName : 'You');

  async function start() {
    if (withFriends) return startClub();
    loading = true;
    error = '';
    // A tournament (all its rounds) counts once towards the plan's tournaments.
    if (!(await useFeature('tournament'))) return void (loading = false);
    try {
      let res = await fetch(`/data/fide/fed/${fed}.json`);
      if (!res.ok) res = await fetch('/data/fide/fed/IND.json');
      const rows: FideRow[] = await res.json();
      const random = rng(Date.now());
      // FIDE rates no bullet: bullet tournaments draw on the players' blitz ratings.
      const opponents = pickOpponents(rows, myRating, size, speed === 'bullet' ? 'blitz' : speed, res.url.includes(`/${fed}.json`) ? fed : 'IND', random);
      if (opponents.length < 5) throw new Error('Not enough opponents near your rating. Try again.');
      t = createTournament({ name: name.trim() || 'Chess Castles Open', tc, format, rounds, me: { id: ME, name: myName, rating: myRating, fed }, opponents });
      saveTournament(t);
    } catch (e) {
      error = e instanceof Error ? e.message : 'The tournament could not be set up.';
    } finally {
      loading = false;
    }
  }

  /** A tournament with friends: kept on the server; the computer players are picked here, as for a solo one. */
  async function startClub() {
    loading = true;
    error = '';
    try {
      let bots: { name: string; rating: number; fed: string }[] = [];
      if (botCount > 0) {
        let res = await fetch(`/data/fide/fed/${fed}.json`);
        if (!res.ok) res = await fetch('/data/fide/fed/IND.json');
        const rows: FideRow[] = await res.json();
        bots = pickOpponents(rows, myRating, botCount, speed === 'bullet' ? 'blitz' : speed, fed, rng(Date.now())).map((b) => ({ name: b.name, rating: b.rating, fed: b.fed }));
      }
      const c = TIME_CONTROLS[tc];
      const club = await createClub({ name: name.trim() || 'Chess Castles Club', tc, clock: { minutes: c.minutes, increment: c.increment }, format, rounds, friends: picked, bots });
      await goto(`/play/tournament/club/${club.id}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'The tournament could not be set up.';
    } finally {
      loading = false;
    }
  }

  /** A bye: the point is yours; the others play their games. */
  function nextAfterBye() {
    if (!t) return;
    t = completeRound(t);
    saveTournament(t);
    if (finished(t)) trophies = [awardTrophy(t)!, ...trophies.filter((x) => x.id !== t!.id)];
  }

  function quit() {
    saveTournament(undefined);
    t = undefined;
    confirmQuit = false;
  }

  const table = $derived(t ? standings(t) : []);
  const mine = $derived(t ? myGame(t) : undefined);
  const myBye = $derived(!!t && !finished(t) && !mine && t.games.some((g) => g.round === t!.round && !g.black && g.white === ME));
  const opp = $derived(t && mine ? playerById(t, mine.white === ME ? mine.black : mine.white) : undefined);
  const done = $derived(!!t && finished(t));
  const me = $derived(table.find((s) => s.player.me));
  const roundsList = $derived(t ? Array.from({ length: Math.min(t.round, t.rounds) }, (_, i) => i + 1).reverse() : []);
  const nameOf = (id: string) => (t ? playerById(t, id) : undefined);
  const resultText = (r?: string) => (r === '1/2-1/2' ? '½–½' : r === '1-0' ? '1–0' : r === '0-1' ? '0–1' : '…');
</script>

<svelte:head><title>FIDE tournament · Chess Castles</title></svelte:head>

{#snippet who(id: string, bold = false)}
  {@const p = nameOf(id)}
  {#if p}
    <span class="who" class:me={p.me}>
      {#if p.fed}<img class="flag" src="/flags/{p.fed}.svg" alt={fedName(p.fed)} title={fedName(p.fed)} width="16" height="11" />{/if}
      {#if p.title}<span class="ttl">{p.title}</span>{/if}
      {#if bold}<strong>{p.me ? 'You' : p.name}</strong>{:else}{p.me ? 'You' : p.name}{/if}
      {#if !p.me}<span class="bot" title="A computer opponent">Computer</span>{/if}
      <span class="label num">{p.rating}</span>
    </span>
  {/if}
{/snippet}

<div class="page">
  <a class="back" href="/play"><Icon name="back" size={16} />Play</a>

  {#if !t}
    <section class="card hero">
      <span class="cup">🏆</span>
      <div>
        <h1 class="display">FIDE tournament</h1>
        <p>Play computer opponents rated like players near your CC Rating (their ratings come from the FIDE rating list), or invite your friends: real players and computer players in one tournament. Play your game each round, watch the standings change, and win a trophy for the top three.</p>
      </div>
    </section>

    {#if clubs.length}
      <section class="card">
        <h2 class="title">Your tournaments with friends</h2>
        <ul class="clubs">
          {#each clubs as c (c.id)}
            <li>
              <a href="/play/tournament/club/{c.id}">
                <span><strong>{c.name}</strong><span class="label">{c.done ? 'Finished' : `Round ${c.round} of ${c.rounds}`} · {c.people} real, {c.players - c.people} computer{c.owner ? ' · you organise it' : ''}</span></span>
                {#if c.myTurn}<span class="turn">Your game</span>{/if}
                <Icon name="chevron" size={16} />
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="card setup">
      <label class="field"><span class="label">Tournament name</span><input bind:value={name} maxlength="40" /></label>

      <div class="field">
        <span class="label">Real players: your friends</span>
        {#if $session.status !== 'in'}
          <span class="label small">Sign in to invite your friends.</span>
        {:else if !friends.length}
          <span class="label small">Add friends on the <a href="/friends">Friends</a> page, then invite them here.</span>
        {:else}
          {#if !iCanInvite}<span class="label small">To play friends, connect your Lichess account (your games against each other are played on Lichess).</span>{/if}
          <div class="friends">
            {#each friends as f (f.uid)}
              {@const ok = canPlayFriends(f) && iCanInvite}
              <button class="friend" class:on={picked.includes(f.uid)} aria-pressed={picked.includes(f.uid)} disabled={!ok || (!picked.includes(f.uid) && picked.length >= 9)} onclick={() => togglePick(f.uid)}>
                <span class="tick" aria-hidden="true">{picked.includes(f.uid) ? '✓' : ''}</span>
                <span class="fname">{f.name}</span>
                {#if !canPlayFriends(f)}<span class="label small">needs Lichess</span>{:else if f.kfide}<span class="label num">{f.kfide}</span>{/if}
              </button>
            {/each}
          </div>
          {#if withFriends}<span class="label small">{picked.length} {picked.length === 1 ? 'friend' : 'friends'} invited. They see the tournament on this page and play their games when they like.</span>{/if}
        {/if}
      </div>

      <div class="field">
        {#if withFriends}
          <span class="label">Computer players</span>
          <div class="chips">
            {#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as n (n)}<button class="chip" aria-pressed={botCount === n} disabled={picked.length + 1 + n < 3} onclick={() => (botCount = n)}>{n}</button>{/each}
          </div>
          <span class="label small">{picked.length + 1 + botCount} players in all: you, {picked.length} {picked.length === 1 ? 'friend' : 'friends'} and {botCount} computer {botCount === 1 ? 'player' : 'players'}.</span>
        {:else}
          <span class="label">Opponents</span>
          <div class="chips">
            {#each [5, 6, 7, 8, 9, 10] as n (n)}<button class="chip" aria-pressed={size === n} onclick={() => (size = n)}>{n}</button>{/each}
          </div>
        {/if}
      </div>

      <div class="field">
        <span class="label">Format</span>
        <div class="segmented" role="group" aria-label="Format">
          <button aria-pressed={format === 'swiss'} onclick={() => (format = 'swiss')}>Swiss</button>
          <button aria-pressed={format === 'robin'} onclick={() => (format = 'robin')}>Round robin</button>
        </div>
        <span class="label small">{format === 'swiss' ? 'Paired by score each round, never the same opponent twice.' : `Everyone plays everyone: ${size % 2 ? size + 1 : size} rounds.`}</span>
      </div>

      {#if format === 'swiss'}
        <div class="field">
          <span class="label">Rounds</span>
          <div class="chips">
            {#each [3, 4, 5, 6, 7] as n (n)}<button class="chip" aria-pressed={rounds === n} disabled={n > (withFriends ? picked.length + botCount : size)} onclick={() => (rounds = n)}>{n}</button>{/each}
          </div>
        </div>
      {/if}

      <div class="field">
        <span class="label">Time control</span>
        <div class="chips">
          {#each TIME_CONTROL_ORDER as i (i)}{@const c = TIME_CONTROLS[i]}{#if !(withFriends && c.kind === 'Bullet')}<button class="chip" aria-pressed={tc === i} onclick={() => (tc = i)}>{tcLabel(c)} <span class="label">{c.kind}</span></button>{/if}{/each}
        </div>
      </div>

      <p class="label">You play as <strong>{myName}</strong>, rated <strong>{myRating}</strong> (your {speed} CC Rating). Computer opponents come from the {fedName(fed)} FIDE list. Your games against them count for CC Rating{withFriends ? '; games against friends are played on Lichess' : ''}.</p>
      {#if error}<p class="err">{error}</p>{/if}
      <button class="btn primary big" disabled={loading} onclick={start}><span class="cup-s">🏆</span>{loading ? 'Setting it up…' : withFriends ? 'Start the tournament with friends' : 'Start the tournament'}</button>
    </section>

    {#if trophies.length}
      <section class="card">
        <h2 class="title">Your trophies</h2>
        <ul class="trophies">
          {#each trophies as tr (tr.id)}
            <li><span class="medal">{placeMedal(tr.place) || `#${tr.place}`}</span><span><strong>{tr.name}</strong><span class="label">{tr.score}/{tr.rounds} · place {tr.place} of {tr.players}</span></span></li>
          {/each}
        </ul>
      </section>
    {/if}
  {:else}
    <header class="thead">
      <div>
        <span class="label">{t.format === 'swiss' ? 'Swiss' : 'Round robin'} · {t.players.length} players · {tcLabel(TIME_CONTROLS[t.tc])}</span>
        <h1 class="display">{t.name}</h1>
      </div>
      <span class="round-pill">{done ? 'Finished' : `Round ${t.round} of ${t.rounds}`}</span>
    </header>

    {#if done && me}
      <section class="card podium-card">
        <div class="podium">
          {#each [table[1], table[0], table[2]] as s, i (s?.player.id ?? i)}
            {#if s}
              <div class="step p{s.rank}" class:mine={s.player.me}>
                <span class="medal big">{placeMedal(s.rank)}</span>
                <strong class="pname">{s.player.me ? 'You' : s.player.name}</strong>
                <span class="label num">{s.score} pts</span>
                <div class="block"><span class="display">{s.rank}</span></div>
              </div>
            {/if}
          {/each}
        </div>
        <p class="final title">
          {#if me.rank <= 3}{placeMedal(me.rank)} You finished {me.rank === 1 ? 'first: tournament winner!' : me.rank === 2 ? 'second!' : 'third!'} {me.score} out of {t.rounds}.
          {:else}You finished #{me.rank} of {t.players.length} with {me.score} out of {t.rounds}. Next time, the podium!{/if}
        </p>
        <div class="row">
          <button class="btn primary" onclick={quit}><Icon name="replay" size={16} />New tournament</button>
          <a class="btn" href="/games"><Icon name="history" size={16} />Review my games</a>
        </div>
      </section>
    {:else if mine && opp}
      <section class="card next">
        <span class="label">Your game · round {t.round}</span>
        <div class="vs">
          <span class="side">{@render who(mine.white, true)}<span class="label">White</span></span>
          <span class="v">vs</span>
          <span class="side">{@render who(mine.black, true)}<span class="label">Black</span></span>
        </div>
        <button class="btn primary big" onclick={() => goto('/play/tournament/game')}><Icon name="play" size={18} fill color="currentColor" />Play round {t.round}</button>
      </section>
    {:else if myBye}
      <section class="card next">
        <p class="title">You have a bye this round: a free point.</p>
        <button class="btn primary" onclick={nextAfterBye}>Continue to round {t.round + 1 > t.rounds ? 'results' : t.round + 1}</button>
      </section>
    {/if}

    <section class="card">
      <h2 class="title">Standings</h2>
      <div class="table-wrap">
        <table class="stand">
          <thead><tr><th>#</th><th>Player</th><th class="r">Pts</th><th class="r" title="Buchholz: the opponents' scores added up">Bh</th><th class="r">Games</th></tr></thead>
          <tbody>
            {#each table as s (s.player.id)}
              <tr class:me={s.player.me}>
                <td class="num">{done ? placeMedal(s.rank) || s.rank : s.rank}</td>
                <td>{@render who(s.player.id, s.player.me)}</td>
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
            <li class:mine={g.white === ME || g.black === ME}>
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

    {#if !done}
      <div class="quit">
        {#if confirmQuit}
          <span class="label">Leave this tournament? It can't be resumed.</span>
          <button class="btn" onclick={quit}>Yes, leave</button>
          <button class="btn ghost" onclick={() => (confirmQuit = false)}>Keep playing</button>
        {:else}
          <button class="link" onclick={() => (confirmQuit = true)}>Leave the tournament</button>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .bot {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 999px;
    color: var(--muted);
    border: 1px solid var(--border);
  }
  .clubs {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .clubs a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 4px;
    border-top: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
  }
  .clubs a > span:first-child {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .turn {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--gold);
    color: #1b1300;
    font-weight: 800;
    font-size: 12.5px;
  }
  .friends {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 6px;
    max-height: 260px;
    overflow-y: auto;
  }
  .friend {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .friend.on {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 14%, var(--raised));
  }
  .friend:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .tick {
    width: 20px;
    height: 20px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 6px;
    border: 2px solid var(--border);
    font-weight: 900;
    color: var(--gold);
  }
  .friend.on .tick {
    border-color: var(--gold);
  }
  .fname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
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
  .hero {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .hero h1 {
    margin: 0 0 4px;
    font-size: 36px;
  }
  .hero p {
    margin: 0;
  }
  .cup {
    font-size: 64px;
    line-height: 1;
    filter: drop-shadow(0 4px 10px rgba(237, 176, 64, 0.4));
  }
  .setup {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field input {
    font: inherit;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    max-width: 360px;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    border-radius: 999px;
    padding: 7px 14px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .chip[aria-pressed='true'] {
    background: var(--action);
    color: var(--on-action);
    border-color: transparent;
  }
  .chip[aria-pressed='true'] .label {
    color: inherit;
  }
  .chip:disabled {
    opacity: 0.4;
  }
  .small {
    font-size: 13px;
  }
  .big {
    min-height: 50px;
    font-size: 17px;
    gap: 8px;
  }
  .cup-s {
    font-size: 20px;
  }
  .err {
    color: var(--loss);
    margin: 0;
  }
  .thead {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .thead h1 {
    margin: 2px 0 0;
    font-size: 34px;
  }
  .round-pill {
    padding: 6px 14px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 20%, transparent);
    color: var(--gold);
    font-weight: 800;
  }
  .next {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  .vs .side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 200px;
  }
  .v {
    font-weight: 800;
    color: var(--muted);
  }
  .who {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .who.me {
    color: var(--gold);
  }
  .flag {
    border-radius: 2px;
    flex: none;
  }
  .ttl {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--gold);
    color: #1b1300;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table.stand {
    width: 100%;
    border-collapse: collapse;
  }
  .stand th,
  .stand td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }
  .stand th {
    color: var(--muted);
    font-size: 13px;
  }
  .stand tr.me {
    background: color-mix(in srgb, var(--gold) 10%, transparent);
  }
  .r {
    text-align: right !important;
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
    grid-template-columns: minmax(0, 1fr) 54px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .pairings li.mine {
    background: color-mix(in srgb, var(--gold) 8%, transparent);
  }
  .res {
    text-align: center;
    font-weight: 800;
  }
  .pb {
    justify-self: end;
  }
  .podium-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-color: var(--gold);
  }
  .podium {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 10px;
  }
  .step {
    flex: 0 1 170px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
  }
  .step .block {
    width: 100%;
    display: grid;
    place-items: center;
    border-radius: 10px 10px 0 0;
    background: var(--raised);
    color: var(--muted);
  }
  .step.p1 .block {
    height: 110px;
    background: linear-gradient(180deg, #f6d36b, #b7862a);
    color: #3b2a05;
  }
  .step.p2 .block {
    height: 80px;
    background: linear-gradient(180deg, #e5e7eb, #9ca3af);
    color: #1f2937;
  }
  .step.p3 .block {
    height: 60px;
    background: linear-gradient(180deg, #f0b27a, #a0522d);
    color: #2b1406;
  }
  .step.mine .pname {
    color: var(--gold);
  }
  .medal {
    font-size: 26px;
  }
  .medal.big {
    font-size: 44px;
  }
  .pname {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .final {
    text-align: center;
    margin: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .row .btn {
    gap: 6px;
  }
  .trophies {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .trophies li {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .trophies li > span:last-child {
    display: flex;
    flex-direction: column;
  }
  .quit {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
  }
  @media (max-width: 560px) {
    .hero {
      flex-direction: column;
      text-align: center;
    }
    .pairings li {
      grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr);
      font-size: 13px;
    }
    .pairings .label.num {
      display: none;
    }
  }
</style>

<script lang="ts">
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { formatDate } from '$lib/format';
  import { fedName } from '$lib/fideFeds';
  import { KFIDE_SPEEDS, SPEED_LABEL } from '$lib/kfide';
  import { reportPlayer, type ReportReason } from '$lib/social';
  import LichessPanel from '$lib/components/LichessPanel.svelte';
  import FriendGames from '$lib/components/FriendGames.svelte';
  import type { LichessProfile } from '$lib/lichess';
  import { friendAction, getPlayer, initialsOf, playerPhoto, type Player, type Relation } from '$lib/social';

  const uid = decodeURIComponent(page.params.uid!);
  let player = $state<Player | undefined>();
  let relation = $state<Relation>('none');
  let error = $state('');
  let busy = $state(false);
  let confirmBlock = $state(false);

  /** The Lichess account behind a Chess Castles player (every account signs in with Lichess). */
  const lichessId = uid.startsWith('lichess:') ? uid.slice(8) : '';
  /** A Lichess player who is not on Chess Castles yet. */
  let lichessOnly = $state(false);
  let lp = $state<LichessProfile | undefined>();
  let lpLoaded = $state(false);

  $effect(() => {
    if ($session.status !== 'in') return;
    getPlayer(uid).then(
      (r) => ((player = r.player), (relation = r.relation), (lichessOnly = false)),
      (e) => {
        if (lichessId && e instanceof Error && /No such player/.test(e.message)) lichessOnly = true;
        else error = e instanceof Error ? e.message : 'This player could not be loaded.';
      },
    );
  });

  async function act(a: 'request' | 'accept' | 'remove' | 'block') {
    busy = true;
    try {
      relation = await friendAction(uid, a, lichessOnly ? lp?.username : undefined);
      if (a === 'block') player = undefined;
      const r = a === 'block' ? undefined : await getPlayer(uid);
      if (r) {
        player = r.player;
        lichessOnly = false;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'That did not work. Try again.';
    } finally {
      busy = false;
      confirmBlock = false;
    }
  }
  const photo = $derived(player ? playerPhoto(player) : undefined);

  // ---------- report (fair play, abuse…) ----------
  let reporting = $state(false);
  let reason = $state<ReportReason>('cheating');
  let details = $state('');
  let reportGame = $state('');
  let reportNote = $state('');
  const REASONS: [ReportReason, string][] = [
    ['cheating', 'Cheating: using an engine or help during games'],
    ['sandbagging', 'Losing on purpose (sandbagging) or rating boosting'],
    ['abuse', 'Abusive, threatening or rude messages'],
    ['profile', 'Inappropriate name, photo or profile text'],
    ['other', 'Something else'],
  ];
  async function sendReport() {
    reportNote = '';
    try {
      await reportPlayer(uid, reason, details.trim(), reportGame.trim());
      reportNote = 'Thank you. Our team will look into it. We do not share who reported.';
      reporting = false;
      details = '';
      reportGame = '';
    } catch (e) {
      reportNote = e instanceof Error ? e.message : 'The report could not be sent.';
    }
  }
</script>

<svelte:head><title>{player?.name ?? 'Player'} · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/friends"><Icon name="back" size={16} />Friends</a>
  {#if $session.status === 'out'}
    <div class="card pad"><p>Sign in to see Chess Castles players.</p><button class="btn primary" onclick={() => startSignIn()}>Sign in</button></div>
  {:else if relation === 'blocked' && !player}
    <div class="card pad"><p>You blocked this player. They can't see you or message you.</p></div>
  {:else if error}
    <div class="card pad"><p>{error}</p></div>
  {:else if lichessOnly}
    <section class="card hero">
      <span class="av">{lichessId.slice(0, 2).toUpperCase()}</span>
      <div class="who">
        <h1 class="display">{#if lp?.title}<span class="ltitle">{lp.title}</span> {/if}{lp?.username ?? lichessId}</h1>
        <p class="label">{lpLoaded && !lp ? 'No Lichess player with this name.' : 'On Lichess · not on Chess Castles yet'}</p>
      </div>
      {#if !lpLoaded || lp}
        <div class="actions">
          <button class="btn primary" disabled={busy || !lp} onclick={() => act('request')}><Icon name="users" size={16} />Add friend</button>
        </div>
      {/if}
    </section>
    <p class="label">Send a friend request and it waits for them: they see it when they sign in to Chess Castles with Lichess. Once you are friends you can message each other, see their games and watch them play live.</p>
    <LichessPanel id={lichessId} onprofile={(p) => ((lp = p), (lpLoaded = true))} />
  {:else if !player}
    <div class="card skel"></div>
  {:else}
    <section class="card hero">
      <span class="av">{#if photo}<img src={photo} alt="" />{:else}{initialsOf(player.name)}{/if}{#if player.online}<span class="dot" title="Online now"></span>{/if}</span>
      <div class="who">
        <h1 class="display"><TitleBadge title={player.title} size={22} />{player.name}{#if player.plan} <PlanBadge plan={player.plan} size={30} />{/if}</h1>
        {#if player.title}<div class="title-banner"><TitleBadge title={player.title} full size={14} /></div>{/if}
        {#if player.first || player.last}<p class="label">{[player.first, player.last].filter(Boolean).join(' ')}</p>{/if}
        {#if player.status}<p class="status">“{player.status}”</p>{/if}
        <p class="label">
          {#if player.country}<img class="flag" src="/flags/{player.country}.svg" alt="" width="18" height="12" /> {fedName(player.country)}{/if}
          {player.location ? ` · ${player.location}` : ''} · {player.member === false ? 'not on Chess Castles yet' : `joined ${formatDate(player.joined)}`} · @{player.username}
        </p>
      </div>
      <div class="actions">
        {#if player.playing && relation !== 'self'}
          <a class="btn live-btn" href="/watch/friend/{encodeURIComponent(uid)}"><span class="pulse"></span>Watch live</a>
        {/if}
        {#if relation === 'self'}
          <a class="btn" href="/profile">Edit my profile</a>
        {:else if relation === 'friends'}
          <a class="btn primary" href="/friends/{encodeURIComponent(uid)}"><Icon name="send" size={16} />Message</a>
          <a class="btn" href="/play?mode=online&friend={encodeURIComponent(player.username)}"><Icon name="knight" size={16} />Challenge</a>
        {:else if relation === 'incoming'}
          <button class="btn primary" disabled={busy} onclick={() => act('accept')}>Accept friend request</button>
        {:else if relation === 'outgoing'}
          <button class="btn" disabled>Request sent</button>
        {:else}
          <button class="btn primary" disabled={busy} onclick={() => act('request')}><Icon name="users" size={16} />Add friend</button>
        {/if}
      </div>
    </section>

    <section class="tiles">
      {#if player.kfideTc && Object.keys(player.kfideTc).length}
        {#each KFIDE_SPEEDS.filter((s) => player!.kfideTc?.[s]) as s (s)}
          <div class="card tile"><span class="label">CC Rating {SPEED_LABEL[s]}</span><strong class="display num">{player.kfideTc[s]!.rating}</strong><span class="label">{player.kfideTc[s]!.games} games</span></div>
        {/each}
      {:else}
        <div class="card tile"><span class="label">CC Rating</span><strong class="display num">{player.kfide ?? '—'}</strong><span class="label">{player.kfideGames} games</span></div>
      {/if}
      <div class="card tile"><span class="label">FIDE rating</span><strong class="display num">{player.fideRating ?? '—'}</strong>{#if player.fideId}<a class="label" href="/ratings/player/{player.fideId}">FIDE profile</a>{/if}</div>
    </section>

    {#if player.about}
      <section class="card pad"><h2 class="title">About</h2><p class="about">{player.about}</p></section>
    {:else if relation !== 'friends' && relation !== 'self'}
      <p class="label">Become friends to see {player.name}'s photo, location and “about me”, and to message each other.</p>
    {/if}

    {#if relation === 'friends' || relation === 'self'}
      <FriendGames {uid} name={player.name} />
    {/if}
    {#if lichessId}
      <LichessPanel id={lichessId} full={relation === 'friends' || relation === 'self'} />
    {/if}

    {#if relation === 'friends' || relation === 'incoming' || relation === 'outgoing'}
      <div class="manage">
        <button class="link" disabled={busy} onclick={() => act('remove')}>{relation === 'friends' ? 'Remove friend' : 'Cancel request'}</button>
        {#if confirmBlock}
          <span class="label">Block {player.name}? They won't be able to find or message you.</span>
          <button class="btn" onclick={() => act('block')}>Yes, block</button>
          <button class="link" onclick={() => (confirmBlock = false)}>Keep</button>
        {:else}
          <button class="link" onclick={() => (confirmBlock = true)}>Block</button>
        {/if}
        <button class="link" onclick={() => (reporting = !reporting)}>Report</button>
      </div>
    {:else if relation === 'none'}
      <div class="manage">
        {#if confirmBlock}
          <span class="label">Block {player.name}?</span>
          <button class="btn" onclick={() => act('block')}>Yes, block</button>
          <button class="link" onclick={() => (confirmBlock = false)}>Keep</button>
        {:else}
          <button class="link" onclick={() => (confirmBlock = true)}>Block</button>
        {/if}
        <button class="link" onclick={() => (reporting = !reporting)}>Report</button>
      </div>
    {/if}
    {#if reporting}
      <section class="card pad report">
        <h2 class="title">Report {player?.name ?? 'this player'}</h2>
        <fieldset>
          <legend class="label">What happened?</legend>
          {#each REASONS as [k, label] (k)}
            <label class="opt"><input type="radio" name="reason" value={k} bind:group={reason} /> {label}</label>
          {/each}
        </fieldset>
        <label class="field"><span class="label">Game link (optional)</span><input bind:value={reportGame} placeholder="https://lichess.org/… or the game's Chess Castles link" maxlength="200" /></label>
        <label class="field"><span class="label">Tell us more (optional)</span><textarea bind:value={details} rows="3" maxlength="2000"></textarea></label>
        <p class="label small">Reports are private: the player is not told who reported them. False reports on purpose break our <a href="/legal/fair-play">Fair Play policy</a>.</p>
        <div class="rbtns">
          <button class="btn primary" onclick={sendReport}>Send report</button>
          <button class="btn ghost" onclick={() => (reporting = false)}>Cancel</button>
        </div>
      </section>
    {/if}
    {#if reportNote}<p class="card pad note" role="status">{reportNote}</p>{/if}
  {/if}
</div>

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .report h2 {
    margin: 0;
    font-size: 19px;
  }
  .report fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .opt {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field input,
  .field textarea {
    font: inherit;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .small {
    font-size: 13px;
    margin: 0;
  }
  .rbtns {
    display: flex;
    gap: 8px;
  }
  .note {
    border-left: 4px solid var(--win);
  }
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
  .pad {
    padding: 18px 20px;
  }
  .pad p {
    margin: 0 0 8px;
  }
  .hero {
    padding: 18px 20px;
    display: flex;
    gap: 18px;
    align-items: center;
    flex-wrap: wrap;
  }
  .av {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    flex: none;
    display: grid;
    place-items: center;
    background: #5a3a1c;
    color: #eef3ff;
    font-size: 34px;
    font-weight: 700;
    box-shadow: 0 0 0 3px var(--gold);
  }
  .av img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  .dot {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--win);
    border: 3px solid var(--card);
  }
  .who {
    flex: 1;
    min-width: 220px;
  }
  .who h1 {
    margin: 0;
    font-size: 32px;
  }
  .who p {
    margin: 3px 0 0;
  }
  .status {
    font-style: italic;
    color: var(--gold);
  }
  .live-btn {
    border-color: var(--loss);
    gap: 8px;
  }
  .pulse {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--loss);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
  .ltitle {
    color: var(--gold);
  }
  .flag {
    vertical-align: -1px;
    border-radius: 2px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .tile {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
  }
  .tile strong {
    font-size: 32px;
  }
  .about {
    white-space: pre-wrap;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 18px;
  }
  .manage {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .link {
    border: 0;
    background: none;
    color: var(--text-2);
    font: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .skel {
    height: 200px;
  }
  .title-banner {
    margin: 2px 0 6px;
  }
</style>

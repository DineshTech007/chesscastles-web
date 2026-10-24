<script lang="ts">
  import TitleBadge from '$lib/components/TitleBadge.svelte';
import ChallengeSheet from '$lib/components/ChallengeSheet.svelte';
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
  import { lichessStatus, type LichessProfile } from '$lib/lichess';
  import { friendAction, getPlayer, initialsOf, playerPhoto, type Player, type Relation } from '$lib/social';
  import AwardsCabinet from '$lib/awards/AwardsCabinet.svelte';
  import Flair from '$lib/look/Flair.svelte';
  import Avatar from '$lib/economy/Avatar.svelte';
  import Banner from '$lib/economy/Banner.svelte';
  import NameFx from '$lib/economy/NameFx.svelte';
  import ItemArt from '$lib/economy/ItemArt.svelte';
  import { ITEM, rankOf } from '$lib/economy/core';
  import { BOARD_THEMES } from '$lib/boardTheme';
  import { t } from '$lib/i18n';

  const uid = decodeURIComponent(page.params.uid!);
  let player = $state<Player | undefined>();
  let relation = $state<Relation>('none');
  let error = $state('');
  /** The invite sheet (ChallengeSheet): a game with this player, in a room of ours when Lichess is not needed. */
  let inviting = $state(false);
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

  /**
   * Playing now: the Watch button must be on the profile itself, not only in the Friends list. It follows the
   * player while the page is open: a Lichess game (checked on Lichess) or a game on Chess Castles (asked of our server).
   */
  let lichessGame = $state<string | undefined>();
  const loaded = $derived(!!player);
  $effect(() => {
    if (!lichessId || $session.status !== 'in' || document.visibilityState === 'hidden') return;
    const check = () => lichessStatus([lichessId]).then((m) => (lichessGame = m.get(lichessId)?.playingId)).catch(() => {});
    void check();
    const t = setInterval(() => document.visibilityState === 'visible' && void check(), 20_000);
    return () => clearInterval(t);
  });
  $effect(() => {
    if (!loaded || $session.status !== 'in') return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void getPlayer(uid).then((r) => {
        if (player) player = { ...player, playing: r.player.playing, online: r.player.online };
      }, () => {});
    }, 45_000);
    return () => clearInterval(t);
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
    <section class="card hero" class:bannered={!!player.cos?.banner}>
      {#if player.cos?.banner}<div class="hb"><Banner id={player.cos.banner} /></div>{/if}
      <span class="avw"><Avatar src={photo ?? ''} text={initialsOf(player.name)} size={96} frame={player.cos?.frame ?? ''} level={player.cos?.level ?? 0} border="3px solid var(--gold)">{#if player.online}<span class="dot" title="Online now"></span>{/if}</Avatar></span>
      <div class="who">
        <h1 class="display"><TitleBadge title={player.title} size={22} /><NameFx style={player.cos?.name ?? ''}>{player.name}</NameFx>{#if player.flair} <Flair id={player.flair} size={24} />{/if}{#if player.team} <span class="team">✓ {$t('msg.team')}</span>{/if}{#if player.banned} <span class="banned">🚫 {$t('ban.badge')}</span>{/if}{#if player.plan} <PlanBadge plan={player.plan} size={30} />{/if}</h1>
        {#if player.title}<div class="title-banner"><TitleBadge title={player.title} full size={14} /></div>{/if}
        {#if player.cos?.level}<p class="castle-rank">🏰 {$t('eco.level', { n: player.cos.level })} · {rankOf(player.cos.level)}</p>{/if}
        {#if player.first || player.last}<p class="label">{[player.first, player.last].filter(Boolean).join(' ')}</p>{/if}
        {#if player.status}<p class="status">“{player.status}”</p>{/if}
        <p class="label">
          {#if player.country}<img class="flag" src="/flags/{player.country}.svg" alt="" width="18" height="12" /> {fedName(player.country)}{/if}
          {player.location ? ` · ${player.location}` : ''} · {player.member === false ? 'not on Chess Castles yet' : `joined ${formatDate(player.joined)}`} · @{player.username}
        </p>
      </div>
      <div class="actions">
        {#if relation !== 'self'}
          {#if player.playing}
            <a class="btn live-btn" href="/watch/friend/{encodeURIComponent(uid)}"><span class="pulse"></span>Watch live</a>
          {:else if lichessGame}
            <a class="btn live-btn" href="/watch/live/{lichessGame}"><span class="pulse"></span>Watch live on Lichess</a>
          {/if}
        {/if}
        {#if relation === 'self'}
          <a class="btn" href="/profile">Edit my profile</a>
        {:else if relation === 'friends'}
          <a class="btn primary" href="/friends/{encodeURIComponent(uid)}"><Icon name="send" size={16} />Message</a>
          <button class="btn" onclick={() => (inviting = true)}><Icon name="knight" size={16} />Challenge</button>
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

    <!-- Their showcase from the Castle Shop (2026-10-23): the board and pieces they play with. -->
    {#if player.cos?.board && (ITEM[player.cos.board] || player.cos.finish)}
      {@const b = player.cos.board}
      <section class="card showcase">
        <span class="sc-art"><ItemArt id={b} finish={player.cos.finish ?? ''} /></span>
        <span class="sc-t">
          <span class="label">{$t('eco.showcase')}</span>
          <strong>{BOARD_THEMES.find((x) => x.id === b)?.name ?? ''}{#if player.cos.finish && ITEM[player.cos.finish]} · {ITEM[player.cos.finish].name}{/if}</strong>
          <a href="/shop" class="label">{$t('eco.home.shop')} →</a>
        </span>
      </section>
    {/if}

    <!-- The awards they won (everyone signed in sees them). -->
    {#if player.awards?.ids.length}
      <AwardsCabinet earned={new Set(player.awards.ids)} name={player.name} rating={player.awards.puzzleRating} rushBest={player.awards.rushBest} />
    {/if}

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

{#if inviting && player}<ChallengeSheet player={{ uid, name: player.name }} onclose={() => (inviting = false)} />{/if}

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
    position: relative;
    overflow: hidden;
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
  .dot {
    z-index: 2;
    position: absolute;
    right: 4px;
    top: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--win);
    border: 3px solid var(--card);
  }
  .who {
    position: relative;
    flex: 1;
    min-width: 220px;
  }
  /* A banner from the Shop across the top of the card, the picture over its edge. */
  .hero.bannered {
    padding-top: 104px;
  }
  .hb {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 120px;
  }
  .avw {
    position: relative;
    flex: none;
  }
  .bannered .avw {
    margin-top: -46px;
  }
  .bannered .actions {
    position: relative;
  }
  .castle-rank {
    margin: 4px 0 0;
    font-weight: 700;
    font-size: 14px;
    color: var(--gold);
  }
  .showcase {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px;
  }
  .sc-art {
    width: 96px;
    flex: none;
  }
  .sc-t {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sc-t strong {
    font-family: var(--font-title);
    font-size: 19px;
  }
  .who h1 {
    margin: 0;
    font-size: 32px;
  }
  .who p {
    margin: 3px 0 0;
  }
  .team {
    font: 800 12px var(--font-body);
    color: #fff;
    background: var(--win);
    padding: 3px 8px;
    border-radius: 999px;
    vertical-align: middle;
  }
  .banned {
    font: 800 12px var(--font-body);
    color: #fff;
    background: #dc2626;
    padding: 3px 8px;
    border-radius: 999px;
    vertical-align: middle;
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

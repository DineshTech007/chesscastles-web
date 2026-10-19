<script lang="ts">
  /** Friends: your friends and messages, requests waiting, and finding players to add. */
  import { track } from '$lib/analytics';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PlayerCard from '$lib/components/PlayerCard.svelte';
  import { lichessToken, session, startSignIn } from '$lib/auth';
  import { challengeSetting } from '$lib/lichessBoard';
  import { formatDate } from '$lib/format';
  import { findPlayers, friendAction, friendsList, inbox, liveFriends, refreshBadge, type Conversation, type Player } from '$lib/social';
  import { lichessRatings, lichessStatus, searchLichess, type LichessPlayer, type LichessStatus } from '$lib/lichess';

  let tab = $state<'friends' | 'find'>('friends');
  let friends = $state<{ friends: Player[]; incoming: Player[]; outgoing: Player[] } | undefined>();
  let convos = $state<Conversation[]>([]);
  let error = $state('');
  let q = $state('');
  let found = $state<Player[] | undefined>();
  /** Lichess status of the players found (who is playing, to watch). */
  let foundLive = $state<Map<string, LichessStatus>>(new Map());
  /** Lichess players matching the search who are not on Chess Castles yet. */
  let onLichess = $state<LichessPlayer[]>([]);
  let sent = $state<Record<string, 'sending' | 'sent' | string>>({});
  /** Friends' Lichess status: online, and the game they are playing now. */
  let live = $state<Map<string, LichessStatus>>(new Map());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lichessId = (uid: string) => (uid.startsWith('lichess:') ? uid.slice(8) : '');

  async function load() {
    try {
      const [f, i] = await Promise.all([friendsList(), inbox()]);
      friends = f;
      convos = i.conversations;
      void refreshBadge();
      void refreshLive();
      void loadRatings();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Friends could not be loaded.';
    }
  }

  /** Everyone's Lichess ratings, for the cards. */
  let lichess = $state<Map<string, string>>(new Map());
  async function loadRatings() {
    const all = [...(friends?.friends ?? []), ...(friends?.incoming ?? []), ...(friends?.outgoing ?? []), ...(found ?? [])];
    const ids = [...new Set(all.map((p) => lichessId(p.uid)).filter(Boolean))].filter((id) => !lichess.has(id));
    if (!ids.length) return;
    const r = await lichessRatings(ids).catch(() => new Map());
    const next = new Map(lichess);
    for (const [id, u] of r) {
      const parts = (['blitz', 'rapid', 'classical', 'bullet'] as const).filter((k) => u.perfs[k]?.games).map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${u.perfs[k].rating}`);
      next.set(id, parts.slice(0, 3).join(' · '));
    }
    lichess = next;
  }
  const lich = (p: Player) => lichess.get(lichessId(p.uid)) ?? '';

  /** Friends playing on Chess Castles right now (games against its bots). */
  let onChessCastles = $state<Set<string>>(new Set());
  async function refreshLive() {
    const ids = (friends?.friends ?? []).map((p) => lichessId(p.uid)).filter(Boolean);
    const [l, k] = await Promise.all([lichessStatus(ids).catch(() => new Map()), liveFriends().catch(() => [])]);
    live = l;
    onChessCastles = new Set(k.filter((g) => !g.over).map((g) => g.uid));
  }

  $effect(() => {
    if ($session.status === 'in') void load();
  });
  /** The player's Lichess challenge setting: friends can only challenge them if Lichess allows it. */
  let challengePref = $state<number | undefined>();
  $effect(() => {
    const t = $session.status === 'in' ? lichessToken()?.token : undefined;
    if (t) void challengeSetting(t).then((c) => (challengePref = c));
  });
  const WHO: Record<number, string> = { 1: 'nobody', 2: 'only players near your rating', 3: 'only your Lichess friends' };
  // Who is playing right now, kept fresh while the page is open.
  $effect(() => {
    if (tab !== 'friends') return;
    const t = setInterval(refreshLive, 30_000);
    return () => clearInterval(t);
  });
  onMount(() => {
    if (new URLSearchParams(location.search).get('tab') === 'find') tab = 'find';
  });

  $effect(() => {
    const query = q;
    if (tab !== 'find' || $session.status !== 'in') return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const [k, l] = await Promise.all([findPlayers(query.trim()).catch(() => [] as Player[]), searchLichess(query).catch(() => [])]);
      found = k;
      void loadRatings();
      const known = new Set(k.map((p) => p.uid));
      onLichess = l.filter((p) => !known.has(`lichess:${p.id}`)).slice(0, 8);
      // Who of them is playing on Lichess right now (to watch).
      const st = await lichessStatus([...onLichess.map((p) => p.id), ...k.map((p) => lichessId(p.uid)).filter(Boolean)]).catch(() => new Map());
      foundLive = st;
    }, 300);
  });

  async function act(uid: string, a: 'accept' | 'remove') {
    await friendAction(uid, a).catch(() => {});
    await load();
  }
  const convoWith = (uid: string) => convos.find((c) => c.player.uid === uid);

  /** A friend request to a Lichess player; it waits for them if they are not on Chess Castles yet. */
  async function addLichess(p: LichessPlayer) {
    sent = { ...sent, [p.id]: 'sending' };
    try {
      track('feature', 'friend_request');
      await friendAction(`lichess:${p.id}`, 'request', p.name);
      sent = { ...sent, [p.id]: 'sent' };
      void load();
    } catch (e) {
      sent = { ...sent, [p.id]: e instanceof Error ? e.message : 'That did not work.' };
    }
  }
  let copied = $state(false);
  async function copyInvite() {
    await navigator.clipboard?.writeText(`${location.origin}/friends`).catch(() => {});
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<svelte:head><title>Friends · Chess Castles</title></svelte:head>

<div class="page">
  <header class="head">
    <div>
      <h1 class="display">Friends</h1>
      <p class="label">Add the players you know, message them, and challenge them to a game.</p>
    </div>
    <div class="segmented" role="group" aria-label="Show">
      <button aria-pressed={tab === 'friends'} onclick={() => (tab = 'friends')}>My friends</button>
      <button aria-pressed={tab === 'find'} onclick={() => (tab = 'find')}>Find players</button>
    </div>
  </header>

  {#if $session.status === 'out'}
    <div class="card empty">
      <p>Friends, messages and challenges need a Chess Castles account.</p>
      <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
    </div>
  {:else if error}
    <p class="label">{error}</p>
  {:else if tab === 'friends'}
    {#if challengePref !== undefined && challengePref <= 3}
      <div class="card warn-card" role="note">
        <strong>Your friends' challenges come as a message.</strong>
        <span>Your Lichess settings let {WHO[challengePref]} challenge you, so a Chess Castles friend's challenge arrives in Messages with a <em>Join the game</em> button. To get challenges straight away, open <em>Preferences → Privacy → Let other players challenge you</em> on Lichess and choose <em>Always</em>.</span>
      </div>
    {/if}
    {#if !friends}
      <div class="card skel"></div>
    {:else}
      {#if friends.incoming.length}
        <section class="card block">
          <h2 class="title">Friend requests</h2>
          {#each friends.incoming as p (p.uid)}
            <div class="req">
              <PlayerCard {p} lichess={lich(p)} note="wants to be your friend" />
              <div class="req-btns">
                <button class="btn primary" onclick={() => act(p.uid, 'accept')}>Accept</button>
                <button class="btn ghost" onclick={() => act(p.uid, 'remove')}>Decline</button>
              </div>
            </div>
          {/each}
        </section>
      {/if}

      <section class="card block">
        <h2 class="title">My friends ({friends.friends.length})</h2>
        {#if !friends.friends.length}
          <p class="label">No friends yet. <button class="link" onclick={() => (tab = 'find')}>Find players</button> you know and send them a request.</p>
        {:else}
          <div class="list">
            {#each [...friends.friends].sort((a, b) => Number(!!live.get(lichessId(b.uid))?.playingId || onChessCastles.has(b.uid)) - Number(!!live.get(lichessId(a.uid))?.playingId || onChessCastles.has(a.uid))) as p (p.uid)}
              {@const c = convoWith(p.uid)}
              {@const st = live.get(lichessId(p.uid))}
              <div class="friend">
                <PlayerCard {p} lichess={lich(p)} note={c ? `${c.mine ? 'You: ' : ''}${c.last}` : st?.online ? 'online on Lichess' : ''} />
                <div class="f-btns">
                  {#if st?.playingId}
                    <a class="btn live-btn" href="/watch/live/{st.playingId}"><span class="pulse"></span>Watch live</a>
                  {:else if onChessCastles.has(p.uid) || p.playing}
                    <a class="btn live-btn" href="/watch/friend/{encodeURIComponent(p.uid)}"><span class="pulse"></span>Watch live</a>
                  {/if}
                  <a class="btn" href="/friends/{encodeURIComponent(p.uid)}"><Icon name="send" size={16} />Message{#if c?.unread}<span class="badge">{c.unread}</span>{/if}</a>
                  <a class="btn ghost" href="/play?mode=online&friend={encodeURIComponent(p.username)}"><Icon name="knight" size={16} />Challenge</a>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      {#if friends.outgoing.length}
        <section class="card block">
          <h2 class="title">Requests you sent</h2>
          <div class="list">
            {#each friends.outgoing as p (p.uid)}<PlayerCard {p} lichess={lich(p)} note={p.member === false ? 'not on Chess Castles yet: they will see it when they sign in' : 'waiting for an answer'} />{/each}
          </div>
        </section>
      {/if}

      {#if convos.some((c) => !friends!.friends.some((f) => f.uid === c.player.uid))}
        <p class="label">Older conversations with players who are no longer friends are hidden.</p>
      {/if}
      <p class="label safe">Safe by design: only friends (both said yes) can message each other or see each other's photo and details. You can remove or block anyone from their profile.</p>
    {/if}
  {:else}
    <section class="card block">
      <label class="search">
        <Icon name="search" size={18} color="var(--muted)" />
        <input id="find-players" bind:value={q} placeholder="Search by name or username" aria-label="Search players" />
      </label>
      <p class="label hint">Friends can message and challenge each other, see each other's games and watch them play live.</p>
      {#if !found}
        <div class="skel small"></div>
      {:else if !found.length}
        {#if !onLichess.length}<p class="label">No player found{q ? ` for “${q}”` : ''}.{q.trim().length < 3 ? ' Type at least 3 letters to search Lichess too.' : ''}</p>{/if}
      {:else}
        <p class="label">{q ? 'Matching players' : 'Recently active players'}</p>
        <div class="list">
          {#each found as p (p.uid)}
            {@const lid = foundLive.get(lichessId(p.uid))?.playingId}
            <div class="friend">
              <PlayerCard {p} lichess={lich(p)} note={`joined ${formatDate(p.joined)}`} />
              {#if p.playing}
                <a class="btn live-btn" href="/watch/friend/{encodeURIComponent(p.uid)}"><span class="pulse"></span>Watch</a>
              {:else if lid}
                <a class="btn live-btn" href="/watch/live/{lid}"><span class="pulse"></span>Watch</a>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      {#if onLichess.length}
        <h3 class="sub-h">On Lichess</h3>
        <div class="list">
          {#each onLichess as p (p.id)}
            <div class="lrow">
              <a class="lname" href="/players/{encodeURIComponent(`lichess:${p.id}`)}">
                <span class="lav">{p.name.slice(0, 2).toUpperCase()}{#if p.online}<span class="dot" title="Online on Lichess"></span>{/if}</span>
                <span>{#if p.title}<strong class="ltitle">{p.title}</strong> {/if}<strong>{p.name}</strong><span class="label"> · Lichess{p.online ? ' · online' : ''}</span></span>
              </a>
              {#if foundLive.get(p.id)?.playingId}
                <a class="btn live-btn" href="/watch/live/{foundLive.get(p.id)!.playingId}"><span class="pulse"></span>Watch</a>
              {/if}
              {#if sent[p.id] === 'sent'}
                <span class="label ok">Request sent ✓</span>
              {:else if sent[p.id] && sent[p.id] !== 'sending'}
                <span class="label err">{sent[p.id]}</span>
              {:else}
                <button class="btn primary" disabled={sent[p.id] === 'sending'} onclick={() => addLichess(p)}><Icon name="users" size={16} />Add friend</button>
              {/if}
            </div>
          {/each}
        </div>
        <p class="label">Players who are not on Chess Castles yet see your request when they sign in with Lichess.
          <button class="link" onclick={copyInvite}>{copied ? 'Link copied' : 'Copy an invite link'}</button> to send them.</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 40px;
  }
  .head p {
    margin: 4px 0 0;
  }
  .block {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .block h2 {
    margin: 0;
    font-size: 19px;
  }
  .block p {
    margin: 0;
  }
  .warn-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-left: 4px solid var(--gold);
    font-size: 14.5px;
  }
  .list {
    display: grid;
    gap: 8px;
  }
  .hint {
    font-size: 13.5px;
  }
  .sub-h {
    margin: 8px 0 0;
    font-size: 15px;
  }
  .lrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-card);
    background: var(--card);
    flex-wrap: wrap;
  }
  .lname {
    flex: 1 1 200px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
    min-width: 0;
  }
  .lav {
    position: relative;
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--raised);
    font-weight: 700;
    font-size: 13px;
  }
  .lav .dot {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--win);
    border: 2px solid var(--card);
  }
  .ltitle {
    color: var(--gold);
  }
  .ok {
    color: var(--win);
  }
  .err {
    color: var(--loss);
  }
  .live-btn {
    border-color: var(--loss);
    color: var(--text);
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
  .req,
  .friend {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .req > :global(.pc),
  .friend > :global(.pc) {
    flex: 1 1 280px;
    min-width: 0;
  }
  .req-btns,
  .f-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }
  .f-btns .btn,
  .req-btns .btn {
    white-space: nowrap;
  }
  /* Phones: the buttons share the full width under the player, never wider than the screen. */
  @media (max-width: 560px) {
    .req-btns,
    .f-btns {
      width: 100%;
    }
    .f-btns .btn,
    .req-btns .btn {
      flex: 1 1 auto;
      justify-content: center;
    }
  }
  .badge {
    margin-left: 6px;
    min-width: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--loss);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .empty {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .empty p {
    margin: 0;
  }
  .safe {
    margin: 0;
  }
  .skel {
    height: 200px;
  }
  .skel.small {
    height: 120px;
  }
</style>

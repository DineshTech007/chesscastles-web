<script lang="ts">
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { track } from '$lib/analytics';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import ChallengeSheet from './ChallengeSheet.svelte';
  import { lichessToken, session, startLichessSignIn } from '$lib/auth';
  import { answerInvite, cancelSent, invitePlayer, markAnswered, myInvites, sentInvite } from '$lib/invites';
  import { poll } from '$lib/poll';
  import * as api from '$lib/lichessBoard';
  import { lichessRatings } from '$lib/lichess';
  import { onLichessEvent, openWhenStarted, syncLichessEvents } from '$lib/lichessEvents';
  import { friendsList, getPlayer, onlinePlayers, serverResting, lobbyLeave, lobbySeek, lobbyState, sendMessage, type LobbyRole, type LobbySeek, type LobbyState, type OnlinePlayer, type Player } from '$lib/social';

  /** `onfide`: switches the Play page to the FIDE-level opponents (offered when no one is free). */
  let { onfide }: { onfide?: () => void } = $props();

  type Kind = 'pair' | 'lobby' | 'friend' | 'ai';
  interface Tc {
    m: number;
    i: number;
  }
  /**
   * The time controls Chess Castles players can play on Lichess. Lichess lets
   * apps play blitz only by direct challenge, rapid and classical also by
   * seeking anyone on Lichess, and bullet not at all (only on its own site).
   * Quick pairing therefore pairs Chess Castles players here (the lobby) and
   * one sends the other a Lichess challenge, accepted at once; at rapid and
   * classical it also seeks on all of Lichess, whichever comes first.
   */
  const TCS: Tc[] = [
    { m: 3, i: 0 },
    { m: 3, i: 2 },
    { m: 5, i: 0 },
    { m: 5, i: 3 },
    { m: 10, i: 0 },
    { m: 10, i: 5 },
    { m: 15, i: 10 },
    { m: 30, i: 0 },
    { m: 30, i: 20 },
  ];
  /**
   * Bullet with a friend (owner's request, 2026-10-21): Lichess plays bullet only on its own site and app, so these are
   * friendly games on Chess Castles' own server instead (2026-10-23: never Lichess; see src/lib/invites.ts).
   */
  const BULLET: Tc[] = [
    { m: 1, i: 0 },
    { m: 1, i: 1 },
  ];
  let bullet = $state<Tc | undefined>();
  const key = (t: Tc) => `${t.m}+${t.i}`;
  const tcOf = (k: string) => TCS.find((t) => key(t) === k) ?? TCS[4];
  /** Lichess's speeds, from the estimated game time (minutes + 40 × increment). */
  const speed = (t: Tc) => {
    const est = t.m * 60 + t.i * 40;
    return est < 180 ? 'Bullet' : est < 480 ? 'Blitz' : est < 1500 ? 'Rapid' : 'Classical';
  };
  /** Rapid and classical can also seek anyone on Lichess. */
  const lichessWide = (t: Tc) => speed(t) !== 'Blitz';

  // Coming from a friend's page ("Challenge"): the friend is filled in.
  const preset = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('friend') : null;
  let kind = $state<Kind>(preset ? 'friend' : 'pair');
  /** 10+0. */
  let tcIdx = $state(4);
  let rated = $state(true);
  let username = $state(preset ?? '');
  // Picking the friend: your Chess Castles friends to tap (Lichess and Google accounts), and Lichess names as you type.
  let ccFriends = $state<{ uid: string; username: string; name: string; playing?: boolean }[]>([]);
  let lichessSuggest = $state<{ id: string; name: string; title?: string; online?: boolean }[]>([]);
  let acOpen = $state(false);
  let acTimer: ReturnType<typeof setTimeout> | undefined;
  let friendsLoaded = false;
  $effect(() => {
    if (kind !== 'friend' || friendsLoaded || $session.status !== 'in') return;
    friendsLoaded = true;
    friendsList().then(
      (r) =>
        (ccFriends = r.friends
          .filter((p) => p.member !== false && (p.username || p.uid.startsWith('lichess:')))
          .map((p) => ({ uid: p.uid, username: p.username || p.uid.slice(8), name: p.name, playing: (p as { playing?: boolean }).playing }))),
      () => {},
    );
  });
  $effect(() => {
    const term = username.trim();
    clearTimeout(acTimer);
    if (kind !== 'friend' || term.length < 2) {
      lichessSuggest = [];
      return;
    }
    acTimer = setTimeout(async () => {
      const list = await api.autocompletePlayers(term, lichessToken()?.token).catch(() => []);
      if (username.trim() === term) lichessSuggest = list;
    }, 250);
  });
  /** Friends first (matching what is typed), then Lichess players. */
  const matches = $derived.by(() => {
    const term = username.trim().toLowerCase();
    const fr = ccFriends
      .filter((f) => !term || f.username.toLowerCase().includes(term) || f.name.toLowerCase().includes(term))
      .map((f) => ({ id: f.username.toLowerCase(), name: f.username, label: f.name !== f.username ? f.name : '', friend: true, online: !!f.playing, title: undefined as string | undefined }));
    const seen = new Set(fr.map((f) => f.id));
    const li = lichessSuggest.filter((p) => !seen.has(p.id)).map((p) => ({ id: p.id, name: p.name, label: '', friend: false, online: !!p.online, title: p.title }));
    return [...fr, ...li].filter((m) => m.id !== term).slice(0, 8);
  });
  function pickName(name: string) {
    username = name;
    acOpen = false;
  }
  let level = $state(4);
  let color = $state<'random' | 'white' | 'black'>('random');
  let waiting = $state<{ text: string; cancel: () => void } | undefined>();
  let error = $state('');
  let ongoing = $state<{ gameId: string; color: string; opponent: string }[]>([]);
  let events: AbortController | undefined;
  /** Who may challenge you on Lichess (see challengeSetting): 3 or less blocks some lobby games. */
  let challengePref = $state<number | undefined>();

  /** The lobby as last polled: Chess Castles players waiting for a game. */
  let lobby = $state<LobbyState | undefined>();
  /** Your lobby seek while waiting. */
  let pool = $state<{ tc: Tc; rated: boolean; started: number; role?: LobbyRole; partner?: LobbySeek; pairedAt?: number; challengeId?: string } | undefined>();
  /** Lichess challenges received while waiting, by challenger id (the partner's may arrive before we hear we're paired). */
  const incoming = new Map<string, { id: string; limit: number; increment: number; rated: boolean }>();
  let lichessSeek: AbortController | undefined;
  let now = $state(Date.now());
  let ratingCache: Record<string, number> | undefined;

  const token = $derived($session.status === 'in' ? lichessToken()?.token : undefined);
  const myId = $derived($session.status === 'in' ? $session.uid : '');
  /**
   * The lobby (owner, 2026-10-21: "like Lichess, our own lobby where they can see the players and send a request"):
   * Chess Castles players on the site now, each with Challenge (an invite with a popup on their screen:
   * src/lib/invites.ts; without a Lichess account on either side the game is in a room of our own), every 30 seconds
   * while the lobby is open.
   */
  let here = $state<OnlinePlayer[] | undefined>();
  let inviting = $state<{ uid: string; name: string } | undefined>();
  $effect(() => {
    if (kind !== 'lobby' || $session.status !== 'in') return;
    return poll(async () => {
      const me = myId;
      here = (await onlinePlayers()).filter((p) => p.uid !== me);
      return true;
    }, 30_000);
  });
  /** Players waiting at each time control (same rated/casual choice as yours). */
  const waitingAt = $derived.by(() => {
    const n: Record<string, number> = {};
    for (const s of lobby?.seeks ?? []) if (s.rated === rated) n[s.tc] = (n[s.tc] ?? 0) + 1;
    return n;
  });

  onMount(() => {
    const t = lichessToken()?.token;
    if (t) {
      listen(t);
      void api.challengeSetting(t).then((c) => (challengePref = c));
    }
    const clock = setInterval(() => (now = Date.now()), 1000);
    let timer: ReturnType<typeof setTimeout>;
    // The lobby, every 3 s while you wait and 6 s otherwise (not while the tab is hidden).
    const poll = async () => {
      if (lichessToken() && document.visibilityState === 'visible' && !serverResting()) await refreshLobby();
      timer = setTimeout(poll, pool ? 4000 : 15_000);
    };
    void poll();
    return () => {
      clearInterval(clock);
      clearTimeout(timer);
    };
  });
  onDestroy(() => {
    events?.abort();
    unlisten?.();
    lichessSeek?.abort();
    if (pool) void lobbyLeave().catch(() => {});
    waiting?.cancel();
  });

  /** Lichess tells us when a game starts (ours, or one already running), and of challenges (the site's one shared stream). */
  let unlisten: (() => void) | undefined;
  function listen(_t: string) {
    if (unlisten) return;
    events = new AbortController();
    syncLichessEvents();
    unlisten = onLichessEvent((e) => {
          if (e.type === 'challengeDeclined' && waiting && e.challenge?.id === sentId) {
            const why = e.challenge?.declineReason ? ` (${e.challenge.declineReason})` : '';
            waiting = undefined;
            error = `${e.challenge?.destUser?.name ?? 'Your friend'} declined the challenge${why}.`;
            return;
          }
          if (e.type === 'challenge') return onChallenge(e.challenge);
          if (e.type !== 'gameStart') return;
          const g = e.game;
          if (waiting) {
            if (pool) void lobbyLeave(true).catch(() => {});
            lichessSeek?.abort();
            pool = undefined;
            waiting = undefined;
            goto(`/play/online/${g.gameId}?c=${g.color}`);
          } else if (!ongoing.some((x) => x.gameId === g.gameId)) {
            ongoing = [...ongoing, { gameId: g.gameId, color: g.color, opponent: g.opponent?.username ?? (g.opponent?.ai ? `Stockfish level ${g.opponent.ai}` : 'Opponent') }];
          }
    });
  }
  /** The challenge sent from here and waiting for an answer. */
  let sentId = '';

  /** Challenges that arrive while waiting; only the paired player's is accepted (see tryAccept). */
  function onChallenge(c: { id: string; challenger?: { id: string }; timeControl?: { limit?: number; increment?: number }; rated?: boolean; status?: string }) {
    if (!pool || !c?.challenger || c.status === 'canceled') return;
    incoming.set(c.challenger.id, { id: c.id, limit: c.timeControl?.limit ?? 0, increment: c.timeControl?.increment ?? 0, rated: !!c.rated });
    tryAccept();
  }

  /** Accepts the paired player's challenge, if it has arrived and matches the game agreed. */
  function tryAccept() {
    const t = lichessToken()?.token;
    if (!t || !pool || pool.role !== 'accept' || !pool.partner) return;
    const id = pool.partner.lichess.toLowerCase();
    const c = incoming.get(id);
    if (!c || c.limit !== pool.tc.m * 60 || c.increment !== pool.tc.i || c.rated !== pool.rated) return;
    incoming.delete(id);
    api.acceptChallenge(t, c.id).catch(() => {});
  }

  const reseek = async () => {
    if (pool) await lobbySeek({ tc: key(pool.tc), rated: pool.rated, rating: await myRating(pool.tc) }).catch(() => {});
  };

  async function refreshLobby() {
    try {
      const st = await lobbyState();
      lobby = st;
      if (!pool) return;
      const mine = st.mine;
      if (!mine) {
        // Our seek expired (the tab slept): seek again.
        if (!pool.partner) await reseek();
        return;
      }
      if (mine.partner && mine.role && !pool.partner) await paired(mine.role, mine.partner);
      // Paired to accept: the partner's game may come as a Chess Castles invite (their challenge was refused by Lichess).
      if (pool.role === 'accept' && pool.partner) {
        const from = pool.partner.uid;
        const inv = (await myInvites().catch(() => [])).find((i) => i.from === from);
        const t = lichessToken()?.token;
        if (inv && t) {
          markAnswered(inv.id);
          void answerInvite(inv.id, 'accepted');
          openWhenStarted(inv.id);
          await api.acceptChallenge(t, inv.id).catch(() => {});
        }
      }
      else if (!mine.partner && pool.partner) unpaired();
      else if (pool.partner && pool.pairedAt && Date.now() - pool.pairedAt > 30_000) {
        // Paired, but no game: put both back to waiting.
        await lobbyLeave().catch(() => {});
        unpaired();
        await reseek();
      }
    } catch {
      // The lobby is a nice-to-have; Lichess pairing still works without it.
    }
  }

  /** Your Lichess rating at the speed (shown to the others in the lobby). */
  async function myRating(t: Tc): Promise<number> {
    // The Lichess login (a Google account may have connected one of any name).
    const id = (lichessToken()?.username ?? '').toLowerCase();
    if (!ratingCache && id) {
      const u = (await lichessRatings([id]).catch(() => new Map())).get(id);
      ratingCache = Object.fromEntries(Object.entries(u?.perfs ?? {}).map(([k, v]) => [k, (v as { rating: number }).rating]));
    }
    return Math.round(ratingCache?.[speed(t).toLowerCase()] ?? 1500);
  }

  function setText() {
    if (!waiting || !pool) return;
    waiting.text = pool.partner
      ? `Playing ${pool.partner.name} (${pool.partner.rating}) · starting your ${key(pool.tc)} game…`
      : `Finding an opponent for ${key(pool.tc)}${pool.rated ? ' rated' : ''}…`;
  }

  async function paired(role: LobbyRole, partner: LobbySeek) {
    if (!pool) return;
    pool.role = role;
    pool.partner = partner;
    pool.pairedAt = Date.now();
    lichessSeek?.abort();
    setText();
    const t = lichessToken()?.token;
    if (!t) return;
    if (role === 'accept') return tryAccept();
    try {
      pool.challengeId = await api.challengeUser(t, partner.lichess, { minutes: pool.tc.m, increment: pool.tc.i, rated: pool.rated, color: 'random' });
    } catch (e) {
      // Their Lichess settings refuse challenges (often "only established ratings", with a child's new rating): the
      // game goes as a Chess Castles invite instead, which their site accepts by itself (refreshLobby).
      if (api.refusedByLichess(e) && partner.uid) {
        try {
          await invitePlayer({ uid: partner.uid, name: partner.name }, pool.tc.m, pool.tc.i, pool.rated);
          pool.challengeId = $sentInvite?.id;
          return;
        } catch {
          /* below: someone else */
        }
      }
      // Not reachable: wait for someone else.
      error = `${partner.name} isn’t available right now. Finding another opponent…`;
      await lobbyLeave().catch(() => {});
      unpaired();
      await reseek();
    }
  }

  function unpaired() {
    if (!pool) return;
    const t = lichessToken()?.token;
    if (t && pool.challengeId) void api.cancelChallenge(t, pool.challengeId).catch(() => {});
    pool.partner = pool.role = pool.pairedAt = pool.challengeId = undefined;
    setText();
    if (lichessWide(pool.tc)) seekLichess(pool.tc, pool.rated);
  }

  /** Also seeks anyone on Lichess (rapid and classical); the game starts through the event stream. */
  function seekLichess(t: Tc, isRated: boolean) {
    const tok = lichessToken()?.token;
    if (!tok) return;
    lichessSeek?.abort();
    const ctl = new AbortController();
    lichessSeek = ctl;
    api.seek(tok, { minutes: t.m, increment: t.i, rated: isRated }, ctl.signal).catch((e) => {
      if (!ctl.signal.aborted && pool && !pool.partner) error = e instanceof Error ? e.message : 'The search could not start. Try again.';
    });
  }

  /** Quick pairing at `t`, or taking `join`'s open game in the lobby. */
  async function quickPair(t: Tc, join?: LobbySeek) {
    const tok = lichessToken()?.token;
    if (!tok) return;
    track('feature', join ? 'lobby_join' : `lichess_pair_${speed(t).toLowerCase()}`);
    error = '';
    if (!events) listen(tok);
    const isRated = join ? join.rated : rated;
    pool = { tc: t, rated: isRated, started: Date.now() };
    incoming.clear();
    waiting = { text: '', cancel: cancelPool };
    setText();
    try {
      const r = await lobbySeek({ tc: key(t), rated: isRated, rating: await myRating(t), join: join?.uid });
      if (r.paired) await paired(r.paired.role, r.paired.partner);
      else if (lichessWide(t)) seekLichess(t, isRated);
    } catch (e) {
      // The lobby is down: rapid and classical can still seek on Lichess.
      if (!join && lichessWide(t)) return seekLichess(t, isRated);
      pool = undefined;
      waiting = undefined;
      error = e instanceof Error ? e.message : 'Could not join the lobby.';
      void refreshLobby();
    }
  }

  function cancelPool() {
    lichessSeek?.abort();
    const t = lichessToken()?.token;
    if (t && pool?.challengeId) void api.cancelChallenge(t, pool.challengeId).catch(() => {});
    pool = undefined;
    void lobbyLeave().catch(() => {});
  }

  /** From the "no one is free" hint: try another time control. */
  function switchTo(t: Tc) {
    cancelPool();
    waiting = undefined;
    tcIdx = TCS.indexOf(t);
    void quickPair(t);
  }

  /** A bullet game with a Chess Castles friend: a friendly game on our own server (invites.ts), never on Lichess. */
  function bulletWithFriend() {
    const name = username.trim();
    const f = ccFriends.find((x) => x.username.toLowerCase() === name.toLowerCase());
    if (!f || !bullet) {
      error = 'Bullet is played between Chess Castles players. Tap a friend’s name above to invite them.';
      return;
    }
    track('feature', 'invite_bullet_friend');
    invitePlayer({ uid: f.uid, name: f.name }, bullet.m, bullet.i, rated).catch((e) => (error = e instanceof Error ? e.message : 'The invite could not be sent.'));
  }

  async function start() {
    const t = lichessToken()?.token;
    if (!t) return;
    error = '';
    if (kind === 'friend' && bullet) return bulletWithFriend();
    if (!events) listen(t);
    const tc = TCS[tcIdx];
    if (kind === 'pair') return quickPair(tc);
    try {
      track('feature', kind === 'ai' ? 'lichess_computer' : 'lichess_challenge');
      if (kind === 'ai') {
        waiting = { text: 'Starting your game against the computer…', cancel: () => {} };
        const id = await api.challengeAi(t, { level, minutes: tc.m, increment: tc.i, color });
        waiting = undefined;
        goto(`/play/online/${id}`);
      } else {
        const name = username.trim();
        if (name.length < 2) {
          error = 'Type your friend’s Lichess username.';
          return;
        }
        // A Chess Castles friend with a Google account: their Chess Castles name is not a Lichess name (it may even
        // be someone else's there), so they get a message with a button to join instead of a Lichess challenge.
        const friend = await friendNamed(name);
        if (friend && !friend.uid.startsWith('lichess:')) {
          await inviteFriend(t, friend, tc);
          return;
        }
        try {
          const id = await api.challengeUser(t, friend ? friend.uid.slice(8) : name, { minutes: tc.m, increment: tc.i, rated, color });
          sentId = id;
          openWhenStarted(id);
          waiting = {
            text: `Waiting for ${name} to accept your ${tc.m}+${tc.i} challenge… They get a pop-up on Chess Castles and a notification on Lichess.`,
            cancel: () => void api.cancelChallenge(t, id).catch(() => {}),
          };
        } catch (e) {
          if (friend && api.refusedByLichess(e)) await inviteFriend(t, friend, tc);
          else if (api.refusedByLichess(e)) {
            // On Chess Castles: an invite with a popup on their screen instead (src/lib/invites.ts).
            const member = await getPlayer(`lichess:${name.toLowerCase()}`).then((r) => r.player, () => undefined);
            if (!member?.member) throw new Error(refusalText(name, e));
            await invitePlayer({ uid: member.uid, name: member.name }, tc.m, tc.i, rated);
            waiting = {
              text: `Lichess wouldn't pass on a challenge (${member.name}'s settings there), so ${member.name} got your ${tc.m}+${tc.i} invite on Chess Castles. Waiting for them…`,
              cancel: () => cancelSent(),
            };
          } else if (e instanceof api.LichessError && /no such user/i.test(e.message)) throw new Error(`No Lichess player is called “${name}”. To play a Chess Castles friend, tap their name above; for anyone else, type their Lichess username.`);
          else throw e;
        }
      }
    } catch (e) {
      waiting = undefined;
      error = e instanceof Error ? e.message : 'The game could not start. Try again.';
    }
  }

  /** Lichess's refusal, in words a child understands, with what to do instead. */
  function refusalText(name: string, e: unknown): string {
    const m = e instanceof Error ? e.message : '';
    if (/provisional/i.test(m))
      return `Lichess didn't send it: ${name} only takes challenges from players with an established rating, and a new rating (with a “?”) isn't yet. Play a few more games on Lichess, or challenge a Chess Castles player from the Lobby.`;
    if (/too far/i.test(m)) return `Lichess didn't send it: ${name} only takes challenges from players near their rating. Try someone closer to your rating, or a Chess Castles player from the Lobby.`;
    if (/friends/i.test(m)) return `Lichess didn't send it: ${name} only takes challenges from their Lichess friends.`;
    return `Lichess didn't send it: ${name} isn't taking challenges right now. Try a Chess Castles player from the Lobby.`;
  }

  /** The Chess Castles friend with this name (their Lichess or Chess Castles username), if any. */
  async function friendNamed(name: string): Promise<Player | undefined> {
    const n = name.toLowerCase();
    const list = (await friendsList().catch(() => undefined))?.friends ?? [];
    return list.find((p) => p.uid === `lichess:${n}`) ?? list.find((p) => p.username.toLowerCase() === n);
  }

  /**
   * A friend Lichess can't challenge by name: a game only you two get the link to, and a Chess Castles message with
   * its Join button. A Lichess friend whose settings refuse challenges: only the two names can join. A friend with a
   * Google account (their Lichess name, if they have one, isn't known here): the link is theirs alone, and the join
   * page connects their free Lichess account first.
   */
  async function inviteFriend(t: string, friend: Player, tc: Tc) {
    const me = lichessToken()?.username;
    if (!me) throw new Error('Connect your Lichess account to play online.');
    const theirs = friend.uid.startsWith('lichess:') ? friend.uid.slice(8) : undefined;
    const meWhite = color === 'white' || (color !== 'black' && Math.random() < 0.5);
    const id = await api.openChallenge(t, theirs ? { white: meWhite ? me : theirs, black: meWhite ? theirs : me, minutes: tc.m, increment: tc.i, rated } : { minutes: tc.m, increment: tc.i, rated });
    await api.acceptChallenge(t, id);
    openWhenStarted(id);
    await sendMessage(friend.uid, `⚔️ I challenge you to a ${tc.m}+${tc.i} ${rated ? 'rated' : 'casual'} game! Join: https://chesscastles.com/play/join/${id}?c=${meWhite ? 'black' : 'white'}`);
    waiting = {
      text: theirs
        ? `${friend.name}'s Lichess settings don't take challenges, so we sent them a message with a button to join your ${tc.m}+${tc.i} game. Waiting for them…`
        : `We sent ${friend.name} a message on Chess Castles with a button to join your ${tc.m}+${tc.i} game (online games use a free Lichess account; connecting theirs takes a minute). Waiting for them…`,
      cancel: () => void api.cancelChallenge(t, id).catch(() => {}),
    };
  }

  function cancel() {
    waiting?.cancel();
    waiting = undefined;
  }

  const ago = (since: number) => {
    const s = Math.max(0, Math.round((now - since) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
  };
</script>

{#if !token}
  <div class="gate">
    <Icon name="globe" size={30} color="var(--accent)" />
    {#if $session.status === 'in'}
      <p>Online games use a free Lichess account. Connect yours once to play real opponents: quick pairing, the lobby, a friend or the computer.</p>
      <button class="btn primary big block" onclick={() => startLichessSignIn(true)}>Connect your Lichess account</button>
    {:else}
      <p>Play real opponents online: quick pairing, the lobby, a friend or the computer.</p>
      <button class="btn primary big block" onclick={() => startLichessSignIn()}>Sign in with Lichess</button>
    {/if}
  </div>
{:else if waiting}
  <div class="waiting">
    <span class="spinner" aria-hidden="true"></span>
    <p class="title">{waiting.text}</p>
    {#if pool && !pool.partner}
      <p class="label">Waiting {ago(pool.started)}</p>
      {#if now - pool.started > 30_000}
        <div class="lock-note" role="status">
          <p><strong>No one is free for {key(pool.tc)} yet.</strong> Keep waiting, or try:</p>
          <div class="lock-btns">
            {#if !lichessWide(pool.tc)}
              <button class="btn" onclick={() => switchTo(TCS[4])}>Play 10+0 instead</button>
            {/if}
            {#if onfide}<button class="btn" onclick={() => (cancel(), onfide())}>A FIDE-level opponent now</button>{/if}
          </div>
        </div>
      {/if}
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn" onclick={cancel}>Cancel</button>
  </div>
{:else}
  {#if ongoing.length}
    <div class="ongoing">
      <h3 class="title h">Your games in progress</h3>
      {#each ongoing as g (g.gameId)}
        <a class="resume" href="/play/online/{g.gameId}?c={g.color}">vs {g.opponent}<span>Resume <Icon name="chevron" size={14} /></span></a>
      {/each}
    </div>
  {/if}

  <div class="segmented kinds" role="group" aria-label="Opponent">
    <button aria-pressed={kind === 'pair'} onclick={() => (kind = 'pair')}>Quick pairing</button>
    <button aria-pressed={kind === 'lobby'} onclick={() => (kind = 'lobby')}>Lobby{lobby?.seeks.length ? ` · ${lobby.seeks.length}` : ''}</button>
    <button aria-pressed={kind === 'friend'} onclick={() => (kind = 'friend')}>A friend</button>
    <button aria-pressed={kind === 'ai'} onclick={() => (kind = 'ai')}>Computer</button>
  </div>

  {#if (kind === 'pair' || kind === 'lobby') && challengePref !== undefined && challengePref <= 3}
    <div class="lock-note" role="note">
      <p>
        <strong>Allow challenges to get paired.</strong> On Lichess, open <em>Preferences → Privacy → Let other players challenge you</em> and choose <em>Always</em>.
      </p>
    </div>
  {/if}

  {#if kind === 'lobby'}
    <div class="group">
      <h3 class="title h">Players online now</h3>
      {#if !here}
        <div class="seek skel"></div>
      {:else if !here.length}
        <p class="label empty">No one else who plays online is on Chess Castles right now. Start a <button class="link" onclick={() => (kind = 'pair')}>quick pairing</button> and they will see you here.</p>
      {:else}
        <ul class="seeks">
          {#each here as p (p.uid)}
            <li class="seek here">
              <span class="who"><a href="/players/{encodeURIComponent(p.uid)}"><TitleBadge title={p.title} size={11} />{p.name}</a>{#if p.kfide}<span class="label num">CC {p.kfide}</span>{/if}</span>
              <span class="label">{p.playing ? 'Playing now' : 'Online'}</span>
              <button class="btn primary sm" disabled={p.playing} onclick={() => (inviting = { uid: p.uid, name: p.name })}>Challenge</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="group">
      <h3 class="title h">Chess Castles players waiting</h3>
      {#if !lobby}
        <div class="seek skel"></div>
      {:else if !lobby.seeks.length}
        <p class="label empty">
          No one is waiting right now. Start a <button class="link" onclick={() => (kind = 'pair')}>quick pairing</button> and other Chess Castles players will see you here.
        </p>
      {:else}
        <ul class="seeks">
          {#each lobby.seeks as s (s.uid)}
            {@const t = tcOf(s.tc)}
            <li class="seek">
              <span class="who"><a href="/players/{encodeURIComponent(s.uid)}"><TitleBadge title={s.title} size={11} />{s.name}{#if s.plan} <PlanBadge plan={s.plan} />{/if}</a><span class="label num">{s.rating}</span></span>
              <span class="tc"><strong class="num">{s.tc}</strong><span class="label">{speed(t)} · {s.rated ? 'Rated' : 'Casual'}</span></span>
              <span class="label age">{ago(s.since)}</span>
              <button class="btn primary sm" disabled={s.uid === myId} onclick={() => quickPair(t, s)}>Play</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    {#if kind === 'friend'}
      <div class="field">
        <label class="title h" for="friend-name">Your friend</label>
        {#if ccFriends.length}
          <div class="fr-chips" role="group" aria-label="Your Chess Castles friends">
            {#each ccFriends as f (f.username)}
              <button class="chip" aria-pressed={username.trim().toLowerCase() === f.username.toLowerCase()} onclick={() => pickName(f.username)}>
                {#if f.playing}<span class="live-dot" title="Playing now"></span>{/if}{f.name}
              </button>
            {/each}
          </div>
        {/if}
        <div class="ac">
          <input
            id="friend-name"
            type="text"
            bind:value={username}
            placeholder={ccFriends.length ? 'Or type a Lichess username' : 'Type a Lichess username'}
            autocomplete="off"
            role="combobox"
            aria-expanded={acOpen && matches.length > 0}
            aria-controls="friend-ac"
            aria-autocomplete="list"
            onfocus={() => (acOpen = true)}
            oninput={() => (acOpen = true)}
            onblur={() => setTimeout(() => (acOpen = false), 150)}
            onkeydown={(e) => e.key === 'Escape' && (acOpen = false)}
          />
          {#if acOpen && matches.length && username.trim().length >= 1}
            <ul id="friend-ac" class="ac-list" role="listbox" aria-label="Players">
              {#each matches as m (m.id)}
                <li role="option" aria-selected="false">
                  <button type="button" onmousedown={(e) => e.preventDefault()} onclick={() => pickName(m.name)}>
                    {#if m.online}<span class="live-dot" title="Online"></span>{/if}
                    {#if m.title}<span class="ac-title">{m.title}</span>{/if}
                    <strong>{m.name}</strong>
                    {#if m.label}<span class="label">{m.label}</span>{/if}
                    {#if m.friend}<span class="ac-friend">Friend</span>{/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    {:else if kind === 'ai'}
      <div class="group">
        <h3 class="title h">Level</h3>
        <div class="levels">
          {#each [1, 2, 3, 4, 5, 6, 7, 8] as l (l)}
            <button class="chip" aria-pressed={level === l} onclick={() => (level = l)}>{l}</button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="group">
      <h3 class="title h">Time control</h3>
      <div class="tcs">
        {#if kind === 'friend'}
          {#each BULLET as t (key(t))}
            <button class="tile" aria-pressed={bullet === t} onclick={() => (bullet = t)}>
              <span class="title num">{key(t)}</span><span class="label">Bullet · friendly</span>
            </button>
          {/each}
        {/if}
        {#each TCS as t, idx (key(t))}
          {@const n = kind === 'pair' ? (waitingAt[key(t)] ?? 0) : 0}
          <button class="tile" aria-pressed={tcIdx === idx && !(kind === 'friend' && bullet)} onclick={() => ((tcIdx = idx), (bullet = undefined))}>
            <span class="title num">{key(t)}</span><span class="label">{speed(t)}</span>
            {#if n}<span class="badge">{n} waiting</span>{/if}
          </button>
        {/each}
      </div>
      {#if kind === 'friend' && bullet}
        <p class="label bullet-note">Bullet is a friendly game played here on Chess Castles with a friend. It does not change anyone's rating.</p>
      {/if}
    </div>

    {#if kind !== 'pair'}
      <div class="group">
        <h3 class="title h">You play</h3>
        <div class="segmented" role="group" aria-label="Your colour">
          <button aria-pressed={color === 'white'} onclick={() => (color = 'white')}>White</button>
          <button aria-pressed={color === 'random'} onclick={() => (color = 'random')}>Random</button>
          <button aria-pressed={color === 'black'} onclick={() => (color = 'black')}>Black</button>
        </div>
      </div>
    {/if}
    {#if kind !== 'ai'}
      <label class="toggle"><input type="checkbox" bind:checked={rated} /><span>Rated game</span></label>
    {/if}

    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn primary big block" onclick={start}>
      <Icon name="play" size={18} fill color="currentColor" />
      {kind === 'pair' ? `Find an opponent · ${key(TCS[tcIdx])}` : kind === 'friend' ? (bullet ? `Invite · ${key(bullet)} bullet` : 'Send challenge') : `Play level ${level}`}
    </button>
  {/if}
{/if}

{#if inviting}<ChallengeSheet player={inviting} onclose={() => (inviting = undefined)} />{/if}

<style>
  @media (max-width: 480px) {
    .kinds button {
      font-size: 13px;
      line-height: 1.15;
      padding: 2px;
    }
  }
  .badge {
    margin-top: 3px;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 22%, transparent);
    color: var(--text);
  }
  .tile[aria-pressed='true'] .badge {
    background: color-mix(in srgb, var(--on-action) 18%, transparent);
    color: var(--on-action);
  }
  .seeks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seek {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto auto;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--raised);
    min-height: 52px;
  }
  .seek.skel {
    display: block;
  }
  .seek.here {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }
  .who,
  .tc {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }
  .who a {
    font-weight: 700;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .btn.sm {
    min-height: 36px;
    padding: 0 16px;
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    color: var(--accent);
    font-weight: 700;
    cursor: pointer;
  }
  .empty {
    margin: 0;
  }
  @media (max-width: 420px) {
    .seek {
      grid-template-columns: minmax(0, 1fr) auto auto;
    }
    .seek .age {
      display: none;
    }
  }
  .lock-note {
    padding: 10px 12px;
    border-radius: 10px;
    border-left: 4px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 9%, transparent);
    text-align: left;
  }
  .lock-note p {
    margin: 0;
    font-size: 14px;
  }
  .lock-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .lock-btns .btn {
    gap: 6px;
    font-size: 13.5px;
    min-height: 36px;
  }
  .gate,
  .waiting {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 20px 6px;
  }
  .gate p,
  .waiting .label {
    margin: 0;
    color: var(--text-2);
  }
  .waiting .title {
    margin: 0;
    font-size: 18px;
  }
  .spinner {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 4px solid var(--raised);
    border-top-color: var(--brand);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .ongoing {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .resume {
    display: flex;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--raised);
    color: var(--text);
    font-weight: 600;
  }
  .resume span {
    color: var(--accent);
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .group,
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .h {
    font-size: 16px;
    color: var(--accent);
    margin: 0;
  }
  .fr-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 104px;
    overflow-y: auto;
  }
  .fr-chips .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .live-dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--win);
  }
  .ac {
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .ac-list {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 4px;
    list-style: none;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--card);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    max-height: 280px;
    overflow-y: auto;
  }
  .ac-list button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 6px 10px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .ac-list button:hover,
  .ac-list button:focus-visible {
    background: var(--raised);
  }
  .ac-title {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--gold);
    color: #1b1300;
  }
  .ac-friend {
    margin-left: auto;
    font-size: 11px;
    font-weight: 800;
    color: var(--win);
  }
  .field input {
    height: 46px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 12px;
    font: inherit;
  }
  .levels {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tcs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 9px 4px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    cursor: pointer;
  }
  .tile .title {
    font-size: 18px;
  }
  .tile[aria-pressed='true'] {
    background: var(--action);
    border-color: var(--action);
    color: var(--on-action);
  }
  .tile[aria-pressed='true'] .label {
    color: color-mix(in srgb, var(--on-action) 80%, transparent);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }
  .toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--action);
  }
  .bullet-note {
    margin: 8px 0 0;
    font-size: 13px;
  }
  .error {
    margin: 0;
    color: var(--loss);
  }
</style>

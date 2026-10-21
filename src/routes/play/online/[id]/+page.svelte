<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import type { Key } from '@lichess-org/chessground/types';
  import { makeBoardFen } from 'chessops/fen';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ShareGame from '$lib/components/ShareGame.svelte';
  import GameOverSheet from '$lib/components/GameOverSheet.svelte';
  import MoveList from '$lib/components/MoveList.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import { lichessToken, session, startLichessSignIn } from '$lib/auth';
  import { destsOf, fenOf, isPromotion, keyOf, materialOf, moveFromKeys, moveToUci } from '$lib/chess/position';
  import PromotionPicker from '$lib/components/PromotionPicker.svelte';
  import { autoQueen, premovesOn } from '$lib/preferences';
  import type { Role } from 'chessops/types';
  import { OnlineGame } from '$lib/game/onlineGame';
  import { friendsCache, shareLive } from '$lib/social';
  import { PremoveQueue } from '$lib/game/premoves';
  import * as api from '$lib/lichessBoard';
  import { myGames } from '$lib/stores/myGames';
  import { lowTimeMs, playMoveSound, playOutcome, sounds } from '$lib/sound';
  import { myCountry, myPhoto, photoSrc } from '$lib/stores/me';
  import { POINTS, study } from '$lib/study/progress';
  import { checkClubGame } from '$lib/tournament/club';
  import { ABORTS_NOTE, abortsToday, noteAbort } from '$lib/game/aborts';
  import { onLichessEvent, openWhenStarted } from '$lib/lichessEvents';
  import { analyseGame, type GameReview } from '$lib/coach/review';
  import { quota } from '$lib/plans';

  const gameId = page.params.id!;
  const color = page.url.searchParams.get('c');
  /** A game in a Lichess arena: after it, back to the arena for the next pairing. */
  const tournamentId = page.url.searchParams.get('t');
  /** A game of two friends in a Chess Castles club tournament: its result goes to the tournament. */
  const clubId = page.url.searchParams.get('club');
  const token = lichessToken()?.token;
  const game = new OnlineGame(color === 'white' || color === 'black' ? color : undefined);
  const queue = new PremoveQueue();
  let board: Board | undefined = $state();
  let v = $state(0);
  let now = $state(Date.now());
  let connection = $state<'connecting' | 'live' | 'reconnecting'>('connecting');
  let notice = $state('');
  /** The opponent left (Lichess's opponentGone): since when, and the seconds until the win can be claimed. */
  let gone = $state<{ at: number; secs: number } | undefined>();
  /**
   * A rematch sent from here (owner's request, 2026-10-21, as on Lichess and chess.com): the same clock, colours
   * swapped, a new Lichess challenge to the same opponent; its game opens by itself when they accept.
   */
  let rematch = $state<{ id?: string; state: 'sending' | 'waiting' | 'declined' } | undefined>();
  let rematchStarted = false;
  /** After a game played here: every move checked, for each side's accuracy on the result (as for games here). */
  let summary = $state<GameReview | undefined>();
  let reviewing = $state<number | undefined>();
  async function reviewAfterGame() {
    const g = myGames.get(`lichess-${gameId}`);
    if (!g || g.uci.length < 4) return;
    reviewing = 0;
    try {
      summary = await analyseGame(g, (p) => (reviewing = p), quota('review_depth'), () => stopped);
    } catch {
      /* left the page, or the engine can't run */
    } finally {
      reviewing = undefined;
    }
  }
  let confirmResign = $state(false);
  /** Abort asks first (as on chess.com): a real opponent is waiting. After a few aborts in a day, a word at the start. */
  let confirmAbort = $state(false);
  const aborted = abortsToday();
  let saved = false;
  /** The result over the board, once, at the end of a game played here (not one opened after it ended). */
  let sheet = $state(false);
  let endShown = false;
  let ctl: AbortController | undefined;
  let stopped = false;
  let orientation = $state<'white' | 'black'>(game.me ?? 'white');
  /** The game was still on when this page opened it (an old finished game never sends you anywhere). */
  let wasLive = false;
  /** An arena game that just ended: seconds until you are back in the arena for the next pairing. */
  let backIn = $state(0);
  let backTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    if (!token) return;
    void connect();
    const t = setInterval(() => (now = Date.now()), 100);
    return () => clearInterval(t);
  });
  onDestroy(() => {
    stopped = true;
    ctl?.abort();
    clearInterval(backTimer);
    // Left while the rematch waits: it is taken back (never once its game started: that would abort it).
    if (rematch?.state === 'waiting' && rematch.id && token && !rematchStarted) void api.cancelChallenge(token, rematch.id).catch(() => {});
  });
  onMount(() =>
    onLichessEvent((e) => {
      if (!rematch?.id) return;
      if (e.type === 'gameStart' && e.game?.gameId === rematch.id) rematchStarted = true;
      if (e.type === 'challengeDeclined' && e.challenge?.id === rematch.id) rematch = { state: 'declined' };
    }),
  );
  const opponentPlayer = () => (game.me === 'white' ? game.black : game.white);
  const rematchLabel = $derived(!rematch ? 'Rematch' : rematch.state === 'sending' ? 'Sending…' : rematch.state === 'waiting' ? 'Waiting… tap to cancel' : 'Rematch again');
  async function sendRematch() {
    const t = token;
    if (!t || !game.me) return;
    if (rematch?.state === 'waiting' && rematch.id) {
      void api.cancelChallenge(t, rematch.id).catch(() => {});
      rematch = undefined;
      return;
    }
    if (rematch?.state === 'sending') return;
    const opp = opponentPlayer();
    const color = game.me === 'white' ? 'black' : 'white';
    const tc = { minutes: Math.max(1, Math.round(game.initial / 60000)), increment: Math.round(game.increment / 1000) };
    rematch = { state: 'sending' };
    try {
      if (opp.ai) {
        // Lichess's computer: the game starts at once.
        const id = await api.challengeAi(t, { level: opp.ai, ...tc, color });
        rematchStarted = true;
        return void goto(`/play/online/${id}?c=${color}`);
      }
      const id = await api.challengeUser(t, opp.name, { ...tc, rated: game.rated, color });
      openWhenStarted(id);
      rematch = { id, state: 'waiting' };
    } catch (e) {
      rematch = undefined;
      notice = e instanceof Error ? e.message : 'The rematch could not be sent.';
    }
  }

  // As on Lichess: after an arena game you go back to the arena by yourself, and it pairs you again.
  function backToArena() {
    if (!tournamentId || backTimer) return;
    backIn = 6;
    backTimer = setInterval(() => {
      backIn -= 1;
      if (backIn > 0) return;
      clearInterval(backTimer);
      void goto(`/play/lichess-tournaments/${tournamentId}?joined=1`, { replaceState: true });
    }, 1000);
  }
  function stayHere() {
    clearInterval(backTimer);
    backIn = 0;
  }

  /** Keeps the game stream open, reconnecting with growing pauses. */
  async function connect() {
    let wait = 1000;
    while (!stopped) {
      ctl = new AbortController();
      try {
        await api.streamGame(token!, gameId, onLine, ctl.signal);
        if (game.isOver) return;
      } catch (e) {
        if (stopped) return;
        if (e instanceof api.LichessError) {
          notice = e.message;
          return;
        }
      }
      if (stopped || game.isOver) return;
      connection = 'reconnecting';
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(wait * 2, 15000);
    }
  }

  let startSounded = false;
  let lowWarned = false;
  // Our clock running low: beep once.
  $effect(() => {
    if (lowWarned || !game.initial || !game.me || game.isOver || !game.myTurn) return;
    if (game.remaining(game.me, now) < lowTimeMs(game.initial)) {
      lowWarned = true;
      sounds.lowTime();
    }
  });

  function onLine(o: any) {
    connection = 'live';
    if (o.type === 'gameFull') {
      // Our side, from the players' names (never only from the link): someone else's game is watched, not played.
      const me = lichessToken()?.username?.toLowerCase();
      game.me = o.white?.id === me ? 'white' : o.black?.id === me ? 'black' : undefined;
      orientation = game.me ?? orientation;
      if (!game.me) return void goto(`/watch/live/${gameId}`, { replaceState: true });
    }
    const before = game.plies.length;
    game.apply(o);
    if (!game.isOver) wasLive = true;
    // A new game: the start sound (not when coming back to a game already under way).
    if (!startSounded && o.type === 'gameFull') {
      startSounded = true;
      if (!game.isOver && game.plies.length < 2) sounds.start();
    }
    // The opponent's move (ours already made its sound).
    if (game.plies.length === before + 1) {
      const last = game.plies[before];
      const mine = game.me && (before % 2 === 0 ? 'white' : 'black') === game.me;
      if (!mine) playMoveSound(before ? game.plies[before - 1].after : game.start, last.move, false);
    }
    if (o.type === 'opponentGone') gone = o.gone ? { at: Date.now(), secs: Number(o.claimWinInSeconds) || 0 } : undefined;
    // Their move landed: our first queued premove goes at once.
    if (game.plies.length > before && game.myTurn && queue.length) {
      const next = queue.takeNext(game.position);
      if (next) send(next);
      else {
        // The premove can't be played now: cancelled, with the piece it had picked up (the next tap starts afresh).
        queue.clear();
        board?.cancelPremove();
        board?.unselect();
      }
    }
    shareOnline();
    if (game.isOver) onEnd();
    v++;
  }

  // Signed in: the game is on "Live on Chess Castles" (and friends can follow it): every 2 s with friends,
  // else every 8 s (each is a database write), and the end at once.
  let lastShare = 0;
  let shareTimer: ReturnType<typeof setTimeout> | undefined;
  let sharedEnd = false;
  function shareOnline() {
    if ($session.status !== 'in' || !game.me || !game.id || !game.plies.length || sharedEnd) return;
    if (!game.isOver) {
      const wait = lastShare + ($friendsCache.length ? 2000 : 8000) - Date.now();
      if (wait > 0) {
        if (!shareTimer) shareTimer = setTimeout(() => ((shareTimer = undefined), shareOnline()), wait);
        return;
      }
    }
    clearTimeout(shareTimer);
    shareTimer = undefined;
    lastShare = Date.now();
    sharedEnd = game.isOver;
    const opp = game.opponent;
    void shareLive({
      opponent: opp.name,
      opponentRating: opp.rating,
      human: game.me,
      minutes: Math.round(game.initial / 60000),
      increment: Math.round(game.increment / 1000),
      start: fenOf(game.start),
      uci: game.plies.map((p) => moveToUci(p.move)),
      white: game.remaining('white'),
      black: game.remaining('black'),
      at: Date.now(),
      result: game.isOver ? game.result || 'aborted' : undefined,
      reason: game.isOver ? game.endReason : undefined,
      lichess: game.id,
    }).catch(() => {});
  }

  function onEnd() {
    queue.clear();
    // A game played here has ended: its sound, then the result over the board.
    if (wasLive && !endShown && game.status !== 'aborted' && game.status !== 'noStart' && game.me) {
      endShown = true;
      const o = !game.winner ? 'draw' : game.winner === game.me ? 'won' : 'lost';
      setTimeout(() => !stopped && playOutcome(o), 200);
      setTimeout(() => !stopped && (sheet = true), 900);
    }
    // Lichess needs a moment to publish the result; the server reads it from there.
    if (clubId && wasLive) setTimeout(() => void checkClubGame(clubId).catch(() => setTimeout(() => void checkClubGame(clubId).catch(() => {}), 5000)), 2500);
    if (wasLive && game.me) backToArena();
    if (saved || !game.plies.length || game.status === 'aborted') return;
    saved = true;
    const me = game.me ?? 'white';
    myGames.save({
      id: `lichess-${gameId}`,
      kind: 'lichess',
      white: me === 'white' ? 'You' : game.white.name,
      black: me === 'black' ? 'You' : game.black.name,
      userSide: me,
      result: game.result === '½-½' ? '1/2-1/2' : game.result || '*',
      reason: game.endReason,
      timeControl: game.initial ? `${game.initial / 60000}+${game.increment / 1000}` : '',
      opponentRating: game.opponent.rating,
      myRating: (me === 'white' ? game.white : game.black).rating,
      startFen: fenOf(game.start),
      uci: game.plies.map((p) => moveToUci(p.move)),
    });
    study.log('game', POINTS.gameFinished, `Lichess game vs ${game.opponent.name}`);
    if (wasLive) void reviewAfterGame();
  }

  async function send(m: ReturnType<typeof moveFromKeys>) {
    const uci = moveToUci(m);
    const before = game.position;
    if (!game.playLocal(m, uci)) return;
    playMoveSound(before, m);
    v++;
    try {
      await api.sendMove(token!, gameId, uci);
    } catch (e) {
      game.undoLocal();
      notice = e instanceof Error ? e.message : 'Lichess refused that move.';
      v++;
    }
  }

  let promoting = $state<{ orig: Key; dest: Key } | undefined>();
  function onmove(orig: Key, dest: Key) {
    if (!game.myTurn) {
      v++;
      return;
    }
    if (!$autoQueen && isPromotion(game.position, orig, dest)) {
      promoting = { orig, dest };
      return;
    }
    void send(moveFromKeys(game.position, orig, dest));
  }
  function pickPromotion(role: Role) {
    if (!promoting) return;
    const { orig, dest } = promoting;
    promoting = undefined;
    void send(moveFromKeys(game.position, orig, dest, role));
  }
  function cancelPromotion() {
    promoting = undefined;
    board?.resync();
  }

  function onpremove(orig: Key, dest: Key) {
    const shown = game.position;
    shown.board = queue.preview(shown.board);
    queue.add(moveFromKeys(shown, orig, dest));
    board?.cancelPremove();
    v++;
  }

  async function act(f: () => Promise<unknown>) {
    try {
      await f();
    } catch (e) {
      notice = e instanceof Error ? e.message : 'Lichess refused that.';
    }
  }

  /** The move shown while looking back through the game (undefined: the live position). */
  let viewPly = $state<number | undefined>();
  function go(ply: number) {
    const n = game.plies.length;
    const p = Math.max(0, Math.min(n, ply));
    viewPly = p >= n ? undefined : p;
  }
  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
    const at = viewPly ?? game.plies.length;
    if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'ArrowRight') go(at + 1);
    else return;
    e.preventDefault();
  }

  const view = $derived.by(() => {
    void v;
    if (viewPly !== undefined) {
      const pos = viewPly ? game.plies[viewPly - 1].after.clone() : game.start.clone();
      const m = viewPly ? game.plies[viewPly - 1].move : undefined;
      return {
        pos,
        fen: fenOf(pos),
        lastMove: m ? ([keyOf(m.from), keyOf(m.to)] as Key[]) : undefined,
        dests: new Map(),
        movable: undefined,
        queued: [] as Key[],
        shapes: [],
        sans: game.plies.map((p) => p.san),
        theyOfferDraw: game.me === 'white' ? game.blackOffersDraw : game.whiteOffersDraw,
        iOfferDraw: game.me === 'white' ? game.whiteOffersDraw : game.blackOffersDraw,
      };
    }
    const pos = game.position;
    const last = game.plies[game.plies.length - 1];
    const active = !game.isOver && !!game.me;
    const preview = active && !game.myTurn && queue.length > 0;
    return {
      pos,
      fen: preview ? `${makeBoardFen(queue.preview(pos.board))} ${pos.turn[0]} - - 0 1` : fenOf(pos),
      lastMove: last ? ([keyOf(last.move.from), keyOf(last.move.to)] as Key[]) : undefined,
      dests: game.myTurn ? destsOf(pos) : new Map(),
      movable: active ? game.me : undefined,
      queued: queue.moves.flatMap((m) => [keyOf(m.from), keyOf(m.to)]) as Key[],
      shapes: queue.moves.map((m) => ({ orig: keyOf(m.from), dest: keyOf(m.to), brush: 'blue' })),
      sans: game.plies.map((p) => p.san),
      theyOfferDraw: game.me === 'white' ? game.blackOffersDraw : game.whiteOffersDraw,
      iOfferDraw: game.me === 'white' ? game.whiteOffersDraw : game.blackOffersDraw,
    };
  });

  function bar(side: 'white' | 'black') {
    void v;
    const p = side === 'white' ? game.white : game.black;
    const mine = side === game.me;
    const mat = materialOf(view.pos, side);
    return {
      name: `${p.title ? p.title + ' ' : ''}${p.name}`,
      initials: p.ai ? 'SF' : p.name.slice(0, 2).toUpperCase(),
      subtitle: p.ai ? 'Lichess computer' : `${mine ? 'You · ' : ''}${side === 'white' ? 'White' : 'Black'}`,
      rating: p.rating ? `${p.rating}` : undefined,
      country: mine ? $myCountry || undefined : undefined,
      photo: mine && $myPhoto ? photoSrc($myPhoto) : undefined,
      toMove: !game.isOver && view.pos.turn === side,
      me: mine,
      captured: mat.captured,
      lead: mat.lead,
      clockMs: game.initial ? game.remaining(side, now) : undefined,
    };
  }
  const top = $derived.by(() => {
    void now;
    return bar(orientation === 'white' ? 'black' : 'white');
  });
  const bottom = $derived.by(() => {
    void now;
    return bar(orientation);
  });
  /**
   * What the controls show, refreshed on every change (`game` itself is not reactive: read straight from it, the
   * controls kept showing Abort all game). Abort until the player has moved, then Resign and Offer draw.
   */
  const controls = $derived.by(() => {
    void v;
    return { over: game.isOver, me: game.me, abort: game.canAbort && !game.movedYet, abortable: game.canAbort, plies: game.plies.length };
  });
  const headline = $derived.by(() => {
    void v;
    if (game.status === 'aborted' || game.status === 'noStart') return { text: 'Game aborted', tone: 'var(--muted)' };
    if (!game.winner) return { text: 'Draw', tone: 'var(--accent)' };
    return game.winner === game.me ? { text: 'You won!', tone: 'var(--win)' } : { text: 'You lost', tone: 'var(--loss)' };
  });
</script>

<svelte:head><title>Online game · Chess Castles</title></svelte:head>

{#snippet playControls()}
{#if gone}
  <!-- The opponent left: after Lichess's wait, the win can be claimed (or a draw), as on Lichess. -->
  {@const left = Math.max(0, Math.ceil((gone.at + gone.secs * 1000 - now) / 1000))}
  <div class="notice warn gone" role="status">
    {#if left > 0}
      <span>Your opponent left the game. If they don't come back in {left} s, you can claim the win.</span>
    {:else}
      <span>Your opponent left the game.</span>
      <div class="gone-btns">
        <button class="btn primary" onclick={() => act(() => api.claimVictory(token!, gameId))}><Icon name="trophy" size={18} />Claim victory</button>
        <button class="btn" onclick={() => act(() => api.claimDraw(token!, gameId))}>Call it a draw</button>
      </div>
    {/if}
  </div>
{/if}
{#if aborted >= ABORTS_NOTE && controls.plies < 2}
  <div class="notice warn" role="note">You aborted {aborted} games today. Please play the games you start: your opponents want to play too.</div>
{/if}
{#if view.theyOfferDraw}
  <div class="notice offer">
    <span>{game.opponent.name} offers a draw.</span>
    <button class="btn" onclick={() => act(() => api.draw(token!, gameId, false))}>Decline</button>
    <button class="btn primary" onclick={() => act(() => api.draw(token!, gameId, true))}>Accept</button>
  </div>
{/if}
<div class="actions">
  {#if controls.abort && confirmAbort}
    <p class="abort-q">Abort this game? {game.opponent.name} is waiting to play. Aborting is unfair to your opponent, and Lichess limits players who abort often.</p>
    <button class="btn primary" onclick={() => (noteAbort(), (confirmAbort = false), act(() => api.abort(token!, gameId)))}>Yes, abort</button>
    <button class="btn" onclick={() => (confirmAbort = false)}>Keep playing</button>
  {:else if controls.abort}
    <button class="btn" onclick={() => (confirmAbort = true)}><Icon name="close" size={18} />Abort</button>
  {:else if confirmResign}
    <!-- Before the opponent's first move Lichess only aborts (no rating change). -->
    <button class="btn primary" onclick={() => act(() => (controls.abortable ? api.abort(token!, gameId) : api.resign(token!, gameId)))}>Yes, resign</button>
    <button class="btn" onclick={() => (confirmResign = false)}>Keep playing</button>
  {:else}
    <button class="btn" onclick={() => (confirmResign = true)}><Icon name="flag" size={18} />Resign</button>
    <button class="btn" disabled={view.iOfferDraw || controls.abortable} title={controls.abortable ? 'After your opponent has moved' : undefined} onclick={() => act(() => api.draw(token!, gameId, true))}>
      {view.iOfferDraw ? 'Draw offered' : 'Offer draw'}
    </button>
  {/if}
  {#if queue.length}
    <button class="btn" onclick={() => (queue.clear(), board?.cancelPremove(), board?.unselect(), v++)}>Cancel premoves ({queue.length})</button>
  {/if}
</div>
{/snippet}

<svelte:window onkeydown={onkey} />

{#if promoting}
  <PromotionPicker color={game.position.turn} onpick={pickPromotion} oncancel={cancelPromotion} />
{/if}

{#if sheet && controls.over && game.me}
  {@const mine = bar(game.me)}
  {@const theirs = bar(game.me === 'white' ? 'black' : 'white')}
  <GameOverSheet
    outcome={!game.winner ? 'draw' : game.winner === game.me ? 'won' : 'lost'}
    reason={game.endReason}
    me={{ name: mine.name, initials: mine.initials, photo: mine.photo, rating: mine.rating }}
    opponent={{ name: theirs.name, initials: theirs.initials, rating: theirs.rating }}
    accuracy={summary ? { me: summary.sides[game.me].accuracy, opponent: summary.sides[game.me === 'white' ? 'black' : 'white'].accuracy } : reviewing !== undefined ? { progress: reviewing } : undefined}
    againLabel={clubId || tournamentId ? 'Back to the tournament' : rematchLabel}
    againHref={clubId ? `/play/tournament/club/${clubId}?check=1` : tournamentId ? `/play/lichess-tournaments/${tournamentId}?joined=1` : undefined}
    onagain={clubId || tournamentId ? undefined : sendRematch}
    alt={clubId || tournamentId ? undefined : { label: 'New game', href: '/play?mode=online' }}
    analyseHref={controls.plies ? `/analysis?game=lichess-${gameId}` : undefined}
    guruHref={controls.plies >= 4 ? `/coach/review/lichess-${gameId}` : undefined}
    onclose={() => (sheet = false)}
  />
{/if}

{#if !token}
  <div class="card gate">
    <h1 class="title">Sign in to play online</h1>
    <p class="label">Online games are played on Lichess with your Lichess account.</p>
    <button class="btn primary" onclick={() => startLichessSignIn($session.status === 'in')}>{$session.status === 'in' ? 'Connect your Lichess account' : 'Sign in with Lichess'}</button>
  </div>
{:else}
  <div class="game">
    <section class="board-col" aria-label="Board">
      <PlayerBar {...top} />
      <Board
        bind:this={board}
        fen={view.fen}
        {orientation}
        turnColor={view.pos.turn}
        movable={view.movable}
        dests={view.dests}
        lastMove={view.lastMove}
        check={view.pos.isCheck()}
        premovable={$premovesOn && !controls.over && viewPly === undefined}
        queued={view.queued}
        shapes={view.shapes}
        label="Online game board"
        {onmove}
        {onpremove}
        onswipe={controls.over ? (d) => go((viewPly ?? game.plies.length) + (d === 'forward' ? 1 : -1)) : undefined}
      />
      <PlayerBar {...bottom} />
      <!-- Phones: the move buttons and Resign / Draw right under the board, no scrolling. -->
      <div class="phone-controls">
        <MoveNav ply={viewPly ?? view.sans.length} max={view.sans.length} {go} onflip={() => (orientation = orientation === 'white' ? 'black' : 'white')} />
        {#if viewPly !== undefined && !controls.over}<div class="looking-row"><button class="btn primary back-live" onclick={() => go(view.sans.length)}>Back to the game</button></div>{/if}
        {#if !controls.over && controls.me}{@render playControls()}{/if}
      </div>
    </section>

    <aside class="side">
      <div class="panel-card">
        <div class="head">
          <span class="title">
            {game.initial ? `${game.initial / 60000}+${game.increment / 1000}` : ''} · {game.rated ? 'Rated' : 'Casual'} · Lichess
          </span>
          <span class="conn {connection}" title={connection === 'live' ? 'Connected' : 'Connecting'}></span>
          <button class="icon-btn small" onclick={() => (orientation = orientation === 'white' ? 'black' : 'white')} aria-label="Flip board">
            <Icon name="flip" size={18} />
          </button>
        </div>
        <MoveList sans={view.sans} current={viewPly ?? view.sans.length} onselect={go} />
        <div class="wide-only"><MoveNav ply={viewPly ?? view.sans.length} max={view.sans.length} {go} /></div>
        {#if viewPly !== undefined && !controls.over}<div class="looking-row wide-only"><button class="btn primary back-live" onclick={() => go(view.sans.length)}>Back to the game</button></div>{/if}
      </div>

      {#if notice}<div class="notice">{notice}</div>{/if}
      {#if connection === 'reconnecting'}<div class="notice warn">Reconnecting to Lichess… your moves are safe.</div>{/if}

      {#if controls.over}
        <div class="result panel-card" style="--tone: {headline.tone}">
          <span class="display" style="color: var(--tone); font-size: 36px">{headline.text}</span>
          <p class="label">{game.endReason}</p>
          {#if rematch?.state === 'waiting'}<p class="label rematch-note">Rematch sent to {opponentPlayer().name}: waiting for them to accept.</p>
          {:else if rematch?.state === 'declined'}<p class="label rematch-note">{opponentPlayer().name} declined the rematch.</p>{/if}
          <div class="row">
            {#if clubId}
              <a class="btn primary" href="/play/tournament/club/{clubId}?check=1"><Icon name="trophy" size={18} />Back to the tournament</a>
            {:else if tournamentId}
              <a class="btn primary" href="/play/lichess-tournaments/{tournamentId}?joined=1"><Icon name="trophy" size={18} />{backIn > 0 ? `Next arena game in ${backIn}…` : 'Back to the tournament'}</a>
              {#if backIn > 0}<button class="btn" onclick={stayHere}>Stay here</button>{/if}
            {:else}
              <button class="btn primary" onclick={sendRematch} disabled={rematch?.state === 'sending'}><Icon name="replay" size={18} />{rematchLabel}</button>
              <a class="btn" href="/play?mode=online">New game</a>
            {/if}
            {#if controls.plies}<a class="btn" href="/analysis?game=lichess-{gameId}"><Icon name="analyse" size={18} />Analyse</a>
              <ShareGame game={() => myGames.get(`lichess-${gameId}`)} />{/if}
          </div>
        </div>
      {:else if controls.me}
        <div class="wide-only">{@render playControls()}</div>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .looking-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px 10px;
  }
  .nav {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 10px;
    border-top: 1px solid var(--border);
  }
  .back-live {
    margin-left: auto;
  }
  .gate {
    max-width: 440px;
    margin: 40px auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .game {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: center;
    align-items: flex-start;
    max-width: 1280px;
    margin: 0 auto;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 210px), 760px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .side {
    flex: 1 1 340px;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .panel-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-card);
    overflow: hidden;
  }
  .panel-card :global(.moves) {
    height: 300px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .head .title {
    flex: 1;
    font-size: 16px;
  }
  .conn {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--muted);
  }
  .conn.live {
    background: var(--win);
  }
  .conn.reconnecting {
    background: var(--engine);
  }
  .icon-btn.small {
    width: 38px;
    height: 38px;
  }
  .notice {
    padding: 10px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--brand) 14%, var(--card));
    border: 1px solid var(--border);
    font-size: 14.5px;
  }
  .abort-q {
    flex: 1 1 100%;
    margin: 0;
    font-size: 13.5px;
    color: var(--text-2);
  }
  .gone {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .gone-btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rematch-note {
    margin: 0;
    color: var(--gold);
  }
  .notice.warn {
    background: color-mix(in srgb, var(--engine) 16%, var(--card));
  }
  .notice.offer {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .notice.offer span {
    flex: 1;
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .actions .btn {
    flex: 1 1 140px;
  }
  .result {
    padding: 18px;
    border-color: var(--tone);
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  .result .label {
    margin: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .phone-controls {
    display: none;
  }
  @media (max-width: 767px) {
    .side {
      max-width: none;
    }
    .wide-only {
      display: none !important;
    }
    .phone-controls {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .phone-controls :global(.nav) {
      padding: 0;
      border-top: 0;
    }
    .phone-controls :global(.nb) {
      height: 44px;
    }
    .panel-card :global(.moves) {
      height: 160px;
    }
  }
</style>

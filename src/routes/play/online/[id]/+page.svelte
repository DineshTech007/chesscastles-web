<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import type { Key } from '@lichess-org/chessground/types';
  import { makeBoardFen } from 'chessops/fen';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ShareGame from '$lib/components/ShareGame.svelte';
  import MoveList from '$lib/components/MoveList.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import { lichessToken, startSignIn } from '$lib/auth';
  import { destsOf, fenOf, keyOf, materialOf, moveFromKeys, moveToUci } from '$lib/chess/position';
  import { OnlineGame } from '$lib/game/onlineGame';
  import { PremoveQueue } from '$lib/game/premoves';
  import * as api from '$lib/lichessBoard';
  import { myGames } from '$lib/stores/myGames';
  import { lowTimeMs, playMoveSound, sounds } from '$lib/sound';
  import { myCountry, myPhoto, photoSrc } from '$lib/stores/me';
  import { POINTS, study } from '$lib/study/progress';

  const gameId = page.params.id!;
  const color = page.url.searchParams.get('c');
  /** A game in a Lichess arena: after it, back to the arena for the next pairing. */
  const tournamentId = page.url.searchParams.get('t');
  const token = lichessToken()?.token;
  const game = new OnlineGame(color === 'white' || color === 'black' ? color : undefined);
  const queue = new PremoveQueue();
  let board: Board | undefined = $state();
  let v = $state(0);
  let now = $state(Date.now());
  let connection = $state<'connecting' | 'live' | 'reconnecting'>('connecting');
  let notice = $state('');
  let confirmResign = $state(false);
  let saved = false;
  let ctl: AbortController | undefined;
  let stopped = false;
  let orientation = $state<'white' | 'black'>(game.me ?? 'white');

  onMount(() => {
    if (!token) return;
    void connect();
    const t = setInterval(() => (now = Date.now()), 100);
    return () => clearInterval(t);
  });
  onDestroy(() => {
    stopped = true;
    ctl?.abort();
  });

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
    // A new game: the start sound (not when coming back to a game already under way).
    if (!startSounded && o.type === 'gameFull') {
      startSounded = true;
      if (!game.isOver && game.plies.length < 2) sounds.start();
    }
    // The opponent's move (ours already made its sound).
    if (game.plies.length === before + 1) {
      const last = game.plies[before];
      const mine = game.me && (before % 2 === 0 ? 'white' : 'black') === game.me;
      if (!mine) playMoveSound(before ? game.plies[before - 1].after : game.start, last.move);
    }
    if (o.type === 'opponentGone' && o.gone) notice = 'Your opponent left the game.';
    // Their move landed: our first queued premove goes at once.
    if (game.plies.length > before && game.myTurn && queue.length) {
      const next = queue.takeNext(game.position);
      if (next) send(next);
      else queue.clear();
    }
    if (game.isOver) onEnd();
    v++;
  }

  function onEnd() {
    queue.clear();
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
      startFen: fenOf(game.start),
      uci: game.plies.map((p) => moveToUci(p.move)),
    });
    study.log('game', POINTS.gameFinished, `Lichess game vs ${game.opponent.name}`);
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

  function onmove(orig: Key, dest: Key) {
    if (!game.myTurn) {
      v++;
      return;
    }
    void send(moveFromKeys(game.position, orig, dest));
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
  const headline = $derived.by(() => {
    void v;
    if (game.status === 'aborted' || game.status === 'noStart') return { text: 'Game aborted', tone: 'var(--muted)' };
    if (!game.winner) return { text: 'Draw', tone: 'var(--accent)' };
    return game.winner === game.me ? { text: 'You won!', tone: 'var(--win)' } : { text: 'You lost', tone: 'var(--loss)' };
  });
</script>

<svelte:head><title>Online game · Chess Castles</title></svelte:head>

<svelte:window onkeydown={onkey} />

{#if !token}
  <div class="card gate">
    <h1 class="title">Sign in to play online</h1>
    <p class="label">Online games are played on Lichess with your Lichess account.</p>
    <button class="btn primary" onclick={() => startSignIn()}>Sign in with Lichess</button>
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
        premovable={!game.isOver && viewPly === undefined}
        queued={view.queued}
        shapes={view.shapes}
        label="Online game board"
        {onmove}
        {onpremove}
      />
      <PlayerBar {...bottom} />
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
        <MoveNav ply={viewPly ?? view.sans.length} max={view.sans.length} {go} />
        {#if viewPly !== undefined && !game.isOver}<div class="looking-row"><button class="btn primary back-live" onclick={() => go(view.sans.length)}>Back to the game</button></div>{/if}
      </div>

      {#if notice}<div class="notice">{notice}</div>{/if}
      {#if connection === 'reconnecting'}<div class="notice warn">Reconnecting to Lichess… your moves are safe.</div>{/if}

      {#if game.isOver}
        <div class="result panel-card" style="--tone: {headline.tone}">
          <span class="display" style="color: var(--tone); font-size: 36px">{headline.text}</span>
          <p class="label">{game.endReason}</p>
          <div class="row">
            {#if tournamentId}
              <a class="btn primary" href="/play/lichess-tournaments/{tournamentId}?joined=1"><Icon name="trophy" size={18} />Back to the tournament</a>
            {:else}
              <a class="btn primary" href="/play?mode=online"><Icon name="replay" size={18} />New game</a>
            {/if}
            {#if game.plies.length}<a class="btn" href="/analysis?game=lichess-{gameId}"><Icon name="analyse" size={18} />Analyse</a>
              <ShareGame game={() => myGames.get(`lichess-${gameId}`)} />{/if}
          </div>
        </div>
      {:else if game.me}
        {#if view.theyOfferDraw}
          <div class="notice offer">
            <span>{game.opponent.name} offers a draw.</span>
            <button class="btn" onclick={() => act(() => api.draw(token, gameId, false))}>Decline</button>
            <button class="btn primary" onclick={() => act(() => api.draw(token, gameId, true))}>Accept</button>
          </div>
        {/if}
        <div class="actions">
          {#if game.canAbort}
            <button class="btn" onclick={() => act(() => api.abort(token, gameId))}><Icon name="close" size={18} />Abort</button>
          {:else if confirmResign}
            <button class="btn primary" onclick={() => act(() => api.resign(token, gameId))}>Yes, resign</button>
            <button class="btn" onclick={() => (confirmResign = false)}>Keep playing</button>
          {:else}
            <button class="btn" onclick={() => (confirmResign = true)}><Icon name="flag" size={18} />Resign</button>
            <button class="btn" disabled={view.iOfferDraw} onclick={() => act(() => api.draw(token, gameId, true))}>
              {view.iOfferDraw ? 'Draw offered' : 'Offer draw'}
            </button>
          {/if}
          {#if queue.length}
            <button class="btn" onclick={() => (queue.clear(), board?.cancelPremove(), v++)}>Cancel premoves ({queue.length})</button>
          {/if}
        </div>
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
  @media (max-width: 767px) {
    .side {
      max-width: none;
    }
    .panel-card :global(.moves) {
      height: 160px;
    }
  }
</style>

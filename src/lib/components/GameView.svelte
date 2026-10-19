<script lang="ts">
  import { myTitle, myInitials, myName } from '$lib/stores/me';
  import { onDestroy, onMount } from 'svelte';
  import { gameEnded } from '$lib/stores/gameEnded';
  import type { Key } from '@lichess-org/chessground/types';
  import type { Role } from 'chessops/types';
  import Board from './Board.svelte';
  import Icon from './Icon.svelte';
  import ShareGame from './ShareGame.svelte';
  import MoveList from './MoveList.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import PlayerBar from './PlayerBar.svelte';
  import { destsOf, fenOf, isPromotion, keyOf, materialOf, moveFromKeys, moveToUci } from '$lib/chess/position';
  import PromotionPicker from './PromotionPicker.svelte';
  import { autoQueen, premovesOn } from '$lib/preferences';
  import { makeBoardFen } from 'chessops/fen';
  import { opposite, tcLabel, type Color, type FideGame } from '$lib/game/fideGame';
  import { PremoveQueue } from '$lib/game/premoves';
  import { myGames, type GameKind } from '$lib/stores/myGames';
  import { POINTS, study } from '$lib/study/progress';
  import { thousands } from '$lib/format';
  import { kfideAll, myCountry, myPhoto, photoSrc } from '$lib/stores/me';
  import { kfideText, SPEED_LABEL, speedOf } from '$lib/kfide';
  import { session } from '$lib/auth';
  import { analyseGame, type GameReview } from '$lib/coach/review';
  import ReviewSummary from '$lib/review/ReviewSummary.svelte';
  import { quota } from '$lib/plans';
  import { lowTimeMs, playMoveSound, sounds } from '$lib/sound';
  import { clearResume, saveResume } from '$lib/game/resume';
  import { shareLive, uploadGame } from '$lib/social';
  import { boardBadge, type MoveClass } from '$lib/review/badges';

  let {
    game,
    kind,
    opponent,
    opponentInitials,
    opponentSubtitle,
    openingName,
    onagain,
    againLabel = 'Play again',
    onfinish,
    opponentCountry,
    gameId,
    resumeRoute,
  }: {
    game: FideGame;
    kind: GameKind;
    opponent: string;
    opponentInitials: string;
    opponentSubtitle: string;
    openingName?: string;
    onagain: () => void;
    /** The button after the game, e.g. "Back to the tournament". */
    againLabel?: string;
    /** Told the result when the game ends (not when it is aborted), with its id in My games. */
    onfinish?: (result: '1-0' | '0-1' | '1/2-1/2', gameId: string) => void;
    /** The opponent's federation, for their flag. */
    opponentCountry?: string;
    /** A resumed game keeps its id in My games. */
    gameId?: string;
    /** The page that plays this game: it is saved after every move, to resume after a lost connection. */
    resumeRoute?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  const id = gameId ?? crypto.randomUUID();
  const queue = new PremoveQueue();
  let board: Board | undefined = $state();
  let v = $state(0);
  let now = $state(Date.now());
  // The board starts from the player's side; a new game remounts this view.
  // svelte-ignore state_referenced_locally
  let orientation = $state<Color>(game.human);
  let saved = false;
  /** Moves already heard (a resumed game starts with its moves so far). */
  // svelte-ignore state_referenced_locally
  let seenMoves = game.moves.length;
  let confirmResign = $state(false);
  /** The move shown while looking back through the game (undefined: the live position). */
  let viewPly = $state<number | undefined>();
  /** After the game: every move's badge (brilliant … blunder), and the progress while they are worked out. */
  let badges = $state<(MoveClass | undefined)[]>([]);
  /** The finished review, for the report (graph, accuracy, badges). */
  let summary = $state<GameReview | undefined>();
  let reviewing = $state<number | undefined>();
  let gone = false;

  async function reviewAfterGame() {
    const g = myGames.get(id);
    if (!g || g.uci.length < 4) return;
    reviewing = 0;
    try {
      const r = await analyseGame(g, (p) => (reviewing = p), quota('review_depth'), () => gone);
      badges = g.uci.map((_, i) => r.all.find((m) => m.ply === i)?.cls);
      summary = r;
    } catch {
      /* left the page, or the engine can't run */
    } finally {
      reviewing = undefined;
    }
  }

  function onChange() {
    v++;
    const n = game.moves.length;
    if (n > seenMoves) {
      const last = game.moves[n - 1];
      playMoveSound(n >= 2 ? game.moves[n - 2].after : game.start, last.move);
      seenMoves = n;
      // The bot has moved: our first queued premove goes at once.
      if (last.source && queue.length) {
        queueMicrotask(() => {
          const next = queue.takeNext(game.position);
          if (!next || !game.play(next)) queue.clear();
          v++;
        });
      }
    }
    shareWithFriends();
    if (resumeRoute) {
      if (game.isOver) clearResume(id);
      else if (game.moves.length) saveResume({ route: resumeRoute, id, opponent, snapshot: game.snapshot(), minutes: game.timeControl.minutes });
    }
    if (game.isOver) {
      queue.clear();
      if (game.end !== 'aborted' && !saved && !game.position.isEnd()) sounds.end();
      if (game.end !== 'aborted' && !saved) {
        save(true);
        study.log('game', POINTS.gameFinished, `Game vs ${opponent}`);
        onfinish?.(game.result === '½-½' ? '1/2-1/2' : (game.result as '1-0' | '0-1'), id);
        void reviewAfterGame();
      }
    }
  }

  /** Signed in: friends can watch the game live (sent after each move, and once at the end). */
  let sharedMoves = -1;
  function shareWithFriends() {
    if ($session.status !== 'in' || !game.moves.length) return;
    const n = game.moves.length + (game.isOver ? 1000 : 0);
    if (n === sharedMoves) return;
    sharedMoves = n;
    void shareLive({
      opponent,
      opponentRating: kind === 'fide' ? game.rating : undefined,
      human: game.human,
      minutes: game.timeControl.minutes,
      increment: game.timeControl.increment,
      start: fenOf(game.start),
      uci: game.moves.map((m) => moveToUci(m.move)),
      white: game.remaining('white'),
      black: game.remaining('black'),
      at: Date.now(),
      result: game.isOver ? game.result || 'aborted' : undefined,
      reason: game.isOver ? game.endReason : undefined,
    }).catch(() => {});
  }

  /** Fair play: how often the player left this tab during their own turn (kept with the game, as Lichess does). */
  let blurs = 0;
  function onBlur() {
    if (!game.isOver && game.moves.length >= 2 && game.position.turn === game.human) blurs++;
  }

  function save(finished: boolean) {
    if (saved || !game.moves.length) return;
    saved = finished;
    const youWhite = game.human === 'white';
    myGames.save({
      id,
      kind,
      white: youWhite ? 'You' : opponent,
      black: youWhite ? opponent : 'You',
      userSide: game.human,
      result: finished ? (game.result === '½-½' ? '1/2-1/2' : game.result) : '*',
      reason: finished ? game.endReason : 'Not finished',
      timeControl: game.timed ? tcLabel(game.timeControl) : '',
      opponentRating: game.rating,
      blurs,
      startFen: fenOf(game.start),
      uci: game.moves.map((m) => moveToUci(m.move)),
    });
    // Finished: kept in the account too, so friends can see and review it.
    const kept = finished && $session.status === 'in' ? myGames.get(id) : undefined;
    if (kept) void uploadGame(kept).catch(() => {});
  }

  onMount(() => {
    const unsub = game.subscribe(onChange);
    const timer = setInterval(() => (now = Date.now()), 100);
    if (!game.moves.length && !game.isOver) sounds.start();
    game.begin();
    return () => {
      unsub();
      clearInterval(timer);
    };
  });
  onDestroy(() => {
    gone = true;
    if (!game.isOver) save(false);
    game.dispose();
    gameEnded.set(false);
  });

  /** Shows the position after `ply` moves; the latest one returns to the live game. */
  function go(ply: number) {
    const n = game.moves.length;
    const p = Math.max(0, Math.min(n, ply));
    const from = viewPly ?? n;
    if (p === from + 1) playMoveSound(from ? game.moves[from - 1].after : game.start, game.moves[from].move);
    viewPly = p >= n ? undefined : p;
  }
  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
    const at = viewPly ?? game.moves.length;
    if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'ArrowRight') go(at + 1);
    else if (e.key === 'ArrowUp' || e.key === 'Home') go(0);
    else if (e.key === 'ArrowDown' || e.key === 'End') go(game.moves.length);
    else return;
    e.preventDefault();
  }

  const view = $derived.by(() => {
    void v;
    if (viewPly !== undefined) {
      // Looking back: that position, read-only.
      const pos = viewPly ? game.moves[viewPly - 1].after.clone() : game.start.clone();
      const m = viewPly ? game.moves[viewPly - 1].move : undefined;
      return {
        pos,
        fen: fenOf(pos),
        lastMove: m ? [keyOf(m.from), keyOf(m.to)] : undefined,
        dests: new Map(),
        movable: undefined,
        check: pos.isCheck(),
        queued: [] as Key[],
        shapes: m && badges[viewPly - 1] ? [{ orig: keyOf(m.to), customSvg: { html: boardBadge(badges[viewPly - 1]!) } }] : [],
        lastBot: [...game.moves].reverse().find((x) => x.source),
      };
    }
    const pos = game.position;
    const last = game.moves[game.moves.length - 1];
    const active = !game.isOver;
    // While the bot thinks, show where the queued premoves put our pieces.
    const preview = active && !game.myTurn && queue.length > 0;
    const fen = preview ? `${makeBoardFen(queue.preview(pos.board))} ${pos.turn[0]} - - 0 1` : fenOf(pos);
    return {
      pos,
      fen,
      lastMove: last ? [keyOf(last.move.from), keyOf(last.move.to)] : undefined,
      dests: game.myTurn ? destsOf(pos) : new Map(),
      movable: active ? game.human : undefined,
      check: pos.isCheck(),
      queued: queue.moves.flatMap((m) => [keyOf(m.from), keyOf(m.to)]) as Key[],
      shapes: [
        ...queue.moves.map((m) => ({ orig: keyOf(m.from), dest: keyOf(m.to), brush: 'blue' })),
        ...(game.isOver && last && badges[game.moves.length - 1] ? [{ orig: keyOf(last.move.to), customSvg: { html: boardBadge(badges[game.moves.length - 1]!) } }] : []),
      ],
      lastBot: [...game.moves].reverse().find((m) => m.source),
    };
  });

  const clocks = $derived.by(() => {
    void now;
    void v;
    return game.timed ? { white: game.remaining('white'), black: game.remaining('black') } : undefined;
  });

  // Your clock running low: beep once.
  let lowWarned = false;
  $effect(() => {
    const mine = clocks?.[game.human];
    if (lowWarned || mine === undefined || game.isOver || game.position.turn !== game.human) return;
    if (mine < lowTimeMs(game.timeControl.minutes * 60_000)) {
      lowWarned = true;
      sounds.lowTime();
    }
  });

  // A promotion with auto-queen off: ask which piece before the move is played.
  let promoting = $state<{ orig: Key; dest: Key } | undefined>();
  function onmove(orig: Key, dest: Key) {
    const pos = game.position;
    if (!$autoQueen && isPromotion(pos, orig, dest)) {
      promoting = { orig, dest };
      return;
    }
    if (!game.play(moveFromKeys(pos, orig, dest))) v++;
  }
  function pickPromotion(role: Role) {
    if (!promoting) return;
    const { orig, dest } = promoting;
    promoting = undefined;
    if (!game.play(moveFromKeys(game.position, orig, dest, role))) v++;
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

  function cancelPremoves() {
    queue.clear();
    board?.cancelPremove();
    v++;
  }

  function bar(side: Color) {
    const me = side === game.human;
    const pos = view.pos;
    const mat = materialOf(pos, side);
    return {
      me,
      name: me ? ($session.status === 'in' ? $myName : 'You') : opponent,
      title: me && $session.status === 'in' ? $myTitle : undefined,
      // (The opponent's rating only when its name doesn't already say it: "FIDE 1800".)
      rating: me ? `CC ${SPEED_LABEL[speed]} ${kfideText($kfideAll[speed])}` : kind === 'fide' && !opponent.includes(String(game.rating)) ? `FIDE ${game.rating}` : undefined,
      country: me ? $myCountry || undefined : opponentCountry,
      initials: me ? ($session.status === 'in' ? $myInitials : '♙') : opponentInitials,
      photo: me && $myPhoto ? photoSrc($myPhoto) : undefined,
      subtitle: me ? (side === 'white' ? 'White' : 'Black') : opponentSubtitle,
      toMove: !game.isOver && pos.turn === side,
      thinking: !me && game.botThinking,
      captured: mat.captured,
      lead: mat.lead,
      clockMs: clocks?.[side],
    };
  }

  const top = $derived.by(() => {
    void v;
    void now;
    return bar(opposite(orientation));
  });
  const bottom = $derived.by(() => {
    void v;
    void now;
    return bar(orientation);
  });

  const headline = $derived.by(() => {
    void v;
    if (game.end === 'aborted') return { text: 'Game aborted', tone: 'var(--muted)' };
    if (!game.winner) return { text: 'Draw', tone: 'var(--accent)' };
    return game.winner === game.human
      ? { text: 'You won!', tone: 'var(--win)' }
      : { text: 'You lost', tone: 'var(--loss)' };
  });

  // On phones the bottom bar comes back when the game is over.
  $effect(() => {
    gameEnded.set(g.isOver);
  });

  // Everything the template reads from the game, refreshed on every change.
  const g = $derived.by(() => {
    void v;
    return {
      sans: game.moves.map((m) => m.san),
      sources: game.moves.map((m) => m.source),
      isOver: game.isOver,
      canAbort: game.canAbort,
      result: game.result,
      endReason: game.endReason,
      counts: game.sourceCounts,
      maiaMoves: game.moves.filter((m) => m.engine === 'maia').length,
      queued: queue.length,
    };
  });
  const counts = $derived(g.counts);
  /** This game's speed: it counts for that CC Rating only. */
  const speed = $derived(speedOf(game.timed ? tcLabel(game.timeControl) : ''));
  /** This game's effect on the player's CC Rating (FIDE-bot games). */
  const kfideChange = $derived(kind === 'fide' && g.isOver ? $kfideAll[speed].history.find((h) => h.id === id) : undefined);
</script>

<svelte:window onblur={onBlur} onkeydown={onkey} />

{#if promoting}
  <PromotionPicker color={game.position.turn} onpick={pickPromotion} oncancel={cancelPromotion} />
{/if}

{#snippet actionButtons()}
  {#if g.canAbort}
    <button class="btn" onclick={() => game.abort()}><Icon name="close" size={18} />Abort</button>
  {:else if confirmResign}
    <button class="btn primary" onclick={() => game.resign()}>Yes, resign</button>
    <button class="btn" onclick={() => (confirmResign = false)}>Keep playing</button>
  {:else}
    <button class="btn" onclick={() => (confirmResign = true)}><Icon name="flag" size={18} />Resign</button>
  {/if}
  {#if g.queued}
    <button class="btn" onclick={cancelPremoves}><Icon name="undo" size={18} />Cancel premoves ({g.queued})</button>
  {/if}
{/snippet}
{#snippet lookingRow()}
  {#if viewPly !== undefined}
    <div class="looking-row">
      <span class="looking label">{viewPly === 0 ? 'Start position' : `After ${Math.ceil(viewPly / 2)}${viewPly % 2 ? '.' : '…'} ${g.sans[viewPly - 1]}`}</span>
      {#if !g.isOver}<button class="btn primary back-live" onclick={() => go(g.sans.length)}>Back to the game</button>{/if}
    </div>
  {/if}
{/snippet}

<div class="game">
  <section class="board-col" aria-label="Board">
    <PlayerBar {...top} />
    <div class="board-box">
      <Board
        bind:this={board}
        fen={view.fen}
        {orientation}
        turnColor={view.pos.turn}
        movable={view.movable}
        dests={view.dests}
        lastMove={view.lastMove}
        check={view.check}
        premovable={$premovesOn && !g.isOver && viewPly === undefined}
        queued={view.queued}
        shapes={view.shapes}
        label="Game board"
        {onmove}
        {onpremove}
        onswipe={(d) => go((viewPly ?? g.sans.length) + (d === 'forward' ? 1 : -1))}
      />
    </div>
    <PlayerBar {...bottom} />
    {#if game.timed && !g.isOver && g.sans.length < 2}
      <p class="first-move" role="status">
        <Icon name="history" size={16} />
        {g.sans.length === 0 && game.human === 'white' ? 'Play your first move.' : g.sans.length === 1 && game.human === 'black' ? 'Your move.' : 'Waiting for the first move.'}
        The clocks start once each side has made a move, as on Lichess and chess.com.
      </p>
    {/if}
    <!-- Phones: the move buttons and Resign right under the board, no scrolling. -->
    <div class="phone-controls">
      <MoveNav ply={viewPly ?? g.sans.length} max={g.sans.length} {go} onflip={() => (orientation = opposite(orientation))} />
      {@render lookingRow()}
      {#if !g.isOver}<div class="actions">{@render actionButtons()}</div>{/if}
    </div>
  </section>

  <aside class="side">
    <div class="panel-card moves-card">
      <div class="head">
        <span class="title">{game.timed ? `${tcLabel(game.timeControl)} · ${game.timeControl.kind}` : 'Casual · no clock'}</span>
        <button class="icon-btn small" onclick={() => (orientation = opposite(orientation))} aria-label="Flip board">
          <Icon name="flip" size={18} />
        </button>
      </div>
      {#if reviewing !== undefined}<p class="label reviewing">Marking every move (brilliant … blunder)… {Math.round(reviewing * 100)}%</p>{/if}
      <MoveList sans={g.sans} sources={g.sources} current={viewPly ?? g.sans.length} onselect={go} {badges} />
      <div class="nav-wrap wide-only"><MoveNav ply={viewPly ?? g.sans.length} max={g.sans.length} {go} /></div>
      <div class="wide-only">{@render lookingRow()}</div>
    </div>

    {#if g.isOver}
      <div class="result panel-card" style="--tone: {headline.tone}">
        <div class="result-head">
          <span class="display" style="color: var(--tone); font-size: 38px">{headline.text}</span>
          {#if g.result}<span class="tag title">{g.result}</span>{/if}
        </div>
        <p class="label reason">{g.endReason}</p>
        {#if kfideChange}
          <a class="kfide" href="/profile">CC Rating · {SPEED_LABEL[speed]} <strong class="num">{kfideChange.after}</strong>
            <span class="num" class:up={kfideChange.after > kfideChange.before} class:down={kfideChange.after < kfideChange.before}>({kfideChange.after >= kfideChange.before ? '+' : ''}{kfideChange.after - kfideChange.before})</span></a>
        {/if}
        <div class="row">
          <button class="btn primary" onclick={onagain}><Icon name="replay" size={18} />{againLabel}</button>
          <a class="btn" href="/analysis?game={id}"><Icon name="analyse" size={18} />Analyse</a>
          <ShareGame game={() => myGames.get(id)} />
        </div>
        {#if summary}
          <ReviewSummary review={summary} names={{ white: game.human === 'white' ? ($myName || 'You') : opponent, black: game.human === 'black' ? ($myName || 'You') : opponent }} current={viewPly ?? g.sans.length} onselect={go} compact />
        {/if}
        <a class="btn guru" href="/coach/review/{id}"><Icon name="coach" size={18} />Review this game with Guru</a>
        <a class="btn ghost" href="/play">Change settings</a>
      </div>
    {:else}
      <div class="actions wide-only">{@render actionButtons()}</div>
    {/if}
  </aside>
</div>

<style>
  .looking-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px 10px;
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
  .board-box {
    width: 100%;
  }
  .reviewing {
    margin: 0;
    padding: 8px 14px;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
  }
  .looking {
    font-size: 13.5px;
  }
  .back-live {
    margin-left: auto;
  }
  .side {
    flex: 1 1 300px;
    max-width: 420px;
    min-width: 0;
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
  .moves-card :global(.moves) {
    height: 300px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .head .title {
    font-size: 16px;
  }
  .icon-btn.small {
    width: 38px;
    height: 38px;
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
    box-shadow: 0 0 24px color-mix(in srgb, var(--tone) 25%, transparent);
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  .result-head {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }
  .tag {
    padding: 3px 9px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--raised);
    font-size: 15px;
  }
  .kfide {
    font-size: 15px;
    color: var(--text);
    text-decoration: none;
  }
  .kfide strong {
    color: var(--gold);
    font-size: 18px;
  }
  .kfide .up {
    color: var(--win);
  }
  .kfide .down {
    color: var(--loss);
  }
  .reason {
    margin: 0;
    font-size: 14.5px;
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
    .game {
      gap: 10px;
    }
    .side {
      max-width: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    /* Phones: the controls are under the board (phone-controls), not in the side panel. */
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
    .moves-card {
      display: flex;
      flex-direction: column;
    }
    .moves-card :global(.moves) {
      height: 132px;
    }
    .board-col {
      gap: 6px;
    }
  }
  .first-move {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin: 6px 0 0;
    font-size: 13.5px;
    color: var(--text-2);
  }
</style>

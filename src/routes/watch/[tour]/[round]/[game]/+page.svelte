<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import MoveList from '$lib/components/MoveList.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import type { NormalMove } from 'chessops/types';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Key } from '@lichess-org/chessground/types';
  import { destsOf, fenOf, keyOf, moveFromKeys, sanOf, uciToMove } from '$lib/chess/position';
  import { playMoveSound } from '$lib/sound';
  import { clocksAt, readPgn, type PgnGame } from '$lib/chess/pgn';
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
  import { broadcastGamePgn, roundGames, runningClock, type BroadcastGame } from '$lib/lichess';

  const { tour, round, game: gameId } = page.params as { tour: string; round: string; game: string };
  let pgnText = '';
  let game = $state<PgnGame | undefined>();
  let cursor = $state(0);
  let following = $state(true);
  let orientation = $state<'white' | 'black'>('white');
  let engineOn = $state(false);
  let info = $state<EngineInfo | undefined>();
  let error = $state('');
  let timer: ReturnType<typeof setInterval> | undefined;
  /** This game as the round lists it: how long the side to move has been thinking. */
  let board = $state<BroadcastGame | undefined>();
  // The clock of the side to move runs on between refreshes, as on Lichess.
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 250);

  async function load() {
    roundGames(round).then(
      (gs) => (board = gs.find((g) => g.id === gameId)),
      () => {},
    );
    try {
      const text = await broadcastGamePgn(round, gameId);
      if (text === pgnText) return;
      pgnText = text;
      const [g] = readPgn(text);
      if (!g) throw new Error();
      game = g;
      if (following) cursor = g.plies.length;
      if (g.headers.get('Result') !== '*') clearInterval(timer);
    } catch {
      if (!game) error = 'This game could not be loaded. Check your connection and try again.';
    }
  }

  onMount(async () => {
    await load();
    if (game?.headers.get('Result') === '*') timer = setInterval(load, 8000);
  });
  onDestroy(() => {
    clearInterval(timer);
    clearInterval(tick);
    engine.stopAnalysis();
  });

  const pos = $derived(game ? (cursor === 0 ? game.start : game.plies[cursor - 1].after) : undefined);
  /** The viewer's own analysis: moves tried on the board from the game position at `base`. */
  let trial = $state<{ base: number; moves: NormalMove[]; sans: string[] } | undefined>();
  const trialPos = $derived.by(() => {
    if (!trial || !game) return undefined;
    const p = (trial.base === 0 ? game.start : game.plies[trial.base - 1].after).clone();
    for (const m of trial.moves) p.play(m);
    return p;
  });
  /** What the board shows: the analysis, else the game. */
  const shown = $derived(trialPos ?? pos);
  const fen = $derived(shown ? fenOf(shown) : '');
  const h = (k: string) => game?.headers.get(k) ?? '';
  const live = $derived(h('Result') === '*');

  function go(ply: number) {
    if (!game) return;
    trial = undefined;
    cursor = Math.max(0, Math.min(game.plies.length, ply));
    following = cursor === game.plies.length;
  }
  /** Back to the game as it stands now (and keep following it). */
  function goLive() {
    if (game) go(game.plies.length);
  }

  /** A move on the board: the game's next move steps on; any other move starts (or extends) the viewer's analysis. */
  function onmove(orig: Key, dest: Key) {
    if (!game || !shown) return;
    const m = moveFromKeys(shown, orig, dest);
    if (!shown.isLegal(m)) return;
    const next = game.plies[cursor];
    if (!trial && next && next.move.from === m.from && next.move.to === m.to) {
      playMoveSound(shown, m);
      return go(cursor + 1);
    }
    const san = sanOf(shown, m);
    playMoveSound(shown, m);
    trial = trial ? { ...trial, moves: [...trial.moves, m], sans: [...trial.sans, san] } : { base: cursor, moves: [m], sans: [san] };
    following = false;
  }
  function undoTrial() {
    if (!trial) return;
    trial = trial.moves.length > 1 ? { base: trial.base, moves: trial.moves.slice(0, -1), sans: trial.sans.slice(0, -1) } : undefined;
  }
  const behind = $derived(game && !following ? game.plies.length - cursor : 0);
  const atLive = $derived(following && !trial);
  /** The engine's best move, as an arrow. */
  const shapes = $derived.by((): DrawShape[] => {
    const m = engineOn && info?.pv[0] ? uciToMove(info.pv[0]) : undefined;
    return m ? [{ orig: keyOf(m.from), dest: keyOf(m.to), brush: 'blue' }] : [];
  });
  const lastMove = $derived.by((): Key[] | undefined => {
    if (trial) {
      const m = trial.moves[trial.moves.length - 1];
      return [keyOf(m.from), keyOf(m.to)];
    }
    return cursor && game ? [keyOf(game.plies[cursor - 1].move.from), keyOf(game.plies[cursor - 1].move.to)] : undefined;
  });

  $effect(() => {
    const f = fen;
    info = undefined;
    if (!engineOn || !f || shown?.isEnd()) {
      engine.stopAnalysis();
      return;
    }
    void engine.analyse(f, (i) => {
      if (i.fen === f) info = i;
    }, 20);
  });

  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' && trial) undoTrial();
    else if (e.key === 'ArrowLeft') go(cursor - 1);
    else if (e.key === 'ArrowRight') go(cursor + 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(game?.plies.length ?? 0);
    else if (e.key === 'f') orientation = orientation === 'white' ? 'black' : 'white';
    else return;
    e.preventDefault();
  }

  function bar(side: 'white' | 'black') {
    const name = h(side === 'white' ? 'White' : 'Black');
    const t = h(side === 'white' ? 'WhiteTitle' : 'BlackTitle');
    const title = t === 'BOT' ? '' : t;
    const elo = h(side === 'white' ? 'WhiteElo' : 'BlackElo');
    const clocks = game ? clocksAt(game, cursor) : {};
    const latest = live && cursor === (game?.plies.length ?? 0);
    // Run the clock of the side to move when we're showing the position the round has now.
    const running = latest && pos?.turn === side && board && board.fen.split(' ')[0] === fen.split(' ')[0];
    return {
      name: `${title ? title + ' ' : ''}${name}`,
      initials: name.split(/[ ,]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?',
      subtitle: [elo, h(side === 'white' ? 'WhiteFed' : 'BlackFed')].filter(Boolean).join(' · ') || (side === 'white' ? 'White' : 'Black'),
      toMove: live && pos?.turn === side && cursor === (game?.plies.length ?? 0),
      clockMs: running ? runningClock(clocks[side], board!, now) : clocks[side],
    };
  }
  const top = $derived.by(() => {
    void cursor;
    void game;
    void now;
    void board;
    return bar(orientation === 'white' ? 'black' : 'white');
  });
  const bottom = $derived.by(() => {
    void cursor;
    void game;
    void now;
    void board;
    return bar(orientation);
  });
</script>

<svelte:head><title>{game ? `${h('White')} – ${h('Black')}` : 'Game'} · Watch · Chess Castles</title></svelte:head>
<svelte:window onkeydown={onkey} />

<div class="viewer">
  {#if error}
    <div class="card">{error} <a href="/watch/{tour}?round={round}">Back to the round</a></div>
  {:else if !game || !pos}
    <div class="card">Loading the game…</div>
  {:else}
    <section class="board-col" aria-label="Board">
      <PlayerBar {...top} />
      <div class="board-row">
        {#if engineOn}
          <div class="evalbar" class:flipped={orientation === 'black'} aria-label="Evaluation {info ? evalLabel(info) : 'pending'}">
            <div class="white-share" style="height: {(info ? whiteChances(info) : 0.5) * 100}%"></div>
          </div>
        {/if}
        <div class="board-box">
          <Board
            {fen}
            {orientation}
            turnColor={shown!.turn}
            movable={shown!.isEnd() ? undefined : 'both'}
            dests={shown!.isEnd() ? new Map() : destsOf(shown!)}
            {lastMove}
            {shapes}
            {onmove}
            check={shown!.isCheck()}
            label="{h('White')} against {h('Black')}"
            onswipe={(d) => go(cursor + (d === 'forward' ? 1 : -1))}
          />
        </div>
      </div>
      <PlayerBar {...bottom} />
    </section>

    <aside class="side">
      <div class="card info">
        <a class="back" href="/watch/{tour}?round={round}"><Icon name="back" size={16} />All boards</a>
        <h1 class="title g-title">{h('White')} – {h('Black')}</h1>
        <p class="label">{[h('Event').replace(/^Round [^:]+: .*$/, h('BroadcastName')) || h('BroadcastName'), h('Opening')].filter(Boolean).join(' · ')}</p>
        <div class="status">
          {#if live}
            <button class="pill live" class:away={!atLive} onclick={goLive} title={atLive ? 'Following the game live' : 'Back to the live position'}>
              <span class="dot"></span>{atLive ? 'Live' : `Back to live${behind ? ` · ${behind} new` : ''}`}
            </button>
          {:else}
            <span class="tag title">{h('Result').replace('1/2-1/2', '½-½')}</span>
            {#if trial || cursor !== game.plies.length}<button class="btn small" onclick={goLive}>Final position</button>{/if}
          {/if}
        </div>
        {#if trial}
          <div class="trial">
            <span class="label">Your analysis from move {Math.floor(trial.base / 2) + 1}:</span>
            <span class="trial-moves">{trial.sans.join(' ')}</span>
            <span class="trial-btns">
              <button class="btn small" onclick={undoTrial}><Icon name="undo" size={14} />Undo</button>
              <button class="btn small" onclick={() => go(trial!.base)}>Back to the game</button>
            </span>
          </div>
        {:else}
          <p class="label hint">Move the pieces to try your own ideas; turn on the engine to check them.</p>
        {/if}
        <label class="toggle">
          <input type="checkbox" bind:checked={engineOn} />
          <span>Engine {engineOn && info ? `· ${evalLabel(info)} (depth ${info.depth})` : ''}</span>
        </label>
      </div>
      <div class="card moves-card">
        <MoveList sans={game.plies.map((p) => p.san)} current={cursor} onselect={go} />
        <MoveNav ply={cursor} max={game.plies.length} {go} onflip={() => (orientation = orientation === 'white' ? 'black' : 'white')} />
      </div>
    </aside>
  {/if}
</div>

<style>
  button.pill.live {
    border: 0;
    cursor: pointer;
    font: inherit;
  }
  button.pill.live.away {
    background: color-mix(in srgb, var(--live) 22%, transparent);
    outline: 1px solid var(--live);
  }
  .trial {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--raised);
  }
  .trial-moves {
    font-weight: 600;
    word-break: break-word;
  }
  .trial-btns {
    display: flex;
    gap: 6px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
  }
  .viewer {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    max-width: 1280px;
    margin: 0 auto;
    justify-content: center;
    align-items: flex-start;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 210px), 740px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .board-box {
    flex: 1;
    min-width: 0;
  }
  .evalbar {
    width: 18px;
    flex: none;
    border-radius: 6px;
    overflow: hidden;
    background: #1b1f2a;
    display: flex;
    flex-direction: column-reverse;
  }
  .evalbar.flipped {
    flex-direction: column;
  }
  .white-share {
    background: #f2f5fb;
    transition: height 0.4s;
  }
  .side {
    flex: 1 1 340px;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .g-title {
    font-size: 21px;
  }
  .info .label {
    margin: 0;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--live);
  }
  .tag {
    padding: 3px 9px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--raised);
    font-size: 15px;
  }
  .btn.small {
    min-height: 34px;
    padding: 0 12px;
    font-size: 14px;
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
  .moves-card {
    padding: 0;
    overflow: hidden;
  }
  .moves-card :global(.moves) {
    height: 300px;
  }
  @media (max-width: 767px) {
    .side {
      max-width: none;
    }
    .moves-card :global(.moves) {
      height: 180px;
    }
  }
</style>

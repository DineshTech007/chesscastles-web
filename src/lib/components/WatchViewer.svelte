<script lang="ts" module>
  /** What a player bar shows (see PlayerBar). */
  export interface BarInfo {
    name: string;
    initials: string;
    subtitle: string;
    toMove?: boolean;
    clockMs?: number;
    title?: string;
    country?: string;
    rating?: string;
  }
</script>

<script lang="ts">
  /**
   * Watching a game, live or finished (a broadcast board, a Lichess game): the
   * moves to step through (the buttons right under the board), the viewer's
   * own moves on the board to try ideas, the engine (bar, arrow, score) and
   * the games database for the position shown, and Live to come back to the
   * game as it stands. `extra`: more below the moves (the chat).
   */
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';
  import type { NormalMove } from 'chessops/types';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from './Board.svelte';
  import Icon from './Icon.svelte';
  import MoveList from './MoveList.svelte';
  import MoveNav from './MoveNav.svelte';
  import PlayerBar from './PlayerBar.svelte';
  import DbPanel from './DbPanel.svelte';
  import { destsOf, fenOf, keyOf, moveFromKeys, sanOf, uciToMove } from '$lib/chess/position';
  import { playMoveSound } from '$lib/sound';
  import type { PgnGame } from '$lib/chess/pgn';
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
  import { CloudBook } from '$lib/book/book';

  let {
    game,
    live,
    heading,
    subheading = '',
    result = '',
    backHref,
    backLabel,
    barFor,
    extra,
    side = 'white',
  }: {
    game: PgnGame;
    live: boolean;
    heading: string;
    subheading?: string;
    /** The result, once the game is over ("1-0", "½-½"…). */
    result?: string;
    backHref: string;
    backLabel: string;
    /** A side's bar at the position shown (`latest`: it is the game as it stands now). */
    barFor: (side: 'white' | 'black', ply: number, latest: boolean) => BarInfo;
    extra?: Snippet;
    /** The side at the bottom to start with. */
    side?: 'white' | 'black';
  } = $props();

  let cursor = $state(0);
  let following = $state(true);
  // svelte-ignore state_referenced_locally
  let orientation = $state<'white' | 'black'>(side);
  let engineOn = $state(false);
  let dbOn = $state(false);
  let info = $state<EngineInfo | undefined>();
  const book = new CloudBook();
  onDestroy(() => engine.stopAnalysis());

  // Following the game: each new move comes to the board.
  $effect(() => {
    const n = game.plies.length;
    if (following) cursor = n;
    else if (cursor > n) cursor = n;
  });

  const pos = $derived(cursor === 0 ? game.start : game.plies[cursor - 1].after);
  /** The viewer's own moves from the game position at `base`. */
  let trial = $state<{ base: number; moves: NormalMove[]; sans: string[] } | undefined>();
  const trialPos = $derived.by(() => {
    if (!trial) return undefined;
    const p = (trial.base === 0 ? game.start : game.plies[trial.base - 1].after).clone();
    for (const m of trial.moves) p.play(m);
    return p;
  });
  const shown = $derived(trialPos ?? pos);
  const fen = $derived(fenOf(shown));

  function go(ply: number) {
    trial = undefined;
    cursor = Math.max(0, Math.min(game.plies.length, ply));
    following = cursor === game.plies.length;
  }
  const goLive = () => go(game.plies.length);

  /** A move on the board: the game's next move steps on; any other starts (or extends) the viewer's own line. */
  function play(m: NormalMove) {
    if (!shown.isLegal(m)) return;
    const next = game.plies[cursor];
    playMoveSound(shown, m);
    if (!trial && next && next.move.from === m.from && next.move.to === m.to) return go(cursor + 1);
    const san = sanOf(shown, m);
    trial = trial ? { ...trial, moves: [...trial.moves, m], sans: [...trial.sans, san] } : { base: cursor, moves: [m], sans: [san] };
    following = false;
  }
  const onmove = (orig: Key, dest: Key) => play(moveFromKeys(shown, orig, dest));
  function undoTrial() {
    if (!trial) return;
    trial = trial.moves.length > 1 ? { base: trial.base, moves: trial.moves.slice(0, -1), sans: trial.sans.slice(0, -1) } : undefined;
  }
  const behind = $derived(!following ? game.plies.length - cursor : 0);
  const atLive = $derived(following && !trial);
  const shapes = $derived.by((): DrawShape[] => {
    const m = engineOn && info?.pv[0] ? uciToMove(info.pv[0]) : undefined;
    return m ? [{ orig: keyOf(m.from), dest: keyOf(m.to), brush: 'blue' }] : [];
  });
  const lastMove = $derived.by((): Key[] | undefined => {
    if (trial) {
      const m = trial.moves[trial.moves.length - 1];
      return [keyOf(m.from), keyOf(m.to)];
    }
    return cursor ? [keyOf(game.plies[cursor - 1].move.from), keyOf(game.plies[cursor - 1].move.to)] : undefined;
  });

  $effect(() => {
    const f = fen;
    info = undefined;
    if (!engineOn || shown.isEnd()) {
      engine.stopAnalysis();
      return;
    }
    void engine.analyse(
      f,
      (i) => {
        if (i.fen === f) info = i;
      },
      20,
    );
  });

  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowLeft' && trial) undoTrial();
    else if (e.key === 'ArrowLeft') go(cursor - 1);
    else if (e.key === 'ArrowRight') go(cursor + 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(game.plies.length);
    else if (e.key === 'f') orientation = orientation === 'white' ? 'black' : 'white';
    else return;
    e.preventDefault();
  }

  const latest = $derived(live && cursor === game.plies.length && !trial);
  const top = $derived(barFor(orientation === 'white' ? 'black' : 'white', cursor, latest));
  const bottom = $derived(barFor(orientation, cursor, latest));
</script>

<svelte:window onkeydown={onkey} />

<div class="viewer">
  <section class="board-col" aria-label="Board">
    <a class="back-top" href={backHref}><Icon name="back" size={16} />{backLabel}</a>
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
          turnColor={shown.turn}
          movable={shown.isEnd() ? undefined : 'both'}
          dests={shown.isEnd() ? new Map() : destsOf(shown)}
          {lastMove}
          {shapes}
          {onmove}
          check={shown.isCheck()}
          label={heading}
          onswipe={(d) => go(cursor + (d === 'forward' ? 1 : -1))}
        />
      </div>
    </div>
    <PlayerBar {...bottom} />
    <div class="card nav-card">
      <MoveNav ply={cursor} max={game.plies.length} {go} onflip={() => (orientation = orientation === 'white' ? 'black' : 'white')} />
    </div>
  </section>

  <aside class="side">
    <div class="card info">
      <h1 class="title g-title">{heading}</h1>
      {#if subheading}<p class="label">{subheading}</p>{/if}
      <div class="status">
        {#if live}
          <button class="pill live" class:away={!atLive} onclick={goLive} title={atLive ? 'Following the game live' : 'Back to the live position'}>
            <span class="dot"></span>{atLive ? 'Live' : `Back to live${behind ? ` · ${behind} new` : ''}`}
          </button>
        {:else}
          {#if result}<span class="tag title">{result}</span>{/if}
          {#if trial || cursor !== game.plies.length}<button class="btn small" onclick={goLive}>Final position</button>{/if}
        {/if}
      </div>
      {#if trial}
        <div class="trial">
          <span class="label">Your moves from move {Math.floor(trial.base / 2) + 1}:</span>
          <span class="trial-moves">{trial.sans.join(' ')}</span>
          <span class="trial-btns">
            <button class="btn small" onclick={undoTrial}><Icon name="undo" size={14} />Undo</button>
            <button class="btn small" onclick={() => go(trial!.base)}>Back to the game</button>
          </span>
        </div>
      {:else}
        <p class="label hint">Move the pieces to try your own ideas (only you see them); turn on the engine or the database to check them.</p>
      {/if}
      <div class="toggles">
        <label class="toggle">
          <input type="checkbox" bind:checked={engineOn} />
          <span>Engine {engineOn && info ? `· ${evalLabel(info)} (depth ${info.depth})` : ''}</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={dbOn} />
          <span>Database</span>
        </label>
      </div>
    </div>
    {#if dbOn}
      <div class="card db">
        <DbPanel pos={shown} {book} onplay={play} played={!trial ? game.plies[cursor]?.move : undefined} />
      </div>
    {/if}
    <div class="card moves-card">
      <MoveList sans={game.plies.map((p) => p.san)} current={cursor} onselect={go} />
    </div>
    {#if extra}{@render extra()}{/if}
  </aside>
</div>

<style>
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
    flex: 0 1 min(100%, calc(100vh - 260px), 740px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .back-top {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 14px;
    width: fit-content;
    padding: 2px 0;
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
  .nav-card {
    padding: 0;
    overflow: hidden;
  }
  .nav-card :global(.nav) {
    border-top: 0;
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
  .g-title {
    font-size: 21px;
    margin: 0;
  }
  .info .label {
    margin: 0;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  button.pill.live {
    border: 0;
    cursor: pointer;
    font: inherit;
  }
  button.pill.live.away {
    background: color-mix(in srgb, var(--live) 22%, transparent);
    outline: 1px solid var(--live);
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
    font-size: 13px;
  }
  .btn.small {
    min-height: 34px;
    padding: 0 12px;
    font-size: 14px;
  }
  .toggles {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
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
  .db {
    padding: 10px 12px;
  }
  .moves-card {
    padding: 0;
    overflow: hidden;
  }
  .moves-card :global(.moves) {
    height: 260px;
  }
  @media (max-width: 767px) {
    .side {
      max-width: none;
    }
    .moves-card :global(.moves) {
      height: 160px;
    }
  }
</style>

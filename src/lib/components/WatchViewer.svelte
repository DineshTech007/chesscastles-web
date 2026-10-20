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
    /** After a rated game: how the rating moved. */
    ratingChange?: number;
    /** The player's page on Chess Castles: the name links to it. */
    href?: string;
  }
  let board: Board | undefined = $state();
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
  import { promotionFor } from '$lib/chess/promotion';
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

  /** Phones and narrow windows: the database opens under the board's buttons, not far below. */
  let width = $state(1280);
  const narrow = $derived(width < 900);
  let cursor = $state(0);
  let following = $state(true);
  // svelte-ignore state_referenced_locally
  let orientation = $state<'white' | 'black'>(side);
  /** What the analysis panel shows: the engine's three best moves (from the start), the database's, or nothing. */
  let mode = $state<'engine' | 'db' | 'off'>('engine');
  const engineOn = $derived(mode === 'engine');
  const dbOn = $derived(mode === 'db');
  /** The engine's best lines (up to three) for the position shown. */
  let lines = $state<EngineInfo[]>([]);
  const info = $derived<EngineInfo | undefined>(lines[0]);
  const book = new CloudBook();
  onDestroy(() => engine.stopAnalysis());

  // Following the game: each new move comes to the board.
  $effect(() => {
    const n = game.plies.length;
    if (following) cursor = n;
    else if (cursor > n) cursor = n;
  });

  // A shorter game (a friend's next game) can come before the effect above moves the cursor back: kept in range here.
  const at = $derived(Math.min(cursor, game.plies.length));
  const pos = $derived(at === 0 ? game.start : game.plies[at - 1].after);
  /** The viewer's own moves from the game position at `base`. */
  let trial = $state<{ base: number; moves: NormalMove[]; sans: string[] } | undefined>();
  const trialPos = $derived.by(() => {
    if (!trial || trial.base > game.plies.length) return undefined;
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
  async function onmove(orig: Key, dest: Key) {
    const promotion = await promotionFor(shown, orig, dest);
    if (promotion === null) return board?.resync();
    play(moveFromKeys(shown, orig, dest, promotion));
  }
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
    return at ? [keyOf(game.plies[at - 1].move.from), keyOf(game.plies[at - 1].move.to)] : undefined;
  });

  $effect(() => {
    const f = fen;
    lines = [];
    if (!engineOn || shown.isEnd()) {
      engine.stopAnalysis();
      return;
    }
    void engine.analyse(
      f,
      () => {},
      20,
      undefined,
      3,
      (l) => {
        if (l[0]?.fen === f) lines = [...l];
      },
    );
  });

  /** A line's first moves in words ("12. Nf3 e5 13. d4"), from the position shown. */
  function pvText(l: EngineInfo, max = 7): string {
    const p = shown.clone();
    const out: string[] = [];
    for (const u of l.pv.slice(0, max)) {
      const m = uciToMove(u);
      if (!m || !p.isLegal(m)) break;
      out.push(`${p.turn === 'white' ? `${p.fullmoves}.` : !out.length ? `${p.fullmoves}…` : ''}${sanOf(p, m)}`);
      p.play(m);
    }
    return out.join(' ');
  }
  const playLine = (l: EngineInfo) => {
    const m = l.pv[0] ? uciToMove(l.pv[0]) : undefined;
    if (m) play(m);
  };

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

<svelte:window onkeydown={onkey} bind:innerWidth={width} />

{#snippet movesCard()}
  <div class="card moves-card">
    <MoveList sans={game.plies.map((p) => p.san)} current={cursor} onselect={go} />
  </div>
{/snippet}

{#snippet analysisCard()}
  <div class="card analysis">
    <div class="radios" role="radiogroup" aria-label="Analysis">
      <label class:on={mode === 'engine'}><input type="radio" name="wv-mode" value="engine" bind:group={mode} /><span>Engine</span></label>
      <label class:on={mode === 'db'}><input type="radio" name="wv-mode" value="db" bind:group={mode} /><span>Database</span></label>
      <label class:on={mode === 'off'}><input type="radio" name="wv-mode" value="off" bind:group={mode} /><span>Off</span></label>
    </div>
    {#if mode === 'engine'}
      {#if shown.isEnd()}
        <p class="label">{shown.isCheckmate() ? 'Checkmate' : 'Game over'}</p>
      {:else if !lines.length}
        <p class="label">The engine is thinking…</p>
      {:else}
        <ol class="elines" aria-label="The engine's best moves">
          {#each lines as l, i (i)}
            <li>
              <button class="eline" onclick={() => playLine(l)} title="Play this move">
                <span class="ev num">{evalLabel(l)}</span>
                <span class="pv num">{pvText(l)}</span>
              </button>
            </li>
          {/each}
        </ol>
        <span class="label depth">Stockfish 19 · depth {lines[0].depth}</span>
      {/if}
    {:else if mode === 'db'}
      <DbPanel pos={shown} {book} onplay={play} played={!trial ? game.plies[cursor]?.move : undefined} />
    {/if}
  </div>
{/snippet}

<div class="viewer">
  <section class="board-col" aria-label="Board">
    <a class="back-top" href={backHref}><Icon name="back" size={16} />{backLabel}</a>
    <div class="stage">
      <PlayerBar {...top} />
      <div class="board-row">
        {#if engineOn}
          <div class="evalbar" class:flipped={orientation === 'black'} aria-label="Evaluation {info ? evalLabel(info) : 'pending'}">
            <div class="white-share" style="height: {(info ? whiteChances(info) : 0.5) * 100}%"></div>
          </div>
        {/if}
        <div class="board-box">
          <Board bind:this={board}
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
      <!-- Phones: the moves, then the engine or database, right under the board's buttons. -->
      {#if narrow}
        {@render movesCard()}
        {@render analysisCard()}
      {/if}
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
        <p class="label hint">Move the pieces to try your own ideas (only you see them).</p>
      {/if}
    </div>
    {#if !narrow}
      {@render movesCard()}
      {@render analysisCard()}
    {/if}
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
  .stage {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .analysis {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
  }
  .analysis p {
    margin: 0;
  }
  .radios {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .radios label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px 7px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
    font-weight: 700;
    cursor: pointer;
  }
  .radios label.on {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 16%, var(--raised));
  }
  .radios input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--gold);
  }
  .elines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .eline {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 7px 10px;
    border: 0;
    border-radius: 8px;
    background: var(--raised);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .eline:hover {
    background: color-mix(in srgb, var(--accent) 14%, var(--raised));
  }
  .eline .ev {
    flex: none;
    min-width: 52px;
    font-weight: 800;
    color: var(--gold);
  }
  .eline .pv {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .depth {
    font-size: 12px;
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
  .moves-card {
    padding: 0;
    overflow: hidden;
  }
  .moves-card :global(.moves) {
    height: 220px;
  }
  @media (max-width: 899px) {
    .board-col {
      flex: 1 1 100%;
    }
    /* A phone: the board gets what the screen leaves after the bars, buttons, moves and analysis, so all of them are in view. */
    .stage {
      gap: 5px;
    }
    .board-row,
    .stage > :global(.bar),
    .stage > .nav-card {
      width: min(100%, max(240px, calc(100dvh - 500px)));
      margin-left: auto;
      margin-right: auto;
    }
    .nav-card :global(.nb) {
      height: 40px;
    }
    .analysis {
      gap: 5px;
      padding: 7px 10px;
    }
    .radios label {
      padding: 4px 12px 4px 8px;
    }
    .eline {
      padding: 4px 8px;
    }
    .depth {
      display: none;
    }
    .back-top {
      display: none;
    }
    .moves-card :global(.moves) {
      height: 72px;
    }
    .side {
      max-width: none;
    }
  }
</style>

<script lang="ts">
  /**
   * A model game on an analysis board: it opens where the studied line ends;
   * the student steps through it or lets it play, tries their own moves on
   * the board (a side line, with Undo and Back to the game), turns on the
   * engine (evaluation bar, best-move arrow) and checks the position in the
   * games database.
   */
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import DbPanel from '$lib/components/DbPanel.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import { destsOf, fenOf, keyOf, moveFromKeys, sanOf, uciToMove } from '$lib/chess/position';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { CloudBook } from '$lib/book/book';
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
  import { gamesDb } from '$lib/games/gamesDb';
  import { playMoveSound } from '$lib/sound';

  let { gameId, lineEnd, orientation = 'white', onclose }: { gameId: number; lineEnd?: string; orientation?: 'white' | 'black'; onclose?: () => void } = $props();

  let positions = $state<Chess[]>([]);
  let moves = $state<NormalMove[]>([]);
  let sans = $state<string[]>([]);
  let ply = $state(0);
  let title = $state('');
  let info = $state('');
  let failed = $state(false);
  let auto = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let side = $state<'moves' | 'database'>('moves');
  let engineOn = $state(false);
  let evalInfo = $state<EngineInfo | undefined>();
  let flip = $state(false);
  const book = new CloudBook();
  /** The student's own moves from the game position at `base`. */
  let trial = $state<{ base: number; moves: NormalMove[]; sans: string[] } | undefined>();

  onMount(async () => {
    try {
      const g = await gamesDb.game(untrack(() => gameId));
      if (!g) throw new Error('missing');
      const ps: Chess[] = [g.start.clone()];
      const ss: string[] = [];
      for (const m of g.moves) {
        const p = ps[ps.length - 1].clone();
        ss.push(sanOf(p, m));
        p.play(m);
        ps.push(p);
      }
      positions = ps;
      moves = g.moves;
      sans = ss;
      title = `${g.white} – ${g.black}`;
      info = [g.event, g.year || '', g.result.replace('1/2-1/2', '½-½')].filter(Boolean).join(' · ');
      // Start where the line ends (the first time the game reaches it).
      const end = untrack(() => lineEnd);
      const at = end ? ps.findIndex((p) => polyglotKey(p).toString(16) === end) : -1;
      ply = at >= 0 ? at : Math.min(ps.length - 1, 16);
    } catch {
      failed = true;
    }
  });
  onDestroy(() => {
    clearInterval(timer);
    engine.stopAnalysis();
  });

  const trialPos = $derived.by(() => {
    if (!trial || !positions.length) return undefined;
    const p = positions[trial.base].clone();
    for (const m of trial.moves) p.play(m);
    return p;
  });
  /** What the board shows: the student's analysis, else the game. */
  const shown = $derived(trialPos ?? positions[ply]);
  const fen = $derived(shown ? fenOf(shown) : '');

  $effect(() => {
    const f = fen;
    evalInfo = undefined;
    if (!engineOn || !f || shown?.isEnd()) {
      engine.stopAnalysis();
      return;
    }
    void engine.analyse(f, (i) => {
      if (i.fen === f) evalInfo = i;
    }, 20);
  });

  function go(n: number) {
    trial = undefined;
    const to = Math.max(0, Math.min(positions.length - 1, n));
    if (to === ply + 1 && moves[ply]) playMoveSound(positions[ply], moves[ply]);
    ply = to;
  }
  function toggleAuto() {
    auto = !auto;
    clearInterval(timer);
    if (auto)
      timer = setInterval(() => {
        if (ply >= positions.length - 1) {
          auto = false;
          clearInterval(timer);
        } else go(ply + 1);
      }, 1200);
  }

  /** A move on the board (or from the database): the game's next move steps on; any other starts the student's own line. */
  function play(m: NormalMove) {
    if (!shown || !shown.isLegal(m)) return;
    const next = moves[ply];
    playMoveSound(shown, m);
    if (!trial && next && next.from === m.from && next.to === m.to) {
      ply++;
      return;
    }
    const san = sanOf(shown, m);
    trial = trial ? { ...trial, moves: [...trial.moves, m], sans: [...trial.sans, san] } : { base: ply, moves: [m], sans: [san] };
  }
  function onmove(orig: Key, dest: Key) {
    if (shown) play(moveFromKeys(shown, orig, dest));
  }
  function undoTrial() {
    if (!trial) return;
    trial = trial.moves.length > 1 ? { base: trial.base, moves: trial.moves.slice(0, -1), sans: trial.sans.slice(0, -1) } : undefined;
  }
  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight' && !trial) go(ply + 1);
    else if (e.key === 'ArrowLeft') {
      if (trial) undoTrial();
      else go(ply - 1);
    }
  }

  const lastMove = $derived.by((): Key[] | undefined => {
    if (trial) {
      const m = trial.moves[trial.moves.length - 1];
      return [keyOf(m.from), keyOf(m.to)];
    }
    return ply > 0 && moves[ply - 1] ? [keyOf(moves[ply - 1].from), keyOf(moves[ply - 1].to)] : undefined;
  });
  const shapes = $derived.by((): DrawShape[] => {
    const m = engineOn && evalInfo?.pv[0] ? uciToMove(evalInfo.pv[0]) : undefined;
    return m ? [{ orig: keyOf(m.from), dest: keyOf(m.to), brush: 'blue' }] : [];
  });
  const view = $derived(flip ? (orientation === 'white' ? 'black' : 'white') : orientation);
  const keyNow = $derived(shown ? polyglotKey(shown).toString(16) : '');
</script>

<svelte:window onkeydown={onkey} />

<div class="viewer">
  {#if failed}
    <p class="card note">This game could not be loaded. Check your connection and try again.</p>
  {:else if !shown}
    <p class="card note">Loading the game…</p>
  {:else}
    <div class="board-col">
      <div class="board-row">
        {#if engineOn}
          <div class="evalbar" class:flipped={view === 'black'} aria-label="Evaluation {evalInfo ? evalLabel(evalInfo) : 'pending'}">
            <div class="white-share" style="height: {(evalInfo ? whiteChances(evalInfo) : 0.5) * 100}%"></div>
          </div>
        {/if}
        <div class="board-box">
          <Board
            {fen}
            orientation={view}
            turnColor={shown.turn}
            movable={shown.isEnd() ? undefined : 'both'}
            dests={shown.isEnd() ? new Map() : destsOf(shown)}
            {lastMove}
            {shapes}
            {onmove}
            check={shown.isCheck()}
            label="Model game"
            onswipe={(d) => (d === 'forward' ? !trial && go(ply + 1) : trial ? undoTrial() : go(ply - 1))}
          />
        </div>
      </div>
      <MoveNav {ply} max={positions.length - 1} {go} onflip={() => (flip = !flip)} />
    </div>
    <div class="side">
      <div class="head">
        <div>
          <span class="title">{title}</span>
          <span class="label">{info}</span>
        </div>
        {#if onclose}<button class="icon-btn" onclick={onclose} aria-label="Close the game"><Icon name="close" size={18} /></button>{/if}
      </div>
      <div class="btns">
        <button class="btn" onclick={toggleAuto}><Icon name={auto ? 'close' : 'play'} size={16} />{auto ? 'Stop' : 'Play through'}</button>
        <label class="toggle"><input type="checkbox" bind:checked={engineOn} /><span>Engine{engineOn && evalInfo ? ` ${evalLabel(evalInfo)} · depth ${evalInfo.depth}` : ''}</span></label>
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
        <p class="label hint">Move the pieces to try your own ideas.</p>
      {/if}
      <div class="segmented tabs" role="group" aria-label="Panel">
        <button aria-pressed={side === 'moves'} onclick={() => (side = 'moves')}>Moves</button>
        <button aria-pressed={side === 'database'} onclick={() => (side = 'database')}><Icon name="database" size={15} />Database</button>
      </div>
      {#if side === 'moves'}
        <p class="moves">
          {#each sans as s, i (i)}
            {#if i % 2 === 0}<span class="no">{i / 2 + 1}.</span>{/if}
            <button class="mv" class:on={!trial && i + 1 === ply} onclick={() => go(i + 1)}>{s}</button>
          {/each}
        </p>
      {:else}
        <div class="db">
          <DbPanel pos={shown} {book} onplay={play} played={!trial ? moves[ply] : undefined} onopen={(id) => (location.href = `/analysis?db=${id}&key=${keyNow}`)} />
        </div>
      {/if}
      <a class="label full" href="/analysis?db={gameId}&key={keyNow}">Open on the full analysis board</a>
    </div>
  {/if}
</div>

<style>
  .viewer {
    display: grid;
    grid-template-columns: minmax(0, 560px) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .board-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .board-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .board-box {
    flex: 1;
    min-width: 0;
  }
  .evalbar {
    width: 14px;
    border-radius: 6px;
    overflow: hidden;
    background: #2b2b2b;
    display: flex;
    flex-direction: column-reverse;
  }
  .evalbar.flipped {
    flex-direction: column;
  }
  .white-share {
    background: #f1f1f1;
    transition: height 0.3s;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .head > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .btns {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  .toggle {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    cursor: pointer;
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
  .tabs {
    align-self: flex-start;
  }
  .tabs button {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .moves {
    margin: 0;
    max-height: 340px;
    overflow-y: auto;
    line-height: 1.9;
  }
  .db {
    max-height: 460px;
    overflow-y: auto;
  }
  .no {
    color: var(--muted);
    font-size: 13px;
    margin: 0 2px 0 6px;
  }
  .mv {
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    padding: 1px 4px;
    border-radius: 6px;
    cursor: pointer;
  }
  .mv.on {
    background: var(--brand);
    color: var(--on-action);
  }
  .full {
    color: var(--brand);
  }
  .note {
    padding: 14px;
  }
  @media (max-width: 800px) {
    .viewer {
      grid-template-columns: 1fr;
    }
    .moves {
      max-height: 180px;
    }
  }
</style>

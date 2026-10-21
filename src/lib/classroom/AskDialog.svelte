<script lang="ts">
  /**
   * The coach asks the class a question: the best move in the board's position (the engine's answer, or the coach
   * plays it in), the position played out against the computer (checkmate, win, or hold the draw), or a set of
   * puzzles from the bank by theme and rating. Then the time, the points, minus points for a miss, and the tries.
   */
  import { onMount } from 'svelte';
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { makeUci, parseUci } from 'chessops/util';
  import { makeFen } from 'chessops/fen';
  import Board from '$lib/components/Board.svelte';
  import { destsOf, keyOf, moveFromKeys, positionFromFen } from '$lib/chess/position';
  import { promotionFor } from '$lib/chess/promotion';
  import { engine, evalLabel } from '$lib/engine/stockfish';
  import { puzzleSet, sanLine, sideOf, THEMES } from './tasks';
  import type { Item, TaskKind } from './api';

  let {
    fen,
    used,
    onask,
    onclose,
    homeworkOnly = false,
  }: {
    fen: string;
    /** Bank puzzles this class has had (not given again). */
    used: Set<string>;
    /** `homework`: the due time, when it is set as homework instead of asked now. */
    onask: (task: { kind: TaskKind; title: string; seconds: number; points: number; minus: number; tries: number; items: Item[]; homework?: number }) => void;
    onclose: () => void;
    /** Outside a live class: only homework (and no question from the board). */
    homeworkOnly?: boolean;
  } = $props();
  // svelte-ignore state_referenced_locally
  let when = $state<'now' | 'homework'>(homeworkOnly ? 'homework' : 'now');
  /** Due by default in a week, at 8 pm. */
  const inAWeek = () => {
    const d = new Date(Date.now() + 7 * 86_400_000);
    d.setHours(20, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  let due = $state(inAWeek());

  // svelte-ignore state_referenced_locally
  let mode = $state<TaskKind>(homeworkOnly ? 'set' : 'best');
  let title = $state('');
  let seconds = $state(120);
  let points = $state(5);
  let minus = $state(0);
  let tries = $state(1);
  // Best move
  let source = $state<'engine' | 'mine'>('engine');
  let pv = $state<string[]>([]);
  let evalText = $state('');
  let thinking = $state(false);
  let plies = $state(1);
  let mine = $state<string[]>([]);
  // Against the computer
  let goal = $state<'mate' | 'win' | 'draw'>('win');
  let elo = $state(1500);
  // A puzzle set
  let theme = $state('mateIn2');
  let from = $state(1000);
  let to = $state(1400);
  let count = $state(5);
  let busy = $state(false);
  let error = $state('');
  // A puzzle PDF read on this computer (PdfImport, loaded only when used).
  let pdf = $state(false);
  let importing = $state(false);
  let pdfItems = $state<Item[]>([]);

  const TIMES: [number, string][] = [
    [30, '30 s'],
    [60, '1 min'],
    [120, '2 min'],
    [180, '3 min'],
    [300, '5 min'],
    [600, '10 min'],
    [0, 'No limit'],
  ];

  const legal = $derived.by(() => {
    try {
      const pos = positionFromFen(fen);
      return pos.isEnd() ? undefined : pos;
    } catch {
      return undefined;
    }
  });
  const side = $derived(sideOf(fen));

  onMount(() => {
    if (!legal || homeworkOnly) return;
    thinking = true;
    void engine.evaluate(fen, 18, 1, 4000).then((info) => {
      thinking = false;
      if (!info) return;
      pv = info.pv.slice(0, 9);
      evalText = evalLabel(info);
      // A mate: the whole mating line is the answer (any checkmating move counts at the end anyway).
      if (info.mate !== undefined && info.mate > 0 === (side === 'white')) plies = Math.min(pv.length, Math.abs(info.mate) * 2 - 1);
    });
    return () => engine.stopAnalysis();
  });

  /** The answer the coach plays in: from the position, both sides. */
  const rec = $derived.by(() => {
    if (!legal) return undefined;
    const pos = legal.clone();
    let last: Key[] | undefined;
    for (const u of mine) {
      const m = parseUci(u) as NormalMove | undefined;
      if (!m || !pos.isLegal(m)) break;
      pos.play(m);
      last = [keyOf(m.from), keyOf(m.to)];
    }
    return { pos, fen: makeFen(pos.toSetup()), last };
  });
  async function recMove(orig: Key, dest: Key) {
    if (!rec) return;
    const role = await promotionFor(rec.pos, orig, dest);
    if (role === null) return;
    mine = [...mine, makeUci(moveFromKeys(rec.pos, orig, dest, role ?? undefined))];
  }

  const answer = $derived(source === 'engine' ? pv.slice(0, plies) : mine);
  const defaultTitle = $derived(pdf ? `${pdfItems.length || ''} puzzles from the PDF`.trim() : mode === 'play' ? (goal === 'draw' ? 'Hold the draw against the computer' : goal === 'mate' ? 'Checkmate the computer' : 'Win this position against the computer') : mode === 'set' ? `${count} puzzles: ${THEMES.find((t) => t.id === theme)?.label ?? ''}` : 'What is the best move?');

  async function ask() {
    error = '';
    let items: Item[] = [];
    if (pdf) {
      if (!pdfItems.length) return void (error = 'Choose a PDF first.');
      items = pdfItems;
    } else if (mode === 'set') {
      busy = true;
      try {
        items = await puzzleSet(theme, Math.min(from, to), Math.max(from, to), count, used);
      } catch (e) {
        error = (e as Error).message;
      } finally {
        busy = false;
      }
      if (!items.length) {
        error ||= 'No puzzles found for that choice.';
        return;
      }
    } else {
      if (!legal) return void (error = 'This position cannot be played: check the kings and whose move it is.');
      if (mode === 'best' && !answer.length) return void (error = source === 'engine' ? 'The engine is still thinking. A moment…' : 'Play the answer on the small board first.');
      items = [{ fen, line: mode === 'best' ? answer : [], goal: mode === 'play' ? goal : '', elo, title: '', ref: '', rating: 0 }];
    }
    const dueAt = new Date(due).getTime();
    if (when === 'homework' && !(dueAt > Date.now())) return void (error = 'Pick a due date in the future.');
    onask({ kind: mode, title: title.trim() || defaultTitle, seconds: when === 'homework' ? 0 : seconds, points, minus, tries, items, homework: when === 'homework' ? dueAt : undefined });
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !importing && onclose()} />
{#if importing}
  {#await import('./PdfImport.svelte') then m}
    <m.default
      onitems={(items: Item[]) => {
        pdfItems = items;
        importing = false;
        if (!items.length) pdf = false;
      }}
      onclose={() => {
        importing = false;
        if (!pdfItems.length) pdf = false;
      }}
    />
  {/await}
{/if}
<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Ask a question">
  <header>
    <h2>Ask a question</h2>
    <button class="btn ghost" onclick={onclose} aria-label="Close">✕</button>
  </header>
  <div class="chips" role="group" aria-label="Kind">
    {#if !homeworkOnly}
      <button class="chip" class:on={mode === 'best'} onclick={() => ((mode = 'best'), (pdf = false))}>Best move</button>
      <button class="chip" class:on={mode === 'play'} onclick={() => ((mode = 'play'), (pdf = false))}>Play it out vs computer</button>
    {/if}
    <button class="chip" class:on={mode === 'set' && !pdf} onclick={() => ((mode = 'set'), (pdf = false))}>Puzzle set</button>
    <button class="chip" class:on={pdf} onclick={() => ((mode = 'set'), (pdf = true), !pdfItems.length && (importing = true))}>📄 From a PDF</button>
  </div>

  <div class="body">
    {#if mode !== 'set' && !pdf}
      <div class="left">
        {#if mode === 'best' && source === 'mine' && rec}
          <Board fen={rec.fen} orientation={side} turnColor={rec.pos.turn} movable={rec.pos.turn} dests={destsOf(rec.pos)} lastMove={rec.last} onmove={recMove} label="Play the answer" />
        {:else}
          <Board {fen} orientation={side} viewOnly label="The position" />
        {/if}
        {#if !legal}<p class="err">This position cannot be played: check the kings and whose move it is.</p>{/if}
      </div>
    {/if}
    <div class="right">
      {#if mode === 'best'}
        <div class="field" role="group" aria-label="The answer">
          <span>The answer</span>
          <div class="chips">
            <button class="chip" class:on={source === 'engine'} onclick={() => (source = 'engine')}>The engine's</button>
            <button class="chip" class:on={source === 'mine'} onclick={() => (source = 'mine')}>I'll play it in</button>
          </div>
        </div>
        {#if source === 'engine'}
          <p class="line">
            {#if thinking}Thinking…{:else if pv.length}<b>{sanLine(fen, pv.slice(0, plies))}</b> <span class="muted">({evalText})</span>{:else}—{/if}
          </p>
          {#if pv.length > 1}
            <label class="field inline">
              <span>Moves to find</span>
              <select bind:value={plies}>
                {#each [1, 3, 5, 7, 9].filter((n) => n <= pv.length) as n (n)}<option value={n}>{n === 1 ? 'Just the first move' : `${(n + 1) / 2} moves (with the replies)`}</option>{/each}
              </select>
            </label>
          {/if}
        {:else}
          <p class="line">{mine.length ? sanLine(fen, mine) : 'Play the answer on the board: your move, then the reply, and so on.'}</p>
          <div class="chips">
            <button class="btn" onclick={() => (mine = mine.slice(0, -1))} disabled={!mine.length}>Undo</button>
            <button class="btn ghost" onclick={() => (mine = [])} disabled={!mine.length}>Clear</button>
          </div>
        {/if}
        <p class="muted small">Any move that gives checkmate also counts.</p>
      {:else if mode === 'play'}
        <div class="field" role="group" aria-label="Goal">
          <span>Goal</span>
          <div class="chips">
            <button class="chip" class:on={goal === 'win'} onclick={() => (goal = 'win')}>Win</button>
            <button class="chip" class:on={goal === 'mate'} onclick={() => (goal = 'mate')}>Checkmate</button>
            <button class="chip" class:on={goal === 'draw'} onclick={() => (goal = 'draw')}>Hold the draw</button>
          </div>
        </div>
        <p class="muted small">{goal === 'win' ? 'Won when they checkmate, or when the computer gives up a lost position.' : goal === 'mate' ? 'Won only by checkmate.' : 'Held when the game is drawn or they survive 20 moves.'}</p>
        <label class="field inline">
          <span>Computer strength</span>
          <select bind:value={elo}>
            {#each [[800, 'Beginner (800)'], [1200, 'Club (1200)'], [1500, 'Strong club (1500)'], [1800, 'Expert (1800)'], [2200, 'Master (2200)'], [2800, 'Full strength']] as [v, l] (v)}<option value={v}>{l}</option>{/each}
          </select>
        </label>
      {:else if pdf}
        <div class="field">
          <span>From your PDF</span>
          {#if pdfItems.length}
            <b class="line">{pdfItems.length} {pdfItems.length === 1 ? 'position' : 'positions'} ready, answers found by the engine</b>
            <div class="chips"><button class="btn" onclick={() => (importing = true)}>Choose another PDF</button></div>
          {:else}
            <div class="chips"><button class="btn primary" onclick={() => (importing = true)}>📄 Choose a puzzle PDF</button></div>
          {/if}
        </div>
        <p class="muted small">The PDF is read on this computer (never uploaded). You check the pieces once, fix any diagram, and the engine finds each answer.</p>
      {:else}
        <label class="field inline">
          <span>Theme</span>
          <select bind:value={theme}>
            {#each THEMES as t (t.id)}<option value={t.id}>{t.label}</option>{/each}
          </select>
        </label>
        <div class="two">
          <label class="field inline"><span>Rating from</span><input type="number" min="400" max="2800" step="100" bind:value={from} /></label>
          <label class="field inline"><span>to</span><input type="number" min="400" max="3000" step="100" bind:value={to} /></label>
        </div>
        <label class="field inline">
          <span>How many</span>
          <select bind:value={count}>
            {#each [3, 5, 8, 10, 15] as n (n)}<option value={n}>{n} puzzles</option>{/each}
          </select>
        </label>
        <p class="muted small">Each student goes through them in order, easiest first; the leaderboard counts points, then time.</p>
      {/if}

      <hr />
      <label class="field inline"><span>Title</span><input type="text" maxlength="80" placeholder={defaultTitle} bind:value={title} /></label>
      {#if !homeworkOnly}
        <div class="field" role="group" aria-label="When">
          <span>When</span>
          <div class="chips">
            <button class="chip" class:on={when === 'now'} onclick={() => (when = 'now')}>Now, in class</button>
            <button class="chip" class:on={when === 'homework'} onclick={() => (when = 'homework')}>Homework</button>
          </div>
        </div>
      {/if}
      {#if when === 'homework'}
        <label class="field inline"><span>Due</span><input type="datetime-local" bind:value={due} /></label>
      {:else}
      <div class="field" role="group" aria-label="Time">
        <span>Time {mode === 'set' ? 'for the whole set' : ''}</span>
        <div class="chips">
          {#each TIMES as [v, l] (v)}<button class="chip" class:on={seconds === v} onclick={() => (seconds = v)}>{l}</button>{/each}
        </div>
      </div>
      {/if}
      <div class="three">
        <label class="field inline"><span>Points</span><input type="number" min="0" max="100" bind:value={points} /></label>
        <label class="field inline"><span>Minus a miss</span><input type="number" min="0" max="100" bind:value={minus} /></label>
        <label class="field inline"><span>Tries</span><input type="number" min="1" max="10" bind:value={tries} /></label>
      </div>
      {#if error}<p class="err">{error}</p>{/if}
      <div class="go">
        <button class="btn ghost" onclick={onclose}>Cancel</button>
        <button class="btn primary big" onclick={ask} disabled={busy || (mode !== 'set' && !legal)}>{busy ? 'Loading…' : when === 'homework' ? 'Set the homework' : 'Ask the class'}</button>
      </div>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(5, 10, 20, 0.55);
  }
  .dialog {
    position: fixed;
    z-index: 81;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(940px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-panel);
    padding: 16px 18px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font: 700 22px var(--font-title);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .body {
    display: grid;
    grid-template-columns: minmax(0, 340px) 1fr;
    gap: 18px;
  }
  @media (max-width: 720px) {
    .body {
      grid-template-columns: 1fr;
    }
  }
  .right {
    display: flex;
    flex-direction: column;
    gap: 10px;
    grid-column: span 1;
  }
  .body:has(.right:only-child) {
    grid-template-columns: 1fr;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: var(--muted);
  }
  .field.inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .field input,
  .field select {
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 8px;
    font: 600 14px var(--font-body);
    min-width: 0;
  }
  .field input[type='text'] {
    flex: 1;
  }
  .field input[type='number'] {
    width: 80px;
  }
  .two,
  .three {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .three {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .line {
    margin: 0;
    font-size: 16px;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
    margin: 0;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--border);
    width: 100%;
    margin: 4px 0;
  }
  .err {
    color: var(--loss);
    margin: 0;
  }
  .go {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>

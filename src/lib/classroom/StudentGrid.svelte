<script lang="ts">
  /**
   * The coach's view while a question runs: every student's board live (green: solved, red: a miss), the class's
   * first moves on each puzzle (what the class thought, right and wrong), and one student's tries in full. From here
   * the coach sends one student a hint, a 👏, or puts their answer on the big board for everyone.
   */
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { parseUci } from 'chessops/util';
  import { makeFen } from 'chessops/fen';
  import ClassBoard from './ClassBoard.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import { clock, sanLine, sideOf, took, topMoves } from './tasks';
  import type { Live } from './live.svelte';
  import type { Progress } from './api';
  import { keyOf, positionFromFen } from '$lib/chess/position';

  let { live, onspotlight }: { live: Live; onspotlight: () => void } = $props();

  const task = $derived(live.task!);
  const left = $derived(task.ends ? task.ends - live.now : Infinity);
  let filter = $state<'all' | 'solving' | 'solved' | 'missed'>('all');
  let picked = $state<string | undefined>();
  let itemPick = $state<number | undefined>();
  let tab = $state<'boards' | 'board-lb'>('boards');

  const students = $derived(
    Object.values(live.progress)
      .filter((p) => p.uid !== live.me.uid)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  /** Green: the last puzzle solved; red: a miss (on this puzzle or the last); else still thinking. */
  const status = (p: Progress): 'solved' | 'missed' | 'solving' | 'idle' => {
    const last = p.results[p.results.length - 1];
    if (p.done) return last?.solved ? 'solved' : 'missed';
    if (p.wrong > 0) return 'missed';
    if (!p.moves.length && last) return last.solved ? 'solved' : 'missed';
    return p.moves.length ? 'solving' : 'idle';
  };
  const shownList = $derived(
    students.filter((p) => {
      if (filter === 'all') return true;
      const s = status(p);
      return filter === 'solving' ? s === 'solving' || s === 'idle' : s === filter;
    }),
  );
  const counts = $derived({
    done: students.filter((p) => p.done).length,
    solved: students.reduce((n, p) => n + p.results.filter((r) => r.solved).length, 0),
  });

  function position(fen: string, moves: string[]) {
    try {
      const pos = positionFromFen(fen);
      let last: Key[] | undefined;
      for (const u of moves) {
        const m = parseUci(u) as NormalMove | undefined;
        if (!m || !pos.isLegal(m)) break;
        pos.play(m);
        last = [keyOf(m.from), keyOf(m.to)];
      }
      return { fen: makeFen(pos.toSetup()), last };
    } catch {
      return { fen, last: undefined };
    }
  }
  /** What a student's board shows now: the puzzle they are on, or how the last one ended. */
  function now(p: Progress) {
    if (!p.done && (p.moves.length || !p.results.length)) {
      const it = task.items[p.item];
      return { ...position(it.fen, p.moves), side: sideOf(it.fen) };
    }
    const i = p.results.length - 1;
    const it = task.items[Math.max(0, i)];
    const r = p.results[i];
    const moves = r ? (r.solved ? r.moves : (r.tried[r.tried.length - 1] ?? r.moves)) : [];
    return { ...position(it.fen, moves), side: sideOf(it.fen) };
  }

  /** The puzzle most of the class is on (or the one the coach picked), for the first-moves chart. */
  const chartItem = $derived.by(() => {
    if (itemPick !== undefined) return itemPick;
    const n = new Map<number, number>();
    for (const p of students) n.set(Math.min(p.item, task.items.length - 1), (n.get(Math.min(p.item, task.items.length - 1)) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  });
  const tops = $derived(topMoves(students, chartItem, task.items[chartItem]?.fen ?? '').filter((t) => t.san));
  const topMax = $derived(Math.max(1, ...tops.map((t) => t.n)));

  const sel = $derived(picked ? live.progress[picked] : undefined);
  /** After "find the move": the same position played to the end against the computer, to win (coach's request). */
  function playOn() {
    const it = task.items[0];
    live.ask({ kind: 'play', title: 'Now play it out and win', seconds: Math.max(600, task.seconds), points: task.points * 2, minus: 0, tries: 1, items: [{ ...it, line: [], goal: 'win', elo: 1500 }] });
  }
  function spotlight(p: Progress, item: number, moves: string[]) {
    if (live.watching) return;
    const it = task.items[item];
    live.setBoard({ ...live.board, root: it.fen, moves, ply: moves.length, orient: sideOf(it.fen), shapes: [], marks: {}, title: `${p.name}'s answer`, game: -1 });
    onspotlight();
  }
</script>

<section class="grid-view">
  <header>
    <div class="title">
      <b>{task.title}</b>
      <span class="muted">{task.items.length} {task.items.length === 1 ? 'puzzle' : 'puzzles'} · {task.points} pts{task.minus ? `, −${task.minus} a miss` : ''} · {task.tries} {task.tries === 1 ? 'try' : 'tries'}</span>
    </div>
    <div class="actions">
      {#if task.ends}<span class="timer num" class:low={!task.over && left < 15_000}>{task.over ? 'Over' : clock(left)}</span>{/if}
      <span class="pill">{counts.done}/{students.length} finished</span>
      {#if !live.watching}
        {#if !task.over}<button class="btn" onclick={() => live.endTask()}>End now</button>{/if}
        {#if !task.reveal}<button class="btn" onclick={() => live.reveal()}>Show answers</button>{/if}
        {#if task.kind === 'best' && task.items.length === 1}<button class="btn primary" onclick={playOn} title="Every student plays this position to the end against the computer: scored and on the leaderboard">▶ Now play it out from here</button>{/if}
        <button class="btn ghost" onclick={() => live.closeTask()} title="Back to the class board">Close question</button>
      {/if}
    </div>
  </header>

  <div class="bar">
    <div class="chips" role="group" aria-label="Show">
      {#each [['all', 'All'], ['solving', 'Solving'], ['solved', 'Solved'], ['missed', 'Missed']] as [k, l] (k)}
        <button class="chip" class:on={filter === k} onclick={() => (filter = k as typeof filter)}>{l}</button>
      {/each}
    </div>
    <div class="chips" role="group" aria-label="View">
      <button class="chip" class:on={tab === 'boards'} onclick={() => (tab = 'boards')}>Boards</button>
      <button class="chip" class:on={tab === 'board-lb'} onclick={() => (tab = 'board-lb')}>Leaderboard</button>
    </div>
  </div>

  {#if tab === 'board-lb'}
    <Leaderboard rows={live.lb} total={task.items.length} />
  {:else}
    {#if tops.length}
      <div class="tops">
        <span class="muted">First moves{task.items.length > 1 ? ` on puzzle ${chartItem + 1}` : ''}:</span>
        {#if task.items.length > 1}
          <select bind:value={itemPick} aria-label="Puzzle">
            <option value={undefined}>Most of the class</option>
            {#each task.items as _, i (i)}<option value={i}>Puzzle {i + 1}</option>{/each}
          </select>
        {/if}
        <div class="bars">
          {#each tops as t (t.uci)}
            <div class="tbar" title="{t.n} played {t.san}">
              <span class="san" class:ok={t.right} class:bad={!t.right}>{t.san}</span>
              <span class="fill" class:ok={t.right} style="width: {(t.n / topMax) * 100}%"></span>
              <span class="n num">{t.n}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if !students.length}
      <p class="muted">No student is in the class yet. Their boards show here as they answer.</p>
    {/if}
    <div class="boards">
      {#each shownList as p (p.uid)}
        {@const st = status(p)}
        {@const b = now(p)}
        <button class="sb {st}" class:sel={picked === p.uid} onclick={() => (picked = picked === p.uid ? undefined : p.uid)}>
          <span class="who"><span class="dot" class:on={live.people.some((x) => x.uid === p.uid && x.online)}></span>{p.name}</span>
          <ClassBoard fen={b.fen} lastMove={b.last} orientation={b.side} coordinates={false} label="{p.name}'s board" />
          <span class="info num">
            <span>{p.done ? `Done · ${p.results.filter((r) => r.solved).length}/${task.items.length}` : task.items.length > 1 ? `Puzzle ${p.item + 1}/${task.items.length}` : st === 'idle' ? 'Thinking…' : 'Solving'}</span>
            <span>{p.points} pts</span>
          </span>
          <span class="info small">
            {#if p.away}<span class="away" title="Left the class tab during this question (another tab or app)">👀 {p.away}× · {took(p.awayMs ?? 0)}</span>{/if}
            {#if p.wrong}<span class="bad">✗ {p.wrong}</span>{/if}
            <span>{p.done ? took(p.results.reduce((n, r) => n + r.ms, 0)) : took(live.now - p.itemStart)}</span>
          </span>
        </button>
      {/each}
    </div>

    {#if sel}
      <div class="detail card">
        <header>
          <b>{sel.name}</b>
          {#if !live.watching}
            <div class="actions">
              {#if !sel.done && !task.over && task.kind !== 'play'}<button class="btn" onclick={() => live.sendHint(sel.uid)} title="The piece to move lights up on this student's board only">💡 Hint</button>{/if}
              <button class="btn" onclick={() => live.react('👏', 'Well done', sel.uid)}>👏</button>
              <button class="btn" onclick={() => live.react('⭐', 'Superstar', sel.uid)}>⭐</button>
            </div>
          {/if}
        </header>
        {#each task.items as it, i (i)}
          {@const r = sel.results[i]}
          {@const tries = r ? r.tried : sel.item === i ? sel.tried : []}
          {#if r || sel.item === i}
            <div class="att">
              <span class="label">Puzzle {i + 1}{r ? ` · ${took(r.ms)}` : ''}</span>
              {#each tries as t, k (k)}
                <button class="line bad" onclick={() => spotlight(sel, i, t)} title="Show this try on the big board">✗ {sanLine(it.fen, t)}</button>
              {/each}
              {#if r}
                <button class="line" class:ok={r.solved} class:bad={!r.solved} onclick={() => spotlight(sel, i, r.moves)} title="Show on the big board">{r.solved ? '✓' : '✗'} {sanLine(it.fen, r.moves) || '(no move)'}</button>
              {:else if sel.moves.length}
                <button class="line" onclick={() => spotlight(sel, i, sel.moves)}>… {sanLine(it.fen, sel.moves)}</button>
              {/if}
            </div>
          {/if}
        {/each}
        <p class="muted small">Tap a line to put it on the big board for the whole class.</p>
      </div>
    {/if}
  {/if}
</section>

<style>
  .grid-view {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .title {
    display: flex;
    flex-direction: column;
  }
  .title b {
    font: 700 20px var(--font-title);
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
  }
  .small {
    font-size: 12px;
  }
  .actions {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .timer {
    font: 800 24px var(--font-title);
    color: var(--live);
  }
  .timer.low {
    color: var(--loss);
  }
  .bar {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tops {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;
  }
  .tops select {
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 3px 6px;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
  }
  .tbar {
    display: grid;
    grid-template-columns: 70px 1fr 28px;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .tbar .san {
    font-weight: 700;
  }
  .fill {
    height: 12px;
    border-radius: 6px;
    background: var(--loss);
    opacity: 0.8;
  }
  .fill.ok {
    background: var(--win);
  }
  .ok {
    color: var(--win);
  }
  .bad {
    color: var(--loss);
  }
  .boards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
  }
  .sb {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border-radius: 12px;
    background: var(--card);
    border: 2px solid var(--border);
    color: var(--text);
    cursor: pointer;
    text-align: left;
    font: 600 13px var(--font-body);
    min-width: 0;
  }
  .sb.solved {
    border-color: var(--win);
    background: color-mix(in srgb, var(--win) 10%, var(--card));
  }
  .sb.missed {
    border-color: var(--loss);
    background: color-mix(in srgb, var(--loss) 10%, var(--card));
  }
  .sb.sel {
    box-shadow: 0 0 0 3px var(--live);
  }
  .sb :global(.board) {
    pointer-events: none;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    flex: none;
  }
  .dot.on {
    background: var(--win);
  }
  .info {
    display: flex;
    justify-content: space-between;
    gap: 4px;
  }
  .away {
    color: var(--engine);
    font-weight: 700;
  }
  .detail {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .att {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .label {
    font-size: 12px;
    color: var(--muted);
  }
  .line {
    text-align: left;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px 8px;
    color: var(--text);
    cursor: pointer;
    font: 600 13px var(--font-body);
  }
  .line.ok {
    color: var(--win);
  }
  .line.bad {
    color: var(--loss);
  }
</style>

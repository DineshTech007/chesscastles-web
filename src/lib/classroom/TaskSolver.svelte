<script lang="ts">
  /**
   * A student answering the coach's question on their own board. The room checks every move (the answers never reach
   * the student's device before the coach shows them): the opponent's reply comes back with a right move, a wrong one
   * costs a try. Against the computer, the engine on the student's device plays the other side. When the time is up
   * the board freezes.
   */
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { makeUci, parseUci } from 'chessops/util';
  import { makeFen } from 'chessops/fen';
  import ClassBoard from './ClassBoard.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import { clock, sanLine, sideOf, took } from './tasks';
  import type { SolverHost } from './solver';
  import { destsOf, keyOf, moveFromKeys, positionFromFen } from '$lib/chess/position';
  import { promotionFor } from '$lib/chess/promotion';
  import { engine } from '$lib/engine/stockfish';
  import { playMoveSound, sounds } from '$lib/sound';
  import { puzzleSounds } from '$lib/puzzles/puzzleSounds';
  import Fireworks from '$lib/components/Fireworks.svelte';
  import { t, type Key as WordKey } from '$lib/i18n';

  // The live class or homework at home: the same board (solver.ts).
  let { host: live }: { host: SolverHost } = $props();

  const task = $derived(live.task!);
  const p = $derived(live.mine);
  const idx = $derived(p ? Math.min(p.item, task.items.length - 1) : 0);
  const item = $derived(task.items[idx]);
  const side = $derived(sideOf(item.fen));
  const left = $derived(task.ends ? task.ends - live.now : Infinity);
  const frozen = $derived(task.over || left <= 0);
  const done = $derived(!!p?.done);

  /** A move sent, waiting for the room's answer. */
  let pending = $state<string | undefined>();
  /** A moment to see what happened: the solved position, or the wrong move. */
  let flash = $state<{ fen: string; moves: string[]; kind: 'solved' | 'wrong' | 'failed'; text: string; until: number; item: number } | undefined>();
  /** The opponent's reply is shown a moment after the student's move. */
  let holdReply = $state(0);
  let remount = $state(0);
  let party = $state(0);
  let wrap = $state<HTMLDivElement>();
  // Each new puzzle: its board fully in view (on a phone the page may have scrolled, hiding the top ranks).
  let shownItem = -1;
  $effect(() => {
    const i = idx;
    if (i === shownItem || !wrap) return;
    shownItem = i;
    const r = wrap.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) wrap.scrollIntoView({ block: r.height > innerHeight ? 'start' : 'nearest', behavior: 'smooth' });
  });
  let seen = 0;
  /** The words in the player's language (inside the effect below, `t` is the room's answer). */
  const say = (k: WordKey, v?: Record<string, string | number>) => $t(k, v);

  $effect(() => {
    const t = live.tried;
    if (!t || t.at <= seen) return;
    seen = t.at;
    pending = undefined;
    const it = task.items[t.ended ? t.p.item - 1 : t.p.item] ?? item;
    const r = t.ended ? t.p.results[t.p.results.length - 1] : undefined;
    if (t.ended === 'solved') {
      puzzleSounds.solved();
      flash = { fen: it.fen, moves: r?.moves ?? [], kind: 'solved', text: say('kidsclass.ts.solved', { n: task.points }), until: Date.now() + 1300, item: t.p.item - 1 };
      if (t.p.done) party++;
    } else if (t.ended === 'failed') {
      sounds.error();
      const last = r?.tried[r.tried.length - 1] ?? [];
      flash = { fen: it.fen, moves: last, kind: 'failed', text: task.kind === 'play' ? say('kidsclass.ts.lost') : say('kidsclass.ts.missed'), until: Date.now() + 1500, item: t.p.item - 1 };
    } else if (t.again) {
      sounds.error();
      const last = t.p.tried[t.p.tried.length - 1] ?? [];
      const tries = task.tries - t.p.wrong;
      flash = { fen: it.fen, moves: last, kind: 'wrong', text: say(tries === 1 ? 'kidsclass.ts.wrong1' : 'kidsclass.ts.wrong', { n: tries, extra: task.minus ? ` (−${task.minus})` : '' }), until: Date.now() + 1200, item: t.p.item };
    } else if (t.reply) holdReply = Date.now() + 380;
  });
  // The flash and the held reply end by themselves.
  $effect(() => {
    if (flash && live.now > flash.until) flash = undefined;
    if (holdReply && live.now > holdReply) holdReply = 0;
  });

  const moves = $derived.by(() => {
    if (!p) return [];
    const m = holdReply ? p.moves.slice(0, -1) : p.moves;
    return pending ? [...m, pending] : m;
  });
  const shown = $derived.by(() => {
    const src = flash ?? { fen: item.fen, moves };
    try {
      const pos = positionFromFen(src.fen);
      let last: Key[] | undefined;
      for (const u of src.moves) {
        const m = parseUci(u) as NormalMove | undefined;
        if (!m || !pos.isLegal(m)) break;
        pos.play(m);
        last = [keyOf(m.from), keyOf(m.to)];
      }
      return { pos, fen: makeFen(pos.toSetup()), last };
    } catch {
      return undefined;
    }
  });
  const myTurn = $derived(!!shown && !flash && !pending && !frozen && !done && shown.pos.turn === side && !shown.pos.isEnd());

  async function onmove(orig: Key, dest: Key) {
    // No progress yet (homework before the first answer): the first puzzle.
    if (!shown || !myTurn) return;
    const pos = shown.pos;
    const role = await promotionFor(pos, orig, dest);
    if (role === null) return void remount++;
    const m = moveFromKeys(pos, orig, dest, role ?? undefined);
    playMoveSound(pos, m, false);
    pending = makeUci(m);
    live.tryMove(p?.item ?? 0, pending);
  }

  // Against the computer: the engine on this device plays the other side (and gives up a lost position).
  let thinking = '';
  $effect(() => {
    if (task.kind !== 'play' || !p || !shown || flash || pending || frozen || done) return;
    const pos = shown.pos;
    if (pos.turn === side || pos.isEnd()) return;
    const key = `${task.id}:${p.item}:${p.wrong}:${p.moves.length}`;
    if (thinking === key) return;
    thinking = key;
    const fen = shown.fen;
    const it = item;
    void (async () => {
      if (it.goal === 'draw' && p.moves.length >= 40) return live.claim(p.item, 'draw');
      // A clearly won position after the student's eighth move: the computer gives up (the room checks the count).
      if (it.goal === 'win' && p.moves.length >= 15) {
        const e = await engine.evaluate(fen, 12);
        if (thinking !== key) return;
        const mine = side === 'white' ? 1 : -1;
        if (e && ((e.mate !== undefined && e.mate * mine > 0) || (e.cp !== undefined && e.cp * mine >= 700))) {
          live.notice = $t('kidsclass.ts.gaveUp');
          return live.claim(p.item, 'win');
        }
      }
      const uci = await engine.play(fen, it.elo, 700);
      if (thinking !== key || !uci) return;
      live.tryMove(p.item, uci, true);
    })();
  });

  const hint = $derived(live.hint && live.hint.task === task.id && live.hint.item === idx && !flash ? [{ orig: live.hint.square as Key, brush: 'yellow' }] : []);
  const results = $derived(p?.results ?? []);
  const solved = $derived(results.filter((r) => r.solved).length);
  const triesLeft = $derived(p ? task.tries - p.wrong : task.tries);
  /** After the coach shows the answers: one to look at on the board. */
  let review = $state<number | undefined>();
  const reviewPos = $derived.by(() => {
    if (review === undefined || !task.reveal) return undefined;
    const it = task.items[review];
    return it ? { fen: it.fen, line: it.line } : undefined;
  });
  let reviewPly = $state(0);
  const reviewShown = $derived.by(() => {
    if (!reviewPos) return undefined;
    const pos = positionFromFen(reviewPos.fen);
    let last: Key[] | undefined;
    for (const u of reviewPos.line.slice(0, reviewPly)) {
      const m = parseUci(u) as NormalMove | undefined;
      if (!m || !pos.isLegal(m)) break;
      pos.play(m);
      last = [keyOf(m.from), keyOf(m.to)];
    }
    return { fen: makeFen(pos.toSetup()), last };
  });
</script>

<section class="solver" class:frozen>
  <header>
    <div class="q">
      <b>{item.title || task.title}</b>
      <span class="muted"
        >{task.items.length > 1 ? `${$t('kidsclass.ts.puzzleOf', { i: Math.min((flash?.item ?? idx) + 1, task.items.length), n: task.items.length })} · ` : ''}{side === 'white' ? $t('kidsclass.ts.whiteToPlay') : $t('kidsclass.ts.blackToPlay')}{task.kind === 'play'
          ? ` · ${item.goal === 'draw' ? $t('kidsclass.ts.goalDraw') : item.goal === 'win' ? $t('kidsclass.ts.goalWin') : $t('kidsclass.ts.goalMate')}`
          : ''}</span
      >
    </div>
    <div class="meta">
      {#if task.ends}<span class="timer num" class:low={left < 15_000}>{frozen ? '0:00' : clock(left)}</span>{/if}
      <span class="pill num">{p?.points ?? 0} pts</span>
      {#if !done && !frozen}<span class="pill">{triesLeft === 1 ? $t('kidsclass.ts.try1') : $t('kidsclass.ts.tries', { n: triesLeft })}</span>{/if}
    </div>
  </header>

  {#if reviewShown}
    <ClassBoard fen={reviewShown.fen} lastMove={reviewShown.last} orientation={sideOf(reviewPos!.fen)} label={$t('kidsclass.ts.answer')} />
    <div class="row">
      <button class="btn ghost" onclick={() => (reviewPly = Math.max(0, reviewPly - 1))} disabled={reviewPly === 0}>◀</button>
      <span class="muted">{sanLine(reviewPos!.fen, reviewPos!.line.slice(0, reviewPly)) || 'The position'}</span>
      <button class="btn ghost" onclick={() => (reviewPly = Math.min(reviewPos!.line.length, reviewPly + 1))} disabled={reviewPly >= reviewPos!.line.length}>▶</button>
      <button class="btn" onclick={() => (review = undefined)}>{$t('kidsclass.ts.close')}</button>
    </div>
  {:else if shown}
    <div class="boardwrap" bind:this={wrap}>
      {#key remount}
        <ClassBoard fen={shown.fen} lastMove={shown.last} check={shown.pos.isCheck()} orientation={side} movable={myTurn ? side : undefined} dests={myTurn ? destsOf(shown.pos) : new Map()} autoShapes={hint as never} label={$t('kidsclass.ts.board')} {onmove} />
      {/key}
      {#if flash}
        <div class="flash {flash.kind}" role="status">{flash.kind === 'solved' ? '✓' : '✗'} {flash.text}</div>
      {:else if frozen && !done}
        <div class="flash failed" role="status">{$t('kidsclass.ts.timeUp')}</div>
      {/if}
    </div>
  {/if}

  {#if done || frozen}
    <div class="result card">
      <b>{task.ends && task.ends <= live.now && solved < task.items.length ? $t('kidsclass.ts.timeUpShort') : $t('kidsclass.ts.finished')}</b>
      <span>{$t('kidsclass.ts.summary', { s: solved, n: task.items.length, p: p?.points ?? 0, time: took(results.filter((r) => r.solved).reduce((n, r) => n + r.ms, 0)) })}</span>
      {#if !task.over && !live.homework}<span class="muted">{$t('kidsclass.ts.waitOthers')}</span>{/if}
    </div>
    {#if task.reveal}
      <div class="answers">
        <b>{$t('kidsclass.ts.answers')}</b>
        {#each task.items as it, i (i)}
          <button class="answer" onclick={() => ((review = i), (reviewPly = it.line.length))}>
            <span class:ok={results[i]?.solved} class:bad={results[i] && !results[i].solved}>{results[i]?.solved ? '✓' : results[i] ? '✗' : '·'}</span>
            {i + 1}. {sanLine(it.fen, it.line) || (it.goal ? $t('kidsclass.ts.playedOut') : '')}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
  {#if live.lb.length && (done || frozen || live.settings.lb)}
    <div class="lb">
      <b>Leaderboard</b>
      <Leaderboard rows={live.lb} me={live.me.uid} total={task.items.length} />
    </div>
  {/if}
</section>
{#key party}{#if party}<Fireworks rockets={5} />{/if}{/key}

<style>
  .solver {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .q {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .q b {
    font: 700 20px var(--font-title);
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
  }
  .meta {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .timer {
    font: 800 24px var(--font-title);
    color: var(--live);
    min-width: 64px;
    text-align: right;
  }
  .timer.low {
    color: var(--loss);
  }
  .boardwrap {
    position: relative;
  }
  .frozen .boardwrap {
    filter: grayscale(0.4);
  }
  .flash {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    padding: 12px 20px;
    border-radius: 14px;
    font: 800 22px var(--font-title);
    color: #fff;
    box-shadow: var(--shadow);
    animation: pop 0.25s ease-out;
    text-align: center;
  }
  .flash.solved {
    background: rgba(22, 163, 74, 0.92);
  }
  .flash.wrong,
  .flash.failed {
    background: rgba(220, 38, 38, 0.92);
  }
  @keyframes pop {
    from {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0;
    }
  }
  .result {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
  }
  .result b {
    font: 700 18px var(--font-title);
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .answers {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .answer {
    text-align: left;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    color: var(--text);
    cursor: pointer;
    font: 600 14px var(--font-body);
  }
  .answer .ok {
    color: var(--win);
  }
  .answer .bad {
    color: var(--loss);
  }
  .lb b {
    display: block;
    margin-bottom: 8px;
    font: 700 16px var(--font-title);
  }
</style>

<script lang="ts">
  import FeatureGate from '$lib/components/FeatureGate.svelte';
  import { tabRef } from '$lib/plans';
  import { onDestroy, onMount } from 'svelte';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { fenOf } from '$lib/chess/position';
  import { loadLibrary, type LibraryRow } from '$lib/coach/content/openings';
  import { POINTS, study } from '$lib/study/progress';
  import SquareGrid from '$lib/vision/SquareGrid.svelte';
  import { isRight, makeRound, WHAT_OPTIONS, type MemoryRound } from '$lib/vision/memory';
  import { loadVision, saveVision, type VisionRecord } from '$lib/vision/vision';

  let rec = $state<VisionRecord>({ rating: 1000, games: 0, solved: 0, bestSprint: 0, bestMemory: 0 });
  let lines: LibraryRow[] = [];
  let plies = $state(4);
  let streak = $state(0);
  let round = $state<MemoryRound | undefined>();
  /** How the moves are shown: all at once, or one at a time (harder). */
  let oneByOne = $state(false);
  let shownMoves = $state(0);
  let phase = $state<'moves' | 'question' | 'answered'>('moves');
  let answer = $state('');
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(async () => {
    rec = loadVision();
    try {
      plies = Math.max(4, Number(localStorage.getItem('k24.vision.memory')) || 4);
    } catch {
      /* default */
    }
    lines = (await loadLibrary()).filter((r) => r[2].split(' ').length >= 4);
    next();
  });
  onDestroy(() => clearInterval(timer));

  function next() {
    clearInterval(timer);
    const pool = lines.filter((r) => r[2].split(' ').length >= plies);
    let r: MemoryRound | undefined;
    for (let i = 0; i < 20 && !r; i++) {
      const row = pool[Math.floor(Math.random() * pool.length)];
      r = row ? makeRound(row[1], row[2], plies) : undefined;
    }
    round = r;
    answer = '';
    phase = 'moves';
    shownMoves = oneByOne ? 0 : plies;
    if (oneByOne) {
      timer = setInterval(() => {
        shownMoves++;
        if (shownMoves >= plies) clearInterval(timer);
      }, 1600);
    }
  }

  function ready() {
    clearInterval(timer);
    phase = 'question';
  }

  function respond(a: string) {
    if (!round || phase !== 'question') return;
    answer = a;
    phase = 'answered';
    const ok = isRight(round.question, a);
    if (ok) {
      rec = { ...rec, bestMemory: Math.max(rec.bestMemory, plies) };
      saveVision(rec);
      study.log('puzzle', POINTS.puzzleWithHint, `Move Memory ${plies}`);
      streak++;
      if (streak >= 2) {
        streak = 0;
        plies = Math.min(24, plies + 2);
      }
    } else {
      streak = 0;
      plies = Math.max(4, plies - 2);
    }
    try {
      localStorage.setItem('k24.vision.memory', String(plies));
    } catch {
      /* fine */
    }
  }

  /** "1. e4 e5 2. Nf3 Nc6" for the moves shown so far. */
  const moveText = $derived.by(() => {
    if (!round) return [];
    const out: string[] = [];
    round.sans.slice(0, shownMoves).forEach((s, i) => out.push(i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s));
    return out;
  });
  const right = $derived(round && phase === 'answered' ? isRight(round.question, answer) : false);
</script>

<svelte:head><title>Move Memory · Vision Gym · Chess Castles</title></svelte:head>

<FeatureGate feature="vision" ref={tabRef('memory')} back="/vision" backLabel="Vision Gym">
<div class="page">
  <a class="back" href="/vision"><Icon name="back" size={16} />Vision Gym</a>
  <header class="head">
    <div>
      <h1 class="display">Move Memory</h1>
      <p class="label">Follow a real opening in your head from the starting position, then answer a question about where the pieces are. Two right in a row: the line gets longer.</p>
    </div>
    <div class="stat card"><span class="label">Level · best</span><strong class="display num">{plies} · {rec.bestMemory}</strong><span class="label">half-moves</span></div>
  </header>

  {#if round}
    <div class="body">
      <section class="card main">
        <div class="seg-row">
          <div class="segmented" role="group" aria-label="How the moves are shown">
            <button aria-pressed={!oneByOne} onclick={() => ((oneByOne = false), next())}>All at once</button>
            <button aria-pressed={oneByOne} onclick={() => ((oneByOne = true), next())}>One at a time (harder)</button>
          </div>
        </div>
        <p class="label">From the starting position ({round.name}):</p>
        <p class="line num">{moveText.join(' ')}{#if oneByOne && shownMoves < plies}<span class="caret">…</span>{/if}</p>

        {#if phase === 'moves'}
          <button class="btn primary" onclick={ready} disabled={oneByOne && shownMoves < plies}>I have it in my head</button>
        {:else}
          <h2 class="title q">{round.question.text}</h2>
          {#if round.question.kind === 'what'}
            <div class="options">
              {#each WHAT_OPTIONS as o (o)}
                <button class="opt" class:picked={answer === o} class:ok={phase === 'answered' && o === round.question.answer} class:bad={phase === 'answered' && answer === o && o !== round.question.answer} disabled={phase === 'answered'} onclick={() => respond(o)}>{o}</button>
              {/each}
            </div>
          {:else}
            <p class="label">Tap the square on the empty board.</p>
          {/if}
          {#if phase === 'answered'}
            <div class="result" class:good={right}>
              <strong>{right ? 'Right!' : `Not quite: ${round.question.answer}.`}</strong>
              <button class="btn primary" onclick={next}>Next line</button>
            </div>
          {/if}
        {/if}
      </section>
      <section class="board-box">
        {#if phase === 'answered'}
          <Board fen={fenOf(round.final)} viewOnly label="The position after the moves" />
        {:else if round.question.kind === 'where' && phase === 'question'}
          <SquareGrid ontap={respond} />
        {:else}
          <div class="hidden card"><Icon name="search" size={40} color="var(--muted)" /><p class="label">No board: picture each move.</p></div>
        {/if}
      </section>
    </div>
  {:else}
    <div class="card skel"></div>
  {/if}
</div>
</FeatureGate>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 38px;
  }
  .head p {
    margin: 4px 0 0;
    max-width: 60ch;
  }
  .stat {
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    border-color: var(--gold);
  }
  .stat strong {
    font-size: 28px;
    color: var(--gold);
  }
  .body {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .main {
    flex: 1 1 420px;
    min-width: 0;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .main p {
    margin: 0;
  }
  .board-box {
    flex: 1 1 340px;
    max-width: 520px;
    min-width: 0;
  }
  .line {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.5;
    word-spacing: 4px;
  }
  .caret {
    color: var(--gold);
  }
  .q {
    margin: 4px 0 0;
    font-size: 21px;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 6px;
    width: 100%;
  }
  .opt {
    font: inherit;
    font-weight: 600;
    padding: 9px 6px;
    border-radius: 10px;
    border: 2px solid var(--border);
    background: var(--raised);
    color: inherit;
    cursor: pointer;
  }
  .opt.ok {
    border-color: var(--win);
  }
  .opt.bad {
    border-color: var(--loss);
  }
  .result {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--loss) 14%, transparent);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .result.good {
    background: color-mix(in srgb, var(--win) 16%, transparent);
  }
  .hidden {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 8px;
    text-align: center;
    background: repeating-conic-gradient(color-mix(in srgb, var(--raised) 70%, transparent) 0% 25%, transparent 0% 50%) 50% / 25% 25%;
  }
  .skel {
    height: 400px;
  }
</style>

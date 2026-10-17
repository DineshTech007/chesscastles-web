<script lang="ts">
  /**
   * Themed puzzles at the player's level (forks, pins, endgames…), from the
   * Lichess puzzle database (CC0). Each solved one counts for Guru's plan
   * ("Theme puzzle: <theme>").
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import { POINTS, study } from '$lib/study/progress';
  import { THEME_NAMES } from '$lib/insights/plan';
  import LimitReached from '$lib/components/LimitReached.svelte';
  import { PLAN_INFO, RANK, currentPlan, planSettings, requireGate, useFeature } from '$lib/plans';

  type P = [string, string, string, number];
  const THEMES = ['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mateIn1', 'mateIn2', 'backRankMate', 'sacrifice', 'defensiveMove', 'opening', 'middlegame', 'endgame', 'rookEndgame', 'pawnEndgame', 'crushing', 'short'];
  const KEY = 'k24.themePuzzles';

  /** Pawn's themes; every theme comes with the plan that has themed_puzzles (Bishop). */
  const BASIC = ['fork', 'pin', 'mateIn1', 'mateIn2'];
  const allThemes = $derived(RANK[$currentPlan] >= RANK[$planSettings.config.gates.themed_puzzles]);
  let theme = $state(page.url.searchParams.get('theme') ?? 'fork');
  let limited = $state(false);
  const goal = Number(page.url.searchParams.get('n')) || 0;
  let rating = $state(1200);
  let bank = $state<P[]>([]);
  let current = $state<P | undefined>();
  let round = $state(0);
  let solvedNow = $state(0);
  let result = $state<boolean | undefined>();
  let error = $state('');

  onMount(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (typeof s.rating === 'number') rating = s.rating;
    } catch {
      /* first visit */
    }
  });

  $effect(() => {
    const t = theme;
    bank = [];
    current = undefined;
    fetch(`/data/puzzles/${t}.json`)
      .then((r) => r.json())
      .then((list: P[]) => {
        if (theme !== t) return;
        bank = list;
        next();
      })
      .catch(() => (error = 'These puzzles could not be loaded.'));
  });

  async function next() {
    const near = bank.filter((p) => Math.abs(p[3] - rating) <= 150);
    const pool = near.length ? near : bank;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    // Each puzzle counts towards the plan's puzzles a day.
    if (!(await useFeature('puzzle', pick[0]))) return void (limited = true);
    current = pick;
    result = undefined;
    round++;
  }
  function pickTheme(t: string) {
    if (!BASIC.includes(t) && !requireGate('themed_puzzles')) return;
    theme = t;
  }

  function done(ok: boolean) {
    if (!current) return;
    result = ok;
    // The puzzle rating moves like Elo against the puzzle's own rating.
    const expected = 1 / (1 + 10 ** ((current[3] - rating) / 400));
    rating = Math.max(400, Math.round(rating + 24 * ((ok ? 1 : 0) - expected)));
    try {
      localStorage.setItem(KEY, JSON.stringify({ rating }));
    } catch {
      /* fine */
    }
    if (ok) {
      solvedNow++;
      study.log('puzzle', POINTS.puzzleSolved, `Theme puzzle: ${theme}`);
    }
  }
  const nameOf = (t: string) => THEME_NAMES[t] ?? t;
</script>

<svelte:head><title>{nameOf(theme)} puzzles · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/puzzles"><Icon name="back" size={16} />Puzzles</a>
  <header class="head">
    <div>
      <h1 class="display">Puzzles by theme</h1>
      <p class="label">Practise one pattern until it is automatic. Puzzles from the Lichess puzzle database, at your level.</p>
    </div>
    <div class="stat card"><span class="label">Your rating here</span><strong class="display num">{rating}</strong>{#if goal}<span class="label">{Math.min(solvedNow, goal)} of {goal} for your plan</span>{/if}</div>
  </header>

  <div class="chips" role="group" aria-label="Theme">
    {#each THEMES as t (t)}
      <button class="chip" aria-pressed={theme === t} onclick={() => pickTheme(t)}>{nameOf(t)}{#if !allThemes && !BASIC.includes(t)} <Icon name="lock" size={12} />{/if}</button>
    {/each}
  </div>
  {#if !allThemes}<p class="label">Pawn has {BASIC.length} themes; {PLAN_INFO[$planSettings.config.gates.themed_puzzles].name} and up have all {THEMES.length}.</p>{/if}

  {#if limited}
    <LimitReached feature="puzzle" back="/puzzles" backLabel="Daily puzzle" />
  {:else if error}
    <p class="label">{error}</p>
  {:else if current}
    <div class="body">
      <section class="board-box">
        {#key round}
          <PuzzleBoard fen={current[1]} moves={current[2].split(' ')} onresult={done} />
        {/key}
      </section>
      <section class="card side">
        <span class="pill">Puzzle {current[3]}</span>
        {#if result === undefined}
          <p class="label">Theme: {nameOf(theme)}. The opponent has just moved; your turn.</p>
        {:else}
          <p class:ok={result} class:bad={!result}>{result ? 'Well done!' : 'This one was tricky. Watch the answer, then try the next.'}</p>
          <button class="btn primary" onclick={next}>Next puzzle</button>
        {/if}
        {#if goal && solvedNow >= goal}<p class="goal">Plan task done: {goal} {nameOf(theme)} puzzles! <a href="/learn">Back to your plan</a></p>{/if}
      </section>
    </div>
  {:else}
    <div class="card skel"></div>
  {/if}
</div>

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
  }
  .stat {
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    border-color: var(--gold);
  }
  .stat strong {
    font-size: 30px;
    color: var(--gold);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .body {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .board-box {
    flex: 1 1 420px;
    max-width: 640px;
    min-width: 0;
  }
  .side {
    flex: 1 1 260px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .side p {
    margin: 0;
  }
  .ok {
    color: var(--win);
    font-weight: 700;
  }
  .bad {
    color: var(--loss);
    font-weight: 700;
  }
  .goal {
    color: var(--gold);
    font-weight: 700;
  }
  .skel {
    height: 400px;
  }
</style>

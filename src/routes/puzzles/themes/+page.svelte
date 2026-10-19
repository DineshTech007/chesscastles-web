<script lang="ts">
  /**
   * Themed puzzles at the player's level (forks, pins, endgames…), from the
   * Lichess puzzle database (CC0). Each solved one counts for Guru's plan
   * ("Theme puzzle: <theme>").
   */
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import { POINTS, study } from '$lib/study/progress';
  import { THEME_NAMES } from '$lib/insights/plan';
  import LimitReached from '$lib/components/LimitReached.svelte';
  import { PLAN_INFO, PLANS_ON, RANK, currentPlan, planSettings, requireGate, useFeature } from '$lib/plans';
  import { puzzleRating, ratePuzzle } from '$lib/puzzles/rating';
  import { markSeen, seenPuzzles } from '$lib/puzzles/bank';

  type P = [string, string, string, number];
  const THEMES = ['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mateIn1', 'mateIn2', 'backRankMate', 'sacrifice', 'defensiveMove', 'opening', 'middlegame', 'endgame', 'rookEndgame', 'pawnEndgame', 'crushing', 'short'];

  /** Free's themes; every theme comes with the plan that has themed_puzzles (Premium). */
  const BASIC = ['fork', 'pin', 'mateIn1', 'mateIn2'];
  // While everything is free (PLANS_ON off) hasGate gives everyone every theme.
  const allThemes = $derived(!PLANS_ON || RANK[$currentPlan] >= RANK[$planSettings.config.gates.themed_puzzles]);
  let theme = $state(page.url.searchParams.get('theme') ?? 'fork');
  let limited = $state(false);
  const goal = Number(page.url.searchParams.get('n')) || 0;
  /** The last puzzle's rating change. */
  let change = $state<number | undefined>();
  let bank = $state<P[]>([]);
  let current = $state<P | undefined>();
  let round = $state(0);
  let solvedNow = $state(0);
  let result = $state<boolean | undefined>();
  let error = $state('');

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
    // Never one seen before (rated or themed), near the player's rating when there is one.
    const seen = seenPuzzles();
    const fresh = bank.filter((p) => !seen.has(p[0]));
    const near = fresh.filter((p) => Math.abs(p[3] - $puzzleRating) <= 150);
    const pool = near.length ? near : fresh.length ? fresh : bank;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    // Each puzzle counts towards the plan's puzzles a day.
    if (!(await useFeature('puzzle', pick[0]))) return void (limited = true);
    markSeen(pick[0]);
    current = pick;
    result = undefined;
    change = undefined;
    round++;
  }
  function pickTheme(t: string) {
    if (!BASIC.includes(t) && !requireGate('themed_puzzles')) return;
    theme = t;
  }

  /** The puzzle rating counts the first result only (a wrong move or a hint: missed). */
  async function rate(clean: boolean) {
    if (!current) return;
    change = await ratePuzzle(current[0], current[3], clean, theme);
  }

  function done(ok: boolean) {
    if (!current) return;
    result = ok;
    if (ok) {
      solvedNow++;
      study.log('puzzle', POINTS.puzzleSolved, `Theme puzzle: ${theme}`);
    }
  }
  /** "Hanging piece", "Mate in 2": the theme as a label. */
  const nameOf = (t: string) => {
    const n = THEME_NAMES[t] ?? t;
    return n[0].toUpperCase() + n.slice(1);
  };
</script>

<svelte:head><title>{nameOf(theme)} puzzles · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/puzzles"><Icon name="back" size={16} />Puzzles</a>
  <header class="head">
    <div>
      <h1 class="display">Puzzles by theme</h1>
      <p class="label">Practise one pattern until it is automatic. Puzzles from the Lichess puzzle database, at your level.</p>
    </div>
    <div class="stat card"><span class="label">Your puzzle rating</span><strong class="display num">{$puzzleRating}{#if change}<span class="chg" class:up={change > 0}>{change > 0 ? '+' : ''}{change}</span>{/if}</strong>{#if goal}<span class="label">{Math.min(solvedNow, goal)} of {goal} for your plan</span>{/if}</div>
  </header>

  <div class="chips" role="group" aria-label="Theme">
    {#each THEMES as t (t)}
      <button class="chip" aria-pressed={theme === t} onclick={() => pickTheme(t)}>{nameOf(t)}{#if !allThemes && !BASIC.includes(t)} <Icon name="lock" size={12} />{/if}</button>
    {/each}
  </div>
  {#if !allThemes}<p class="label">The Free plan has {BASIC.length} themes; the {PLAN_INFO[$planSettings.config.gates.themed_puzzles].name} plan and up have all {THEMES.length}.</p>{/if}

  {#if limited}
    <LimitReached feature="puzzle" back="/puzzles" backLabel="Daily puzzle" />
  {:else if error}
    <p class="label">{error}</p>
  {:else if current}
    <div class="body">
      <section class="board-box">
        {#key round}
          <!-- One retry after a wrong move, as a coach would allow. -->
          <PuzzleBoard fen={current[1]} moves={current[2].split(' ')} tries={2} onresult={done} onfirst={rate} hintButton />
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
  /* Phones: the themes in one row to swipe, so the board comes first. */
  @media (max-width: 767px) {
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      margin: 0 -16px;
      padding: 0 16px 4px;
      mask-image: linear-gradient(90deg, #000 85%, transparent);
    }
    .chips::-webkit-scrollbar {
      display: none;
    }
    .chips :global(.chip) {
      flex: none;
    }
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
  .chg {
    font-size: 18px;
    margin-left: 6px;
    color: var(--loss);
  }
  .chg.up {
    color: var(--win);
  }
</style>

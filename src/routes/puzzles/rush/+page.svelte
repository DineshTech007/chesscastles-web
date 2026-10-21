<script lang="ts">
  /**
   * Puzzle Rush (the owner, 2026-10-21: make puzzles "more entertaining and engaging"; chess.com's Puzzle Rush and
   * Lichess's Puzzle Storm are the most played puzzle modes there): as many puzzles as you can in 3 minutes, 3
   * mistakes and it's over, easy at first and a little harder after every solve. One try a puzzle; it doesn't change
   * the rating. The solved ones count for the day's goal, and a best score and two badges are kept (rewards.ts).
   */
  import { onDestroy } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import Icon from '$lib/components/Icon.svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import { useFeature } from '$lib/plans';
  import { POINTS, study } from '$lib/study/progress';
  import { markSeen, nextRated, seenPuzzles, type BandPuzzle } from '$lib/puzzles/bank';
  import Celebrations from '$lib/puzzles/Celebrations.svelte';
  import Medal from '$lib/puzzles/Medal.svelte';
  import { puzzleSounds } from '$lib/puzzles/puzzleSounds';
  import { BADGES, recordRush, rewards, rushTitle } from '$lib/puzzles/rewards';

  const SECONDS = 180;
  const LIVES = 3;
  /** The difficulty after `solved` puzzles: easy at first, 60 points harder after each solve. */
  const levelAt = (solved: number) => Math.min(2600, 500 + solved * 60);
  const RUSH_BADGES = BADGES.filter((b) => b.id.startsWith('rush'));

  let phase = $state<'ready' | 'run' | 'over'>('ready');
  let current = $state<BandPuzzle | undefined>();
  let round = $state(0);
  let score = $state(0);
  let misses = $state(0);
  let log = $state<{ id: string; r: number; ok: boolean }[]>([]);
  let deadline = $state(0);
  let now = $state(Date.now());
  let ended = $state<'time' | 'lives' | 'stop'>('time');
  let best = $state<{ best: number; newBest: boolean } | undefined>();
  let flash = $state<'ok' | 'bad' | undefined>();
  let starting = $state(false);
  let celebrations: Celebrations;
  let seen = new Set<string>();
  let lastTick = 0;

  const left = $derived(Math.max(0, Math.ceil((deadline - now) / 1000)));
  const clock = $derived(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
  const hardest = $derived(Math.max(0, ...log.filter((x) => x.ok).map((x) => x.r)));
  const shownScore = new Tween(0, { duration: 1200, delay: 300, easing: cubicOut });

  const tick = setInterval(() => (now = Date.now()), 200);
  onDestroy(() => clearInterval(tick));

  // The clock: ticks in the last 10 seconds, then the end.
  $effect(() => {
    if (phase !== 'run' || !deadline) return;
    const l = left;
    if (l <= 10 && l > 0 && l !== lastTick) {
      lastTick = l;
      puzzleSounds.tick();
    }
    if (l === 0) finish('time');
  });

  async function start() {
    if (starting) return;
    starting = true;
    try {
      // A visitor's free puzzles: a whole rush counts as one.
      if (!(await useFeature('puzzle', `rush-${Date.now()}`))) return;
      seen = seenPuzzles();
      score = 0;
      misses = 0;
      log = [];
      best = undefined;
      shownScore.set(0, { duration: 0 });
      lastTick = 0;
      phase = 'run';
      await load();
      // The clock starts with the first puzzle on the board.
      deadline = Date.now() + SECONDS * 1000 + 600;
    } finally {
      starting = false;
    }
  }

  async function load() {
    const p = await nextRated(levelAt(score), seen);
    if (phase !== 'run') return;
    if (!p) return finish('stop');
    seen.add(p[0]);
    markSeen(p[0]);
    current = p;
    round++;
  }

  function onresult(ok: boolean) {
    if (phase !== 'run' || !current) return;
    log = [...log, { id: current[0], r: current[3], ok }];
    flash = ok ? 'ok' : 'bad';
    setTimeout(() => (flash = undefined), 450);
    if (ok) {
      score++;
      study.log('puzzle', POINTS.puzzleSolved, 'Puzzle Rush');
      puzzleSounds.star(Math.min(3, 1 + Math.floor(score / 5)));
    } else {
      misses++;
      puzzleSounds.missed();
      if (misses >= LIVES) return void setTimeout(() => finish('lives'), 900);
    }
    // After a miss, a moment to see the answer begin.
    setTimeout(() => phase === 'run' && void load(), ok ? 350 : 1000);
  }

  function finish(why: 'time' | 'lives' | 'stop') {
    if (phase !== 'run') return;
    phase = 'over';
    ended = why;
    current = undefined;
    const r = recordRush(score, log.length);
    best = { best: r.best, newBest: r.newBest && score > 0 };
    shownScore.target = score;
    if (best.newBest) puzzleSounds.levelUp();
    else puzzleSounds.solved();
    celebrations.add(
      r.earned.map((badge) => ({ badge })),
      2200,
    );
  }
</script>

<svelte:head><title>Puzzle Rush · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/puzzles"><Icon name="back" size={16} />Puzzles</a>

  {#if phase === 'ready'}
    <section class="card ready">
      <img class="hero" src="/puzzles/rush-hero.webp" alt="" width="200" height="200" />
      <h1 class="display">Puzzle Rush</h1>
      <p class="lead">Solve as many puzzles as you can in <b>3 minutes</b>. <b>3 mistakes</b> and it's over. They start easy and get harder with every solve!</p>
      <div class="facts">
        <span><Icon name="trophy" size={18} />Your best: <b class="num">{$rewards.rushBest}</b></span>
        {#if rushTitle($rewards.rushBest)}<span class="rtitle">🚀 {rushTitle($rewards.rushBest)}</span>{/if}
        {#if $rewards.rushRuns.length}<span class="label">Last: {$rewards.rushRuns.slice(-5).join(', ')}</span>{/if}
        <a class="board" href="/leaderboard#rush">Puzzle Rush leaderboard →</a>
      </div>
      <button class="btn primary go" onclick={start} disabled={starting}>Start the rush 🚀</button>
      <p class="label small">One try a puzzle. Rush doesn't change your puzzle rating.</p>
      <div class="rbadges">
        {#each RUSH_BADGES as b (b.id)}
          {@const got = $rewards.badges.includes(b.id)}
          <span class="rb" class:got><Medal badge={b} {got} size={56} /><span><b>{b.name}</b><span class="label">{b.hint}</span></span></span>
        {/each}
      </div>
    </section>
  {:else if phase === 'run'}
    <div class="hud" class:ok={flash === 'ok'} class:bad={flash === 'bad'}>
      <span class="time num" class:low={left <= 20}>⏱ {clock}</span>
      <span class="score num" aria-label="Solved">{score}</span>
      <span class="lives" aria-label="{LIVES - misses} mistakes left">
        {#each Array.from({ length: LIVES }) as _, i (i)}<i class:used={i < misses}>✕</i>{/each}
      </span>
    </div>
    <div class="board">
      {#if current}
        {#key round}
          <PuzzleBoard fen={current[1]} moves={current[2].split(' ')} tries={1} {onresult} />
        {/key}
      {:else}
        <div class="card skel">Finding a puzzle…</div>
      {/if}
    </div>
    <ol class="trail" aria-label="This rush">
      {#each log as x, i (i)}<li class:ok={x.ok} title="Puzzle {x.r}">{x.ok ? '✓' : '✕'}</li>{/each}
    </ol>
    <button class="btn stop" onclick={() => finish('stop')}>End the rush</button>
  {:else}
    <section class="card over" class:best={best?.newBest}>
      {#if best?.newBest}
        <span class="confetti" aria-hidden="true">
          {#each Array.from({ length: 30 }) as _, i (i)}<i style="left: {(i * 37) % 100}%; background: {['#f2c14e', '#38d2ff', '#22c55e', '#f472b6', '#a78bfa'][i % 5]}; animation-delay: {(i % 6) * 0.08}s"></i>{/each}
        </span>
      {/if}
      <img class="hero small" src="/puzzles/rush-hero.webp" alt="" width="120" height="120" />
      <span class="why label">{ended === 'time' ? "Time's up!" : ended === 'lives' ? 'Three mistakes' : 'Rush over'}</span>
      <strong class="display big num">{Math.round(shownScore.current)}</strong>
      <span class="solved">{score === 1 ? 'puzzle' : 'puzzles'} solved</span>
      {#if best?.newBest}
        <span class="newbest display">New best!</span>
      {:else if best}
        <span class="label">Your best: <b class="num">{best.best}</b></span>
      {/if}
      {#if best && rushTitle(best.best)}<span class="rtitle">🚀 {rushTitle(best.best)}</span>{/if}
      {#if hardest}<span class="label">Hardest solved: <b class="num">{hardest}</b></span>{/if}
      {#if log.length}
        <ol class="trail end">
          {#each log as x, i (i)}<li class:ok={x.ok}>{x.r}</li>{/each}
        </ol>
      {/if}
      <div class="actions">
        <button class="btn primary go" onclick={start} disabled={starting}>Play again</button>
        <a class="btn" href="/puzzles">Rated puzzles</a>
      </div>
      <a class="board" href="/leaderboard#rush">See the Puzzle Rush leaderboard →</a>
    </section>
  {/if}
</div>

<Celebrations bind:this={celebrations} />

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .ready,
  .over {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px 16px;
    text-align: center;
    background:
      radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 70%),
      var(--card);
  }
  .hero {
    width: 200px;
    height: 200px;
    object-fit: contain;
    animation: float 3s ease-in-out infinite;
  }
  .hero.small {
    width: 120px;
    height: 120px;
  }
  @keyframes float {
    50% {
      transform: translateY(-8px) rotate(-2deg);
    }
  }
  h1 {
    margin: 0;
    font-size: 44px;
    line-height: 1;
    color: var(--gold);
  }
  .lead {
    margin: 0;
    max-width: 440px;
    font-size: 16px;
    color: var(--text-2);
  }
  .facts {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .facts > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }
  .rtitle {
    padding: 3px 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 20%, transparent);
    border: 1px solid var(--gold);
    color: var(--gold);
    font-weight: 800;
    font-size: 14px;
  }
  .board {
    font-weight: 700;
    color: var(--gold);
    text-decoration: none;
  }
  .go {
    min-height: 54px;
    min-width: min(100%, 280px);
    font-size: 19px;
  }
  .small {
    font-size: 12.5px;
  }
  .rbadges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px 18px;
    margin-top: 4px;
  }
  .rb {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
  }
  .rb > span {
    display: flex;
    flex-direction: column;
    font-size: 13.5px;
  }
  .hud {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--border);
    transition: background 0.2s;
  }
  .hud.ok {
    background: color-mix(in srgb, var(--win) 22%, var(--card));
  }
  .hud.bad {
    background: color-mix(in srgb, var(--loss) 22%, var(--card));
  }
  .time {
    font-size: 20px;
    font-weight: 800;
    white-space: nowrap;
  }
  .time.low {
    color: var(--loss);
  }
  .score {
    font-family: var(--font-display);
    font-size: 40px;
    line-height: 1;
    color: var(--gold);
  }
  .lives {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }
  .lives i {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    font-style: normal;
    font-weight: 900;
    font-size: 14px;
    color: transparent;
    background: color-mix(in srgb, var(--text) 10%, transparent);
  }
  .lives i.used {
    color: #fff;
    background: var(--loss);
    animation: pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1);
  }
  @keyframes pop {
    from {
      transform: scale(0.3);
    }
  }
  .skel {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
  }
  .trail {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .trail li {
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 800;
    color: #fff;
    background: var(--loss);
  }
  .trail li.ok {
    background: var(--win);
  }
  .trail.end {
    justify-content: center;
  }
  .stop {
    align-self: center;
  }
  .why {
    font-size: 15px;
    font-weight: 700;
  }
  .big {
    font-size: 84px;
    line-height: 0.9;
    color: var(--gold);
  }
  .solved {
    font-weight: 700;
    color: var(--text-2);
  }
  .newbest {
    font-size: 32px;
    background: linear-gradient(180deg, #ffe39a, #edb040 60%, #c98a1b);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) 1.2s both;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 6px;
  }
  .confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .confetti i {
    position: absolute;
    top: -12px;
    width: 8px;
    height: 12px;
    border-radius: 2px;
    animation: fall 2.4s cubic-bezier(0.25, 0.6, 0.5, 1) forwards;
  }
  @keyframes fall {
    to {
      transform: translateY(560px) rotate(540deg);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero {
      animation: none;
    }
    .confetti {
      display: none;
    }
  }
</style>

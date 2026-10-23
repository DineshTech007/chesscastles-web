<script lang="ts">
  /**
   * Puzzle Rush (the owner, 2026-10-21: make puzzles "more entertaining and engaging"; chess.com's Puzzle Rush and
   * Lichess's Puzzle Storm are the most played puzzle modes there): as many puzzles as you can in 3 minutes, 3
   * mistakes and it's over, easy at first and a little harder after every solve. One try a puzzle; it doesn't change
   * the rating. The solved ones count for the day's goal, and a best score and two badges are kept (rewards.ts).
   * Afterwards (owner, 2026-10-22): every puzzle opens again (RushReview: the wrong move and the answer), and the
   * player's place on the Puzzle Rush board shows at once (RushStanding).
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
  import { BADGES, nextRushTitle, recordEndless, recordRush, rewards, RUSH_TITLES, rushTitle } from '$lib/puzzles/rewards';
  import { page } from '$app/state';
  import RushReview, { type RushPuzzle } from '$lib/puzzles/RushReview.svelte';
  import RushStanding from '$lib/puzzles/RushStanding.svelte';
  import { t } from '$lib/i18n';

  const SECONDS = 180;
  const LIVES = 3;
  /** The difficulty after `solved` puzzles: easy at first, 60 points harder after each solve. */
  const levelAt = (solved: number) => Math.min(2600, 500 + solved * 60);

  /**
   * The 3-minute Rush, or Rush Unlimited (owner, 2026-10-23: "unlimited puzzle rush… its standing will be separate"):
   * no clock, 3 mistakes end it; its own best and leaderboard, and the 3-minute titles stay the 3-minute Rush's.
   */
  let mode = $state<'timed' | 'endless'>(page.url.searchParams.get('mode') === 'unlimited' ? 'endless' : 'timed');
  const endless = $derived(mode === 'endless');
  const bestNow = $derived(endless ? $rewards.endlessBest : $rewards.rushBest);
  const runs = $derived(endless ? $rewards.endlessRuns : $rewards.rushRuns);
  let phase = $state<'ready' | 'run' | 'over'>('ready');
  let current = $state<BandPuzzle | undefined>();
  let round = $state(0);
  let score = $state(0);
  let misses = $state(0);
  let log = $state<RushPuzzle[]>([]);
  /** The puzzle open again after the rush (its place in the log). */
  let reviewing = $state<number | undefined>();
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
  /** A sentence with *bold* parts (features/awards.ts): its parts in order, the odd ones bold, values filled in after. */
  const rich = (s: string, vars: Record<string, string | number> = {}) => s.split('*').map((part) => part.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')));
  const shownScore = new Tween(0, { duration: 1200, delay: 300, easing: cubicOut });

  const tick = setInterval(() => (now = Date.now()), 200);
  onDestroy(() => clearInterval(tick));

  // The clock: ticks in the last 10 seconds, then the end.
  $effect(() => {
    if (phase !== 'run' || !deadline || endless) return;
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
      reviewing = undefined;
      best = undefined;
      shownScore.set(0, { duration: 0 });
      lastTick = 0;
      phase = 'run';
      await load();
      // The clock starts with the first puzzle on the board (Rush Unlimited has none).
      deadline = endless ? 0 : Date.now() + SECONDS * 1000 + 600;
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

  function onresult(ok: boolean, _wrong: number, miss?: { ply: number; uci: string }) {
    if (phase !== 'run' || !current) return;
    log = [...log, { id: current[0], fen: current[1], moves: current[2].split(' '), r: current[3], ok, miss }];
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
    const r = endless ? recordEndless(score, log.length) : recordRush(score, log.length);
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

{#snippet bold(parts: string[])}{#each parts as part, i (i)}{#if i % 2}<b>{part}</b>{:else}{part}{/if}{/each}{/snippet}

{#snippet titles(bestNow: number)}
  {@const next = nextRushTitle(bestNow)}
  <div class="titles">
    <ol class="ladder" aria-label={$t('awards.rush.ladder')}>
      {#each RUSH_TITLES as rt (rt.min)}
        {@const got = bestNow >= rt.min || $rewards.badges.includes(rt.badge)}
        <li class:got class:next={next?.min === rt.min}>
          <Medal badge={BADGES.find((b) => b.id === rt.badge)!} {got} peek={next?.min === rt.min} size={52} />
          <span class="tname">{rt.name}</span>
          <span class="tmin num">{rt.min}+</span>
        </li>
      {/each}
    </ol>
    <p class="chase">{#if next}{@render bold(rich($t('awards.rush.next'), { name: next.name, n: next.more }))}{:else}{$t('awards.rush.top')}{/if}</p>
  </div>
{/snippet}

<svelte:head><title>Puzzle Rush · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/puzzles"><Icon name="back" size={16} />Puzzles</a>

  {#if phase === 'ready'}
    <section class="card ready">
      <img class="hero" src="/puzzles/rush-hero.webp" alt="" width="200" height="200" />
      <h1 class="display">Puzzle Rush</h1>
      <div class="modes" role="group" aria-label="Puzzle Rush">
        <button class:on={!endless} aria-pressed={!endless} onclick={() => (mode = 'timed')}>{$t('awards.rush.mode3')}</button>
        <button class:on={endless} aria-pressed={endless} onclick={() => (mode = 'endless')}>{$t('awards.rush.modeU')}</button>
      </div>
      <p class="lead">{@render bold(rich($t(endless ? 'awards.rush.leadU' : 'awards.rush.lead')))}</p>
      {#if endless}<p class="label small">{$t('awards.rush.ownBoard')}</p>{/if}
      <div class="facts">
        <span><Icon name="trophy" size={18} />{$t('awards.rush.yourbest')} <b class="num">{bestNow}</b></span>
        {#if !endless && rushTitle(bestNow)}<span class="rtitle">🚀 {rushTitle(bestNow)}</span>{/if}
        {#if runs.length}<span class="label">{$t('awards.rush.last', { list: runs.slice(-5).join(', ') })}</span>{/if}
        <a class="board" href={endless ? '/leaderboard#endless' : '/leaderboard#rush'}>{$t(endless ? 'awards.rush.boardU' : 'awards.rush.board')}</a>
      </div>
      <button class="btn primary go" onclick={start} disabled={starting}>{$t(endless ? 'awards.rush.startU' : 'awards.rush.start')}</button>
      {#key mode}{#if bestNow}<RushStanding best={bestNow} board={endless ? 'endless' : 'rush'} />{/if}{/key}
      <p class="label small">{$t('awards.rush.onetry')}</p>
      {#if !endless}{@render titles(bestNow)}{/if}
    </section>
  {:else if phase === 'run'}
    <div class="hud" class:ok={flash === 'ok'} class:bad={flash === 'bad'}>
      {#if endless}<span class="time">♾️ {$t('awards.rush.noclock')}</span>{:else}<span class="time num" class:low={left <= 20}>⏱ {clock}</span>{/if}
      <span class="score num" aria-label={$t('awards.rush.solved')}>{score}</span>
      <span class="lives" aria-label={$t('awards.rush.lives', { n: LIVES - misses })}>
        {#each Array.from({ length: LIVES }) as _, i (i)}<i class:used={i < misses}>✕</i>{/each}
      </span>
    </div>
    <div class="board">
      {#if current}
        {#key round}
          <PuzzleBoard fen={current[1]} moves={current[2].split(' ')} tries={1} {onresult} premoves />
        {/key}
      {:else}
        <div class="card skel">{$t('awards.rush.finding')}</div>
      {/if}
    </div>
    <ol class="trail" aria-label={$t('awards.rush.trail')}>
      {#each log as x, i (i)}<li class:ok={x.ok} title="Puzzle {x.r}">{x.ok ? '✓' : '✕'}</li>{/each}
    </ol>
    <button class="btn stop" onclick={() => finish('stop')}>{$t('awards.rush.end')}</button>
  {:else}
    <section class="card over" class:best={best?.newBest}>
      {#if best?.newBest}
        <span class="confetti" aria-hidden="true">
          {#each Array.from({ length: 30 }) as _, i (i)}<i style="left: {(i * 37) % 100}%; background: {['#f2c14e', '#38d2ff', '#22c55e', '#f472b6', '#a78bfa'][i % 5]}; animation-delay: {(i % 6) * 0.08}s"></i>{/each}
        </span>
      {/if}
      <img class="hero small" src="/puzzles/rush-hero.webp" alt="" width="120" height="120" />
      <span class="why label">{ended === 'time' ? $t('awards.rush.why.time') : ended === 'lives' ? $t('awards.rush.why.lives') : $t('awards.rush.why.stop')}</span>
      <strong class="display big num">{Math.round(shownScore.current)}</strong>
      <span class="solved">{score === 1 ? $t('awards.rush.solved.one') : $t('awards.rush.solved.many')}</span>
      {#if best?.newBest}
        <span class="newbest display">{$t('awards.rush.newbest')}</span>
      {:else if best}
        <span class="label">{$t('awards.rush.yourbest')} <b class="num">{best.best}</b></span>
      {/if}
      {#if best && !endless && rushTitle(best.best)}<span class="rtitle">🚀 {rushTitle(best.best)}</span>{/if}
      {#if hardest}<span class="label">{$t('awards.rush.hardest')} <b class="num">{hardest}</b></span>{/if}
      {#if best && !endless}{@render titles(best.best)}{/if}
      {#if log.length}
        <p class="label small tap">{$t('awards.rush.tap')}{log.some((x) => !x.ok) ? $t('awards.rush.tap.red') : ''}</p>
        <ol class="trail end">
          {#each log as x, i (i)}<li class:ok={x.ok}><button onclick={() => (reviewing = i)} title={x.ok ? $t('awards.rush.tip.ok', { r: x.r }) : $t('awards.rush.tip.bad', { r: x.r })}>{x.r}</button></li>{/each}
        </ol>
      {/if}
      {#if best}<RushStanding best={best.best} board={endless ? 'endless' : 'rush'} />{/if}
      <div class="actions">
        <button class="btn primary go" onclick={start} disabled={starting}>{$t('awards.rush.again')}</button>
        <a class="btn" href="/puzzles">Rated puzzles</a>
      </div>
    </section>
  {/if}
</div>

{#if reviewing !== undefined && log[reviewing]}
  <RushReview list={log} bind:at={reviewing} onclose={() => (reviewing = undefined)} />
{/if}

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
  /* 3 minutes or Unlimited: two big buttons, the chosen one in gold. */
  .modes {
    display: flex;
    gap: 6px;
    padding: 4px;
    border-radius: 999px;
    background: var(--raised);
  }
  .modes button {
    min-height: 44px;
    padding: 0 18px;
    border: none;
    border-radius: 999px;
    background: none;
    color: var(--text-2);
    font: 800 15px var(--font-body);
    cursor: pointer;
  }
  .modes button.on {
    background: var(--gold);
    color: #1a1300;
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
  /* The titles to chase: every medal, the ones won lit, the next one framed in gold. */
  .titles {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .ladder {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 440px;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }
  .ladder li {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 2px;
    border-radius: 12px;
  }
  .ladder li.next {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    box-shadow: inset 0 0 0 1.5px var(--gold);
  }
  .tname {
    font-size: 11.5px;
    font-weight: 800;
    line-height: 1.15;
    text-align: center;
  }
  .ladder li:not(.got) .tname {
    color: var(--muted);
  }
  .ladder li.next .tname {
    color: var(--gold);
  }
  .tmin {
    font-size: 11px;
    color: var(--muted);
  }
  .chase {
    margin: 0;
    font-size: 14.5px;
    font-weight: 600;
  }
  .chase b {
    color: var(--gold);
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
  /* After the rush every puzzle is a button: it opens again (RushReview). */
  .trail.end li {
    padding: 0;
    height: 28px;
  }
  .trail.end button {
    height: 100%;
    padding: 0 8px;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .trail.end li:hover {
    transform: translateY(-1px);
    box-shadow: 0 0 0 2px color-mix(in srgb, #fff 45%, transparent);
  }
  .tap {
    margin: 4px 0 0;
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

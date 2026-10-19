<script lang="ts">
  /**
   * Rated puzzles, made for kids: one puzzle after another at the player's level (bank.ts), and around the board
   * everything that shows progress: the puzzle rating before and after each puzzle (rating.ts: a puzzle counts
   * once, at its first result), the level from Pawn to King and how far to the next, a countdown that earns a
   * speed star, up to three stars a puzzle, the streak, a daily goal, badges with a celebration, the rating chart
   * and the last seven days (rewards.ts). The rewards never change the rating.
   */
  import { onDestroy, onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import { THEME_NAMES } from '$lib/insights/plan';
  import { useFeature } from '$lib/plans';
  import { POINTS, study } from '$lib/study/progress';
  import { PUZZLE_LEVELS, STAGES, ladderLevel, levelOf, markSeen, moveLadder, nextRated, stageOf, type BandPuzzle, type LadderOutcome } from './bank';
  import { puzzleHistory, puzzleRating, puzzleStats, ratePuzzle } from './rating';
  import { BADGES, daysInRow, lastWeek, recordPuzzle, rewards, setGoal, setTimer, timerFor, type Badge } from './rewards';

  let current = $state<BandPuzzle | undefined>();
  /** The learning ladder: how hard the next puzzle is (bank.ts). */
  let ladder = $state(600);
  let ladderReady = false;
  let round = $state(0);
  let result = $state<boolean | undefined>();
  let change = $state<number | undefined>();
  let error = $state('');
  let loading = $state(false);

  // This puzzle: the rating before it, the clock, its first result and its stars.
  let before = $state(0);
  let startedAt = $state(0);
  let stoppedAt = $state(0);
  let now = $state(Date.now());
  let firstClean: boolean | undefined;
  let rated: Promise<void> = Promise.resolve();
  let stars = $state(0);
  // This visit.
  let tried = $state(0);
  let solvedNow = $state(0);
  let visitStart = $state<number | undefined>();
  // Celebrations.
  let party = $state(0);
  let toast = $state<Badge | undefined>();
  const queue: Badge[] = [];
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const shownRating = Tween.of(() => $puzzleRating, { duration: 900, easing: cubicOut });
  const lv = $derived(levelOf($puzzleRating));
  const limit = $derived(current ? timerFor(current[3]) : 60);
  const elapsed = $derived(startedAt ? Math.max(0, ((stoppedAt || now) - startedAt) / 1000) : 0);
  const left = $derived(Math.max(0, Math.ceil(limit - elapsed)));
  const timerOn = $derived($rewards.timer);
  const today = $derived(lastWeek($rewards).at(-1)!.log);
  const goalPct = $derived(Math.min(1, today.solved / Math.max(1, $rewards.goal)));
  const week = $derived(lastWeek($rewards));
  const weekMax = $derived(Math.max(3, ...week.map((d) => d.log.solved)));
  const inRow = $derived(daysInRow($rewards));
  /** The rating over the last 30 rated puzzles. */
  const chart = $derived.by(() => {
    const h = $puzzleHistory.slice(-30);
    if (h.length < 2) return undefined;
    const rs = h.map((x) => x.r);
    const lo = Math.min(...rs) - 15;
    const hi = Math.max(...rs) + 15;
    const pts = h.map((x, i) => ({ x: (i / (h.length - 1)) * 100, y: (1 - (x.r - lo) / (hi - lo)) * 100, ok: x.ok }));
    return { pts, path: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '), lo: Math.round(lo + 15), hi: Math.round(hi - 15) };
  });

  const tick = setInterval(() => (now = Date.now()), 250);
  onDestroy(() => {
    clearInterval(tick);
    clearTimeout(toastTimer);
  });
  onMount(() => void next());

  async function next() {
    if (loading) return;
    loading = true;
    error = '';
    try {
      if (!ladderReady) {
        ladder = ladderLevel($puzzleRating, $puzzleStats.attempted);
        ladderReady = true;
      } else if (current && result === undefined) {
        // Skipped: a little easier next time.
        ladder = moveLadder(ladder, 'skipped', $puzzleStats.attempted);
      }
      const p = await nextRated(ladder);
      if (!p) {
        error = 'You have solved every puzzle near your rating in this browser. Well done!';
        return;
      }
      void useFeature('puzzle', p[0]);
      markSeen(p[0]);
      current = p;
      result = undefined;
      change = undefined;
      stars = 0;
      firstClean = undefined;
      before = $puzzleRating;
      visitStart ??= before;
      // The clock starts once the opponent's move is on the board.
      startedAt = Date.now() + 600;
      stoppedAt = 0;
      round++;
    } catch {
      error = 'The puzzles could not be loaded. Check your connection and try again.';
    } finally {
      loading = false;
    }
  }

  function rate(clean: boolean) {
    if (!current) return;
    firstClean = clean;
    const p = current;
    rated = ratePuzzle(p[0], p[3], clean, p[4][0] ?? 'mix').then((c) => {
      if (current === p) change = c;
    });
  }

  async function done(ok: boolean) {
    stoppedAt = Date.now();
    result = ok;
    tried++;
    if (ok) solvedNow++;
    if (ok && current) study.log('puzzle', POINTS.puzzleSolved, `Rated puzzle ${current[0]}`);
    const inTime = timerOn && elapsed <= limit;
    await rated;
    // The ladder: up after a first-try solve, a little up after a later solve, down after a miss.
    const outcome: LadderOutcome = ok ? (firstClean ? 'clean' : 'solved') : 'missed';
    const before = stageOf(ladder);
    ladder = moveLadder(ladder, outcome, $puzzleStats.attempted);
    const after = stageOf(ladder);
    if (after.from > before.from) queue.push({ id: `stage-${after.name}`, icon: '🎓', name: `${after.name} puzzles unlocked!`, hint: '' });
    const s = $puzzleStats;
    const r = recordPuzzle({ solved: ok, clean: !!firstClean, inTime, streak: s.streak, solvedTotal: s.solved, rating: $puzzleRating });
    stars = r.stars;
    if (ok) party++;
    for (const b of r.earned) queue.push(b);
    if (!toast) showToast();
  }

  function showToast() {
    toast = queue.shift();
    if (!toast) return;
    toastTimer = setTimeout(() => {
      toast = undefined;
      setTimeout(showToast, 300);
    }, 3800);
  }

  const nameOf = (t: string) => {
    const n = THEME_NAMES[t] ?? t.replace(/([A-Z])/g, ' $1').toLowerCase();
    return n[0].toUpperCase() + n.slice(1);
  };
  /** The themes worth naming (not "middlegame", "short"…), after the answer. */
  const SKIP = new Set(['opening', 'middlegame', 'endgame', 'short', 'long', 'crushing', 'advantage', 'equality']);
  const cheer = (s: number) => (s === 3 ? 'Perfect! Three stars!' : s === 2 ? 'Great job!' : 'Solved!');
  // Confetti pieces (fixed positions, so they don't change on every render).
  const bits = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, d: (i % 7) * 0.05, c: ['#ffb300', '#22c55e', '#4d86e6', '#e64a19', '#c084fc'][i % 5], r: (i * 47) % 360 }));
</script>

<div class="rated">
  <section class="board-col" aria-label="Puzzle board">
    <!-- On phones: the numbers that matter, right above the board. -->
    <div class="hud" aria-hidden="true">
      <span class="hud-r"><img class="hud-piece" src={lv.level.image} alt="" width="30" height="30" /><strong class="num">{Math.round(shownRating.current)}</strong></span>
      {#if change !== undefined}<span class="delta num" class:up={change > 0} class:down={change < 0}>{change > 0 ? '▲' : change < 0 ? '▼' : '='}{Math.abs(change) || ''}</span>{/if}
      <span class="grow"></span>
      {#if $puzzleStats.streak > 0}<span class="hud-streak">🔥{$puzzleStats.streak}</span>{/if}
      {#if timerOn && current && result === undefined}<span class="hud-time num" class:low={left <= 10}>⏱ {left}s</span>{/if}
    </div>
    <div class="board-wrap">
      {#if current}
        {#key round}
          <PuzzleBoard fen={current[1]} moves={current[2].split(' ')} tries={2} onresult={done} onfirst={rate} hintButton />
        {/key}
      {:else}
        <div class="placeholder">{error || 'Finding a puzzle at your level…'}</div>
      {/if}
      {#key party}
        {#if party}
          <div class="confetti" aria-hidden="true">
            {#each bits as b, i (i)}<span style="left:{b.x}%; background:{b.c}; animation-delay:{b.d}s; --r:{b.r}deg"></span>{/each}
          </div>
        {/if}
      {/key}
    </div>
  </section>

  <aside class="side">
    <!-- The rating: before → after, the level and the way to the next -->
    <section class="card phero">
      <div class="hero-top">
        <span class="big-glyph" aria-hidden="true"><img src={lv.level.image} alt="" width="72" height="72" /></span>
        <div class="hero-num">
          <span class="label">Puzzle rating</span>
          <strong class="display num rating">{Math.round(shownRating.current)}</strong>
          <span class="lvl">{lv.level.name} level</span>
        </div>
        {#if change !== undefined}
          <div class="ba" aria-live="polite">
            <span class="num">{before}</span>
            <span class="arrow">→</span>
            <span class="num strong">{before + change}</span>
            <span class="delta num" class:up={change > 0} class:down={change < 0}>{change > 0 ? '▲' : change < 0 ? '▼' : '='} {Math.abs(change) || ''}</span>
          </div>
        {:else if current}
          <div class="ba wait"><span class="label">Solve it on the first try to go up</span></div>
        {/if}
      </div>
      <ol class="levels" aria-label="Levels">
        {#each PUZZLE_LEVELS as l (l.name)}
          <li class:reached={$puzzleRating >= l.from} class:here={l === lv.level} title="{l.name}{l.from ? ` from ${l.from}` : ''}"><img src={l.image} alt={l.name} width="30" height="30" loading="lazy" /></li>
        {/each}
      </ol>
      {#if lv.next}
        <div class="pmeter" role="progressbar" aria-valuenow={Math.round(lv.progress * 100)} aria-valuemin="0" aria-valuemax="100" aria-label="Progress to {lv.next.name}">
          <span style="width: {Math.round(lv.progress * 100)}%"></span>
        </div>
        <span class="label next-lv">{lv.next.from - $puzzleRating} points to <img src={lv.next.image} alt="" width="20" height="20" /><strong>{lv.next.name}</strong></span>
      {:else}
        <span class="label">The top level. Keep your crown!</span>
      {/if}
    </section>

    <!-- This puzzle: the clock, the stars, what next (and Professor Hoot, thinking with you or cheering) -->
    <section class="card pnow">
      {#if current}
        {#key `${round}-${result}`}
          <img class="buddy" class:cheer={result === true} src={result === true ? '/puzzles/hoot-cheer.webp' : '/puzzles/hoot-think.webp'} alt="" width="96" height="96" />
        {/key}
        <div class="now-top">
          {#if timerOn}
            {@const frac = result === undefined ? left / limit : 0}
            <div class="pclock" class:low={result === undefined && left <= 10} class:out={result === undefined && left === 0}>
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="19" class="track" />
                <circle cx="22" cy="22" r="19" class="fill" style="stroke-dasharray: {119.4 * frac} 119.4" />
              </svg>
              <span class="num">{result === undefined ? left : '✓'}</span>
            </div>
          {/if}
          <div class="stars" aria-label="{stars} stars for this puzzle">
            {#each [1, 2, 3] as n (n)}<span class="star" class:on={result !== undefined && stars >= n} style="animation-delay: {n * 0.15}s">★</span>{/each}
          </div>
          <span class="pill gold num">Puzzle {current[3]}</span>
        </div>
        {@const st = stageOf(current[3])}
        <div class="stage">
          <span class="stage-name" style="--c: {st.color}">{st.name} puzzle</span>
          <ol class="road" aria-label="From Beginner to Master">
            {#each STAGES as x (x.name)}<li class:done={ladder >= x.from} class:at={x === stageOf(ladder)} style="--c: {x.color}" title={x.name}></li>{/each}
          </ol>
        </div>
        {#if result === undefined}
          <p class="msg">{timerOn ? (left > 0 ? 'Find the best move before the clock runs out for a speed star!' : "Time's up, but keep going: you can still solve it!") : 'Find the best move, then keep finding them.'}</p>
          <p class="label small">⭐ solve it · ⭐ first try, no hint{timerOn ? ' · ⭐ before the clock ends' : ''}</p>
        {:else}
          <p class="msg" class:ok={result} class:bad={!result}>{result ? cheer(stars) : 'This one was tricky: watch the answer, then try the next.'}</p>
          {#if current[4].some((t) => !SKIP.has(t))}<p class="label">Theme: {current[4].filter((t) => !SKIP.has(t)).slice(0, 3).map(nameOf).join(', ')}</p>{/if}
        {/if}
        <button class="btn primary big" onclick={next} disabled={loading}>{result === undefined ? 'Skip to the next puzzle' : 'Next puzzle →'}</button>
        {#if result === undefined}<p class="label small">Skipping doesn't change your rating.</p>{/if}
      {:else if error}
        <button class="btn primary" onclick={next}>Try again</button>
      {/if}
      <label class="switch"><input type="checkbox" checked={timerOn} onchange={(e) => setTimer(e.currentTarget.checked)} /> Countdown timer</label>
    </section>

    <!-- Today: the goal, the streaks, the stars -->
    <section class="card ptoday">
      <div class="pgoal">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="27" class="track" />
          <circle cx="32" cy="32" r="27" class="fill" class:full={goalPct >= 1} style="stroke-dasharray: {169.6 * goalPct} 169.6" />
        </svg>
        <span class="goal-n num"><strong>{today.solved}</strong>/{$rewards.goal}</span>
      </div>
      <div class="goal-text">
        <strong>{goalPct >= 1 ? 'Daily goal done! 🎉' : "Today's goal"}</strong>
        <span class="label">{goalPct >= 1 ? 'Keep going for more stars.' : `${$rewards.goal - today.solved} more to go`}</span>
        <div class="chips goal-chips" role="group" aria-label="Daily goal">
          {#each [5, 10, 20] as g (g)}<button class="chip" aria-pressed={$rewards.goal === g} onclick={() => setGoal(g)}>{g}</button>{/each}
        </div>
      </div>
      <div class="pfacts">
        <span title="Puzzles in a row solved first try"><b>🔥 <span class="num">{$puzzleStats.streak}</span></b><span class="label">streak</span></span>
        <span title="Days in a row with a solved puzzle"><b>📅 <span class="num">{inRow}</span></b><span class="label">days</span></span>
        <span title="All the stars you earned"><b>⭐ <span class="num">{$rewards.stars}</span></b><span class="label">stars</span></span>
        <span title="Solved, of all tried"><b>✅ <span class="num">{$puzzleStats.solved}</span></b><span class="label">solved</span></span>
      </div>
      {#if tried}
        <p class="label visit">This visit: {solvedNow} of {tried} solved{visitStart !== undefined && $puzzleRating !== visitStart ? `, rating ${$puzzleRating > visitStart ? '+' : ''}${$puzzleRating - visitStart}` : ''}.</p>
      {/if}
    </section>

    <!-- Progress: the rating line and the last 7 days -->
    <section class="card charts">
      <h3 class="title h">Your progress</h3>
      {#if chart}
        <div class="line-wrap">
          <svg class="line" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Your puzzle rating over the last {chart.pts.length} puzzles">
            <path d="{chart.path} L100,100 L0,100 Z" class="area" />
            <path d={chart.path} class="stroke" vector-effect="non-scaling-stroke" />
          </svg>
          {#each chart.pts as p, i (i)}<span class="pdot" class:ok={p.ok} style="left:{p.x}%; top:{p.y}%"></span>{/each}
          <span class="axis hi num">{chart.hi}</span><span class="axis lo num">{chart.lo}</span>
        </div>
        <p class="label small">Your rating over the last {chart.pts.length} puzzles: green dots solved, red missed.</p>
      {:else}
        <p class="label">Solve a few puzzles to see your rating line here.</p>
      {/if}
      <div class="week" role="img" aria-label="Puzzles solved each day this week">
        {#each week as d (d.key)}
          <span class="pday">
            <span class="bar-wrap"><span class="wbar" class:ptoday={d === week.at(-1)} style="height: {(d.log.solved / weekMax) * 100}%"></span></span>
            <span class="num cnt">{d.log.solved || ''}</span>
            <span class="label dl">{d.label}</span>
          </span>
        {/each}
      </div>
    </section>

    <!-- Badges -->
    <section class="card badges">
      <h3 class="title h">Badges <span class="label num">{$rewards.badges.length}/{BADGES.length}</span></h3>
      <ul>
        {#each BADGES as b (b.id)}
          {@const got = $rewards.badges.includes(b.id)}
          <li class:got title={got ? b.name : `${b.name}: ${b.hint}`}>
            <span class="b-icon" aria-hidden="true">{b.icon}</span>
            <span class="b-name">{b.name}</span>
            {#if !got}<span class="b-hint">{b.hint}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  </aside>
</div>

{#if toast}
  <div class="toast" role="status">
    <span class="t-icon" aria-hidden="true">{toast.icon}</span>
    <span><span class="label">New badge!</span><strong>{toast.name}</strong></span>
  </div>
{/if}

<style>
  .rated {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
    align-items: flex-start;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 220px), 720px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .board-wrap {
    position: relative;
  }
  .placeholder {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    padding: 24px;
    text-align: center;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--muted);
  }
  .hud {
    display: none;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--border);
    font-weight: 800;
  }
  .hud-r {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 22px;
  }
  .hud-time {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--raised);
  }
  .hud-time.low {
    background: var(--loss);
    color: #fff;
  }
  .grow {
    flex: 1;
  }
  .side {
    flex: 1 1 320px;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .side :global(p) {
    margin: 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .phero {
    background: radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, var(--gold) 16%, transparent), var(--card) 65%);
    border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
  }
  .hero-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .big-glyph {
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--gold) 30%, transparent), transparent 70%);
  }
  .big-glyph img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
    animation: float 3s ease-in-out infinite;
  }
  @keyframes float {
    50% {
      transform: translateY(-4px);
    }
  }
  .hud-piece {
    width: 30px;
    height: 30px;
    object-fit: contain;
  }
  .next-lv {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .next-lv img {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }
  .hero-num {
    display: flex;
    flex-direction: column;
  }
  .rating {
    font-size: 44px;
    line-height: 1;
  }
  .lvl {
    font-weight: 800;
    color: var(--gold);
  }
  .ba {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--raised);
    font-size: 17px;
    animation: pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4);
  }
  .ba.wait {
    background: none;
    padding: 0;
    animation: none;
  }
  .ba .strong {
    font-weight: 900;
    font-size: 20px;
  }
  .arrow {
    color: var(--muted);
  }
  .delta {
    font-weight: 900;
    padding: 1px 7px;
    border-radius: 7px;
    color: var(--muted);
  }
  .delta.up {
    color: var(--win);
    background: color-mix(in srgb, var(--win) 16%, transparent);
  }
  .delta.down {
    color: var(--loss);
    background: color-mix(in srgb, var(--loss) 16%, transparent);
  }
  @keyframes pop {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
  }
  .levels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: space-between;
  }
  .levels li {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--raised);
    opacity: 0.45;
    filter: grayscale(0.85);
  }
  .levels li img {
    width: 30px;
    height: 30px;
    object-fit: contain;
  }
  .levels li.reached {
    opacity: 1;
    filter: none;
  }
  .levels li.here {
    background: radial-gradient(circle, color-mix(in srgb, var(--gold) 55%, transparent), var(--raised) 75%);
    transform: scale(1.2);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 35%, transparent);
  }
  .pmeter {
    height: 12px;
    border-radius: 999px;
    background: var(--raised);
    overflow: hidden;
  }
  .pmeter span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--gold), #ffd76a);
    transition: width 0.9s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  .pnow {
    position: relative;
    overflow: visible;
  }
  .stage {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .stage-name {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 800;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, transparent);
  }
  .road {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 4px;
  }
  .road li {
    width: 26px;
    height: 8px;
    border-radius: 999px;
    background: var(--raised);
  }
  .road li.done {
    background: var(--c);
  }
  .road li.at {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 45%, transparent);
  }
  .buddy {
    position: absolute;
    right: -8px;
    top: -46px;
    width: 96px;
    height: 96px;
    object-fit: contain;
    pointer-events: none;
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.4));
    animation: buddy-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4);
  }
  .buddy.cheer {
    animation:
      buddy-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4),
      hop 0.6s 0.5s ease-in-out 3;
  }
  @keyframes buddy-in {
    from {
      transform: scale(0.3) rotate(-15deg);
      opacity: 0;
    }
  }
  @keyframes hop {
    50% {
      transform: translateY(-10px);
    }
  }
  .now-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-right: 72px;
  }
  .pclock {
    position: relative;
    width: 56px;
    height: 56px;
    flex: none;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: 18px;
  }
  .pclock svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .pclock .track,
  .pgoal .track {
    fill: none;
    stroke: var(--raised);
    stroke-width: 5;
  }
  .pclock .fill {
    fill: none;
    stroke: var(--win);
    stroke-width: 5;
    stroke-linecap: round;
    transition: stroke-dasharray 0.25s linear;
  }
  .pclock.low .fill {
    stroke: var(--loss);
  }
  .pclock.low {
    color: var(--loss);
    animation: beat 1s ease-in-out infinite;
  }
  .pclock.out {
    animation: none;
  }
  @keyframes beat {
    50% {
      transform: scale(1.08);
    }
  }
  .stars {
    display: flex;
    gap: 2px;
    flex: 1;
  }
  .star {
    font-size: 30px;
    color: var(--raised);
    -webkit-text-stroke: 1px var(--border);
  }
  .star.on {
    color: #ffc107;
    -webkit-text-stroke: 0;
    animation: star 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.6) both;
    filter: drop-shadow(0 2px 6px rgba(255, 193, 7, 0.5));
  }
  @keyframes star {
    from {
      transform: scale(0) rotate(-90deg);
    }
  }
  .msg {
    font-weight: 700;
    font-size: 16px;
  }
  .ok {
    color: var(--win);
  }
  .bad {
    color: var(--loss);
  }
  .small {
    font-size: 13px;
  }
  .big {
    min-height: 48px;
    font-size: 16px;
  }
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--muted);
    cursor: pointer;
  }
  .ptoday {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 14px;
    align-items: center;
  }
  .pgoal {
    position: relative;
    width: 74px;
    height: 74px;
    display: grid;
    place-items: center;
  }
  .pgoal svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .pgoal .track {
    stroke-width: 7;
  }
  .pgoal .fill {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 7;
    stroke-linecap: round;
    transition: stroke-dasharray 0.8s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  .pgoal .fill.full {
    stroke: var(--win);
  }
  .goal-n {
    font-size: 15px;
  }
  .goal-n strong {
    font-size: 22px;
  }
  .goal-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .goal-chips {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .pfacts {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .pfacts > span {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    border-radius: 10px;
    background: var(--raised);
  }
  .pfacts b {
    font-size: 18px;
  }
  .visit {
    grid-column: 1 / -1;
  }
  .h {
    margin: 0;
    font-size: 17px;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .line-wrap {
    position: relative;
    height: 120px;
    margin: 4px 30px 0 0;
  }
  .line {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .area {
    fill: color-mix(in srgb, var(--series-1) 18%, transparent);
  }
  .stroke {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2.5;
  }
  .pdot {
    position: absolute;
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
    border-radius: 50%;
    background: var(--loss);
    border: 2px solid var(--card);
  }
  .pdot.ok {
    background: var(--win);
  }
  .axis {
    position: absolute;
    right: -30px;
    font-size: 11px;
    color: var(--muted);
  }
  .axis.hi {
    top: -4px;
  }
  .axis.lo {
    bottom: -4px;
  }
  .week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    align-items: end;
  }
  .pday {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .bar-wrap {
    height: 64px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .wbar {
    width: 70%;
    min-height: 4px;
    border-radius: 6px 6px 2px 2px;
    background: color-mix(in srgb, var(--series-1) 55%, var(--raised));
    transition: height 0.6s ease;
  }
  .wbar.ptoday {
    background: var(--gold);
  }
  .cnt {
    font-size: 12px;
    font-weight: 800;
    min-height: 14px;
  }
  .dl {
    font-size: 11px;
  }
  .badges ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 8px;
  }
  .badges li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border-radius: 12px;
    background: var(--raised);
    text-align: center;
    filter: grayscale(1);
    opacity: 0.55;
  }
  .badges li.got {
    filter: none;
    opacity: 1;
    background: color-mix(in srgb, var(--gold) 14%, var(--raised));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 45%, transparent);
  }
  .b-icon {
    font-size: 26px;
  }
  .b-name {
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
  }
  .b-hint {
    font-size: 10.5px;
    color: var(--muted);
    line-height: 1.2;
  }
  .confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .confetti span {
    position: absolute;
    top: 40%;
    width: 9px;
    height: 14px;
    border-radius: 2px;
    opacity: 0;
    animation: burst 1.6s cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
  }
  @keyframes burst {
    0% {
      opacity: 1;
      transform: translateY(0) rotate(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-160px) rotate(var(--r));
    }
    100% {
      opacity: 0;
      transform: translateY(260px) rotate(calc(var(--r) * 3));
    }
  }
  .toast {
    position: fixed;
    z-index: 90;
    left: 50%;
    top: 18px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-radius: 16px;
    background: var(--card);
    border: 2px solid var(--gold);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    animation: toast 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3);
  }
  .toast > span:last-child {
    display: flex;
    flex-direction: column;
  }
  .t-icon {
    font-size: 36px;
    animation: spin-in 0.8s ease-out;
  }
  @keyframes toast {
    from {
      transform: translate(-50%, -40px);
      opacity: 0;
    }
  }
  @keyframes spin-in {
    from {
      transform: rotate(-200deg) scale(0.3);
    }
  }
  @media (max-width: 900px) {
    .hud {
      display: flex;
    }
    .side {
      max-width: none;
    }
    .phero .big-glyph {
      width: 60px;
      height: 60px;
    }
    .phero .big-glyph img {
      width: 58px;
      height: 58px;
    }
    .rating {
      font-size: 36px;
    }
  }
  @media (max-width: 767px) {
    .toast {
      top: auto;
      bottom: 92px;
    }
    @keyframes toast {
      from {
        transform: translate(-50%, 40px);
        opacity: 0;
      }
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .confetti,
    .star.on,
    .buddy,
    .pclock.low,
    .ba,
    .toast,
    .t-icon {
      animation: none;
    }
    .confetti {
      display: none;
    }
  }
</style>

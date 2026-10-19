<script lang="ts">
  import { useFeature } from '$lib/plans';
  import { onDestroy, onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { POINTS, study } from '$lib/study/progress';
  import { gradeSprint, sprintQuestion, SPRINT_SECONDS, type SprintQuestion } from '$lib/vision/sprint';
  import { loadVision, saveVision, todayKey, type VisionRecord } from '$lib/vision/vision';
  import { sendSprint, sprintTicket } from '$lib/vision/api';

  let rec = $state<VisionRecord>({ rating: 1000, games: 0, solved: 0, bestSprint: 0, bestMemory: 0 });
  let phase = $state<'ready' | 'starting' | 'running' | 'done'>('ready');
  let seed = 0;
  let counted = false;
  let i = $state(0);
  let q = $state<SprintQuestion | undefined>();
  let answers: string[] = [];
  let left = $state(SPRINT_SECONDS);
  let flash = $state<'right' | 'wrong' | ''>('');
  let result = $state<{ score: number; right: number; wrong: number } | undefined>();
  let serverNote = $state('');
  let review = $state<{ q: SprintQuestion; a: string }[]>([]);
  let timer: ReturnType<typeof setInterval> | undefined;
  let ends = 0;

  onMount(() => (rec = loadVision()));
  onDestroy(() => clearInterval(timer));

  async function start() {
    // Each sprint counts towards the plan's Blindfold Gym sessions.
    if (!(await useFeature('vision'))) return;
    phase = 'starting';
    serverNote = '';
    // Signed in: the server hands out the seed, so the score can go on the leaderboard.
    const ticket = $session.status === 'in' ? await sprintTicket() : undefined;
    counted = ticket !== undefined;
    seed = ticket ?? crypto.getRandomValues(new Uint32Array(1))[0];
    answers = [];
    review = [];
    i = 0;
    q = sprintQuestion(seed, 0);
    left = SPRINT_SECONDS;
    ends = Date.now() + SPRINT_SECONDS * 1000;
    phase = 'running';
    timer = setInterval(() => {
      left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      if (left <= 0) void stop();
    }, 200);
  }

  function choose(a: string) {
    if (phase !== 'running' || !q) return;
    answers.push(a);
    const ok = a === q.answer;
    if (!ok) review = [...review, { q, a }];
    flash = ok ? 'right' : 'wrong';
    setTimeout(() => (flash = ''), 180);
    i++;
    q = sprintQuestion(seed, i);
  }

  function onkey(e: KeyboardEvent) {
    if (phase !== 'running' || !q) return;
    const n = Number(e.key);
    if (n >= 1 && n <= q.options.length) choose(q.options[n - 1]);
    else if (q.options.length === 2 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) choose(q.options[e.key === 'ArrowLeft' ? 0 : 1]);
  }

  async function stop() {
    if (phase !== 'running') return;
    clearInterval(timer);
    phase = 'done';
    result = gradeSprint(seed, answers);
    const day = todayKey();
    rec = {
      ...rec,
      bestSprint: Math.max(rec.bestSprint, result.score),
      sprintDay: day,
      sprintToday: rec.sprintDay === day ? Math.max(rec.sprintToday ?? 0, result.score) : result.score,
    };
    saveVision(rec);
    if (result.right) study.log('puzzle', Math.min(POINTS.puzzleSolved, result.score), `Vision Sprint ${result.score}`);
    if (counted) {
      try {
        const s = await sendSprint(seed, answers);
        if (s) serverNote = `On the leaderboard: best ${s.best}, today ${s.today}.`;
      } catch (e) {
        serverNote = e instanceof Error ? e.message : "The leaderboard couldn't be reached.";
      }
    }
  }
</script>

<svelte:head><title>Vision Sprint · Blindfold Gym · Chess Castles</title></svelte:head>
<svelte:window onkeydown={onkey} />

<div class="page">
  <a class="back" href="/vision"><Icon name="back" size={16} />Blindfold Gym</a>
  <header class="head">
    <div>
      <h1 class="display">Vision Sprint</h1>
      <p class="label">One minute, no board. Square colours, diagonals, knight jumps and what a piece attacks. +1 for a right answer, −1 for a wrong one.</p>
    </div>
    <div class="stat card"><span class="label">Your best</span><strong class="display num">{rec.bestSprint}</strong></div>
  </header>

  {#if phase === 'ready' || phase === 'starting'}
    <section class="card start">
      <p>Answer as many as you can in {SPRINT_SECONDS} seconds. Keys: 1, 2, 3… or ← → for two choices.</p>
      {#if $session.status !== 'in'}<p class="label"><button class="link" onclick={() => startSignIn()}>Sign in</button> to put your score on the leaderboard.</p>{/if}
      <button class="btn primary big" onclick={start} disabled={phase === 'starting'}><Icon name="play" size={18} fill color="currentColor" />Start</button>
    </section>
  {:else if phase === 'running' && q}
    <section class="card run" class:right={flash === 'right'} class:wrong={flash === 'wrong'}>
      <div class="top">
        <span class="timer display num" class:low={left <= 10}>{left}</span>
        <span class="label">Question {i + 1}</span>
      </div>
      <h2 class="question display">{q.text}</h2>
      <div class="options" class:many={q.options.length > 2}>
        {#each q.options as o, k (o)}
          <button class="opt" onclick={() => choose(o)}><span class="label">{k + 1}</span>{o}</button>
        {/each}
      </div>
    </section>
  {:else if result}
    <section class="card done">
      <span class="label">Your score</span>
      <strong class="display score num">{result.score}</strong>
      <p>{result.right} right, {result.wrong} wrong{result.score >= rec.bestSprint && result.score > 0 ? ' · a new best!' : ''}</p>
      {#if serverNote}<p class="label">{serverNote}</p>{/if}
      <div class="row">
        <button class="btn primary" onclick={start}><Icon name="replay" size={18} />Again</button>
        <a class="btn" href="/vision#leaders">Leaderboard</a>
      </div>
      {#if review.length}
        <h3 class="title">Your slips</h3>
        <ul class="review">
          {#each review.slice(0, 10) as r, k (k)}
            <li><span>{r.q.text}</span><span class="label">You: {r.a} · Right: <strong>{r.q.answer}</strong></span></li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 760px;
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
    max-width: 52ch;
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
  .start,
  .run,
  .done {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    text-align: center;
  }
  .start p,
  .done p {
    margin: 0;
  }
  .big {
    font-size: 18px;
    padding: 12px 28px;
  }
  .run {
    transition: box-shadow 0.15s;
  }
  .run.right {
    box-shadow: 0 0 0 3px var(--win);
  }
  .run.wrong {
    box-shadow: 0 0 0 3px var(--loss);
  }
  .top {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .timer {
    font-size: 40px;
    color: var(--gold);
  }
  .timer.low {
    color: var(--loss);
  }
  .question {
    margin: 0;
    font-size: clamp(24px, 4.4vw, 34px);
    line-height: 1.2;
    min-height: 2.4em;
    text-wrap: balance;
  }
  .options {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .options.many {
    grid-template-columns: repeat(3, 1fr);
  }
  .opt {
    font: inherit;
    font-size: 22px;
    font-weight: 700;
    padding: 18px 8px;
    border-radius: 14px;
    border: 2px solid var(--border);
    background: var(--raised);
    color: inherit;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .opt:hover {
    border-color: var(--brand);
  }
  .opt .label {
    font-size: 11px;
  }
  .score {
    font-size: 64px;
    color: var(--gold);
    line-height: 1;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .review {
    list-style: none;
    padding: 0;
    margin: 0;
    width: 100%;
    text-align: left;
  }
  .review li {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
</style>

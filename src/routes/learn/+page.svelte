<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { goto } from '$app/navigation';
  import { OPENINGS, type Opening } from '$lib/openings';
  import { addCustomOpening, customOpenings } from '$lib/customOpenings';
  import { requireGate } from '$lib/plans';
  import { dueCount, learnedCount, loadTree, userNodes, type OpeningTree } from '$lib/study/openingTree';
  import { course, loadPlan, nextStep, savePlan, topicOn, TOPICS, WEEKDAYS, type StudyPlan, type Topic } from '$lib/study/plan';
  import { reminderSupport, setReminders } from '$lib/study/reminders';
  import { loadCoach } from '$lib/coach/progress';
  import { loadWeeklyPlan, progressOf, saveWeeklyPlan, weekProgress, type WeeklyPlan } from '$lib/insights/plan';
  import {
    badges,
    bestStreak,
    dayOf,
    loadGoal,
    monthDays,
    monthPoints,
    saveGoal,
    streak,
    study,
    totalPoints,
    type Activity,
  } from '$lib/study/progress';

  let trees = $state<Record<string, OpeningTree | undefined>>({});
  let goal = $state(1000);
  let editingGoal = $state(false);
  let customs = $state<Opening[]>([]);
  let adding = $state(false);
  let newMoves = $state('');
  let newSide = $state<'white' | 'black'>('white');
  let addError = $state('');
  const allOpenings = $derived([...OPENINGS, ...customs]);
  const now = Date.now();
  let plan = $state<StudyPlan>({ days: ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'], time: '18:00', minutes: 30, remind: false, streakTime: '20:30' });
  let done = $state<Record<string, number>>({});
  let reminderNote = $state('');
  let reminderBusy = $state(false);
  let courseTab = $state<'middlegame' | 'endgame'>('middlegame');
  let guru = $state<WeeklyPlan | undefined>();

  onMount(() => {
    plan = loadPlan();
    done = loadCoach().done;
    guru = loadWeeklyPlan();
    goal = loadGoal();
    customs = customOpenings();
    trees = Object.fromEntries([...OPENINGS, ...customs].map((o) => [o.id, loadTree(o.id)]));
  });

  const KIND_COLOR: Record<Activity['kind'], string> = {
    trainer: 'var(--brand)',
    puzzle: 'var(--win)',
    game: 'var(--gold)',
    analysis: '#a9c8ff',
    lesson: '#b46cff',
  };
  const KIND_NAME: Record<Activity['kind'], string> = {
    trainer: 'Openings',
    puzzle: 'Puzzles',
    game: 'Games',
    analysis: 'Analysis',
    lesson: 'Lessons',
  };

  const today = new Date(now);
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthName = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const days = $derived(monthDays($study, year, month));
  const current = $derived(streak($study, now));
  const best = $derived(Math.max(bestStreak($study), current));
  const thisMonth = $derived(monthPoints($study, now));
  const points = $derived(totalPoints($study));
  const studiedToday = $derived($study.some((a) => dayOf(a.at) === dayOf(now)));
  const learnedOpenings = $derived(
    Object.values(trees).filter((t) => t && userNodes(t).length && learnedCount(t) === userNodes(t).length).length,
  );
  const allBadges = $derived(badges($study, now, learnedOpenings));

  const calendar = $derived.by(() => {
    const first = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const cells: { day?: number; kinds: Activity['kind'][]; today: boolean; future: boolean }[] = [];
    for (let i = 0; i < first; i++) cells.push({ kinds: [], today: false, future: false });
    for (let d = 1; d <= count; d++) {
      cells.push({ day: d, kinds: [...(days.get(d) ?? [])], today: d === today.getDate(), future: d > today.getDate() });
    }
    return cells;
  });

  const week = $derived.by(() =>
    Array.from({ length: 7 }, (_, i) => {
      const t = now - (6 - i) * 86_400_000;
      const d = new Date(t);
      return {
        label: i === 6 ? 'Today' : d.toLocaleString('en-IN', { weekday: 'short' }),
        done: $study.some((a) => dayOf(a.at) === dayOf(t)),
      };
    }),
  );

  const dueOpenings = $derived(
    allOpenings.map((o) => ({ o, t: trees[o.id] }))
      .filter((x) => x.t && dueCount(x.t, now) > 0)
      .map((x) => ({ ...x, due: dueCount(x.t!, now) })),
  );

  function addLine() {
    // Your own lines come with Premium and up.
    if (!requireGate('own_lines')) return;
    const r = addCustomOpening(newMoves, newSide);
    if (typeof r === 'string') {
      addError = r;
      return;
    }
    goto(`/learn/openings/${r.id}`);
  }

  const todayTopic = $derived(topicOn(plan, new Date(now)));
  const step = $derived.by(() => {
    void done;
    return nextStep(todayTopic);
  });
  const courses = $derived.by(() => {
    void done;
    return (['middlegame', 'endgame'] as const).map((cat) => {
      const lessons = course(cat);
      const sections = [...new Set(lessons.map((l) => l.section))].map((name) => ({ name, lessons: lessons.filter((l) => l.section === name) }));
      return { cat, lessons, sections, finished: lessons.filter((l) => done[l.id]).length };
    });
  });

  const todayKey = dayOf(now);
  const guruWeek = $derived(guru ? weekProgress(guru, $study) : 0);
  function tick(id: string) {
    if (!guru) return;
    guru = { ...guru, ticked: guru.ticked.includes(id) ? guru.ticked.filter((x) => x !== id) : [...guru.ticked, id] };
    saveWeeklyPlan(guru);
  }
  const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  async function changePlan(patch: Partial<StudyPlan>) {
    plan = { ...plan, ...patch, days: patch.days ?? [...plan.days] };
    savePlan(plan);
    if (plan.remind) {
      try {
        await setReminders(plan, current, $study);
      } catch {
        reminderNote = "The reminder couldn't be updated. Check your connection.";
      }
    }
  }

  function setDay(i: number, t: Topic) {
    const days = [...plan.days];
    days[i] = t;
    void changePlan({ days });
  }

  async function toggleReminders() {
    reminderBusy = true;
    reminderNote = '';
    try {
      const on = !plan.remind;
      const result = await setReminders({ ...plan, remind: on }, current, $study);
      plan = { ...plan, remind: result === 'on' };
      savePlan(plan);
      reminderNote =
        result === 'on'
          ? `Reminders on: at ${plan.time} on study days, and at ${plan.streakTime} if your streak is in danger.`
          : result === 'denied'
            ? 'Notifications are blocked for this site. Allow them in the browser settings (the lock icon next to the address), then try again.'
            : result === 'unsupported'
              ? 'This browser cannot show reminders. On iPhone, add Chess Castles to the Home Screen first (Share, then Add to Home Screen), or use the Chess Castles app.'
              : 'Reminders are off.';
    } catch {
      reminderNote = "Reminders couldn't be turned on right now. Try again in a moment.";
    } finally {
      reminderBusy = false;
    }
  }

  function setGoal(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    if (v >= 100 && v <= 20000) {
      goal = v;
      saveGoal(v);
    }
    editingGoal = false;
  }
</script>

<svelte:head><title>Learn · Chess Castles</title></svelte:head>

<div class="learn">
  <header class="head">
    <div>
      <span class="label">Learn</span>
      <h1 class="display">Study plan</h1>
    </div>
    <span class="head-acts">
      <a class="btn" href="/books"><Icon name="book" size={18} />Chess books</a>
      <a class="btn primary" href="/puzzles"><Icon name="puzzle" size={18} />Puzzle of the day</a>
    </span>
  </header>

  <div class="row">
    <section class="card plan-today" aria-labelledby="plan-today-h">
      <span class="label">Today · {WEEKDAYS[new Date(now).getDay()]}</span>
      <h2 id="plan-today-h" class="display plan-topic" style="color: {TOPICS[todayTopic].color}">{TOPICS[todayTopic].label}</h2>
      <p class="label">{todayTopic === 'rest' ? TOPICS.rest.about : `${plan.minutes} minutes at ${plan.time} · ${TOPICS[todayTopic].about}`}</p>
      <a class="task next" href={step.href}>
        <i style="background: {TOPICS[todayTopic].color}"></i>
        <span class="t-text"><strong>{step.title}</strong><span class="label">{step.sub}</span></span>
        <span class="btn primary small-btn">Start</span>
      </a>
      {#if !studiedToday && current > 0}
        <p class="streak-warn"><Icon name="flame" size={18} color="var(--gold)" /> You haven't studied today yet: do one thing to keep your {current}-day streak.</p>
      {/if}
    </section>

    <section class="card plan-edit" aria-labelledby="plan-h">
      <div class="spread">
        <h2 id="plan-h" class="title">Your daily study plan</h2>
        <button class="btn" class:primary={!plan.remind} disabled={reminderBusy || reminderSupport() === 'none'} onclick={toggleReminders}>
          <Icon name="bulb" size={16} />{plan.remind ? 'Reminders on' : 'Remind me'}
        </button>
      </div>
      <div class="days">
        {#each WEEKDAYS as d, i (d)}
          <label class="day" class:today={i === new Date(now).getDay()}>
            <span class="label">{d}</span>
            <select id="plan-day-{i}" value={plan.days[i]} onchange={(e) => setDay(i, (e.currentTarget as HTMLSelectElement).value as Topic)} style="border-color: {TOPICS[plan.days[i]].color}">
              {#each Object.entries(TOPICS) as [k, t] (k)}<option value={k}>{t.label}</option>{/each}
            </select>
          </label>
        {/each}
      </div>
      <div class="plan-row">
        <label><span class="label">Study at</span><input id="plan-time" type="time" value={plan.time} onchange={(e) => changePlan({ time: (e.currentTarget as HTMLInputElement).value || '18:00' })} /></label>
        <label><span class="label">For</span>
          <select id="plan-minutes" value={plan.minutes} onchange={(e) => changePlan({ minutes: Number((e.currentTarget as HTMLSelectElement).value) })}>
            {#each [15, 20, 30, 45, 60, 90] as m (m)}<option value={m}>{m} minutes</option>{/each}
          </select>
        </label>
        <label><span class="label">Streak reminder</span><input id="plan-streak-time" type="time" value={plan.streakTime} onchange={(e) => changePlan({ streakTime: (e.currentTarget as HTMLInputElement).value || '20:30' })} /></label>
      </div>
      {#if reminderNote}<p class="label note" role="status">{reminderNote}</p>{:else}<p class="label note">Turn on reminders to get a notification at your study time, and a warning in the evening before you lose your streak. The Chess Castles app reminds you on your phone too.</p>{/if}
    </section>
  </div>

  <section class="card guru" id="guru-plan" aria-labelledby="guru-h">
    {#if guru}
      <div class="spread">
        <div>
          <h2 id="guru-h" class="title">Guru's plan for your week</h2>
          <span class="label">From your games on {guru.source} · {Math.round(guruWeek * 100)}% done</span>
        </div>
        <a class="btn" href="/insights">See the analysis</a>
      </div>
      <div class="meter"><span style="width: {guruWeek * 100}%"></span></div>
      {#if guru.focus.length}
        <p class="label focus">Focus: {guru.focus.map((f) => f.title).join(' · ')}</p>
      {/if}
      <div class="g-days">
        {#each guru.days as d (d.day)}
          {@const isToday = d.day === todayKey}
          <div class="g-day" class:today={isToday} class:past={d.day < todayKey}>
            <span class="g-date">{isToday ? 'Today' : weekday(d.day)}</span>
            {#each d.tasks as t (t.id)}
              {@const pr = progressOf(t, d.day, guru, $study)}
              <div class="g-task" class:done={pr >= 1}>
                {#if t.kind === 'tip'}
                  <label class="g-tick"><input type="checkbox" checked={pr >= 1} onchange={() => tick(t.id)} /> <span>{t.title}</span></label>
                  <span class="label">{t.detail}</span>
                {:else}
                  <a href={t.href}><strong>{t.title}</strong></a>
                  <span class="label">{t.detail}</span>
                  <div class="g-bar"><span style="width: {pr * 100}%"></span></div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="spread">
        <div>
          <h2 id="guru-h" class="title">Let Guru plan your week</h2>
          <span class="label">Guru analyses your chess.com or Lichess games, finds what costs you points, and builds a plan with puzzles from your own mistakes.</span>
        </div>
        <a class="btn primary" href="/insights"><Icon name="analyse" size={18} />Analyse my games</a>
      </div>
    {/if}
  </section>

  <div class="row three">
    <section class="card" aria-labelledby="streak-h">
      <div class="streak-top">
        <span class="flame"><Icon name="flame" size={30} color="var(--gold)" /></span>
        <div>
          <h2 id="streak-h" class="display streak-n">{current} {current === 1 ? 'day' : 'days'}</h2>
          <span class="label">studied in a row · best {best}</span>
        </div>
      </div>
      <div class="week">
        {#each week as w (w.label)}
          <div class="wd">
            <span class="wbar" class:done={w.done} class:today={w.label === 'Today' && !w.done}></span>
            <span class="label">{w.label}</span>
          </div>
        {/each}
      </div>
      <p class="label note">{studiedToday ? 'Today counts. Come back tomorrow to keep it going.' : 'Do one puzzle, a trainer line or a game today to keep your streak.'}</p>
    </section>

    <section class="card" aria-labelledby="goal-h">
      <h2 id="goal-h" class="title">Monthly goal</h2>
      <div class="big-line">
        <span class="display big-num num">{thisMonth.toLocaleString('en-IN')}</span>
        {#if editingGoal}
          <label class="goal-edit">
            <span class="label">of</span>
            <input type="number" min="100" max="20000" step="100" value={goal} onchange={setGoal} onblur={setGoal} />
          </label>
        {:else}
          <button class="link" onclick={() => (editingGoal = true)}>of {goal.toLocaleString('en-IN')} points</button>
        {/if}
      </div>
      <div class="meter"><span style="width: {Math.min(100, (100 * thisMonth) / goal)}%"></span></div>
      <div class="legend">
        {#each Object.entries(KIND_NAME) as [k, name] (k)}
          <span><i style="background: {KIND_COLOR[k as Activity['kind']]}"></i>{name}</span>
        {/each}
      </div>
    </section>

    <section class="card" aria-labelledby="rewards-h">
      <div class="spread">
        <h2 id="rewards-h" class="title">Rewards</h2>
        <span class="pill gold">{points.toLocaleString('en-IN')} points</span>
      </div>
      <div class="badges">
        {#each allBadges as b (b.id)}
          <div class="badge" class:earned={b.earned} title={b.hint}>
            <span class="b-icon"><Icon name={b.earned ? 'trophy' : 'check'} size={20} color={b.earned ? 'var(--gold)' : 'var(--muted)'} /></span>
            <span class="b-name">{b.name}</span>
          </div>
        {/each}
      </div>
    </section>
  </div>

  <div class="row">
    <section class="card cal" aria-labelledby="cal-h">
      <div class="spread">
        <h2 id="cal-h" class="title">{monthName}</h2>
        <span class="label">Days you studied</span>
      </div>
      <div class="dow">
        {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as d (d)}<span>{d}</span>{/each}
      </div>
      <div class="grid">
        {#each calendar as c, i (i)}
          <div class="cell" class:empty={!c.day} class:studied={c.kinds.length > 0} class:today={c.today} class:future={c.future}>
            {#if c.day}
              <span class="d num">{c.day}</span>
              <span class="marks">
                {#each c.kinds as k (k)}<i style="background: {KIND_COLOR[k]}" title={KIND_NAME[k]}></i>{/each}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <section class="card today" aria-labelledby="today-h">
      <h2 id="today-h" class="title">Today</h2>
      {#if dueOpenings.length}
        {#each dueOpenings.slice(0, 4) as d (d.o.id)}
          <a class="task" href="/learn/openings/{d.o.id}">
            <i style="background: var(--brand)"></i>
            <span class="t-text"><strong>{d.o.name}</strong><span class="label">{d.due} {d.due === 1 ? 'position' : 'positions'} to review</span></span>
            <Icon name="chevron" size={18} color="var(--muted)" />
          </a>
        {/each}
      {:else}
        <p class="label">Nothing due. Start an opening below, or try today's puzzle.</p>
      {/if}
      <a class="task" href="/puzzles">
        <i style="background: var(--win)"></i>
        <span class="t-text"><strong>Puzzle of the day</strong><span class="label">+20 points</span></span>
        <Icon name="chevron" size={18} color="var(--muted)" />
      </a>
      <a class="task" href="/play">
        <i style="background: var(--gold)"></i>
        <span class="t-text"><strong>Play a FIDE-rated opponent</strong><span class="label">+10 points for a finished game</span></span>
        <Icon name="chevron" size={18} color="var(--muted)" />
      </a>
    </section>
  </div>

  <section aria-labelledby="courses-h" class="courses">
    <div class="spread">
      <h2 id="courses-h" class="title section-h">Courses with Guru</h2>
      <div class="segmented" role="group" aria-label="Course">
        <button aria-pressed={courseTab === 'middlegame'} onclick={() => (courseTab = 'middlegame')}>Middlegame</button>
        <button aria-pressed={courseTab === 'endgame'} onclick={() => (courseTab = 'endgame')}>Endgame</button>
      </div>
    </div>
    {#each courses.filter((c) => c.cat === courseTab) as c (c.cat)}
      <div class="course-head">
        <div class="meter"><span style="width: {(100 * c.finished) / Math.max(1, c.lessons.length)}%"></span></div>
        <span class="label">{c.finished} of {c.lessons.length} lessons finished · beginner to advanced · each lesson ends with practice against the engine</span>
      </div>
      {#each c.sections as sec (sec.name)}
        <h3 class="sec-h">{sec.name}</h3>
        <div class="l-grid">
          {#each sec.lessons as l (l.id)}
            <a class="l-card" class:done={done[l.id]} href="/coach/{l.id}">
              <span class="l-top"><span class="pill lvl">{l.level}</span>{#if done[l.id]}<Icon name="check" size={16} color="var(--win)" />{/if}</span>
              <span class="title l-name">{l.title}</span>
              <span class="label">{l.blurb}</span>
            </a>
          {/each}
        </div>
      {/each}
    {/each}
  </section>

  <section aria-labelledby="open-h" class="openings" id="openings">
    <div class="spread">
      <h2 id="open-h" class="title section-h">Opening trainer</h2>
      <span class="label">Built from strong players' games (2000+). Spaced repetition, three tries per move.</span>
    </div>
    <div class="o-grid">
      {#each allOpenings as o (o.id)}
        {@const t = trees[o.id]}
        {@const total = t ? userNodes(t).length : 0}
        {@const learned = t ? learnedCount(t) : 0}
        {@const due = t ? dueCount(t, now) : 0}
        <a class="o-card" href="/learn/openings/{o.id}">
          <span class="o-top">
            <span class="side {o.side}" title="You play {o.side}"></span>
            <span class="title o-name">{o.name}</span>
          </span>
          <span class="label o-sans">{o.sans}</span>
          {#if t}
            <span class="meter small"><span style="width: {total ? (100 * learned) / total : 0}%"></span></span>
            <span class="label">{learned}/{total} learned{due ? ` · ${due} due` : ''}</span>
          {:else}
            <span class="label start">Start learning <Icon name="chevron" size={14} /></span>
          {/if}
        </a>
      {/each}
      {#if adding}
        <form class="o-card add-form" onsubmit={(e) => (e.preventDefault(), addLine())}>
          <label class="field">
            <span class="title o-name">Your own line</span>
            <input type="text" bind:value={newMoves} placeholder="e4 e5 Nf3 Nc6 Bb5 a6" aria-label="Moves from the start" />
          </label>
          <div class="segmented" role="group" aria-label="Your side">
            <button type="button" aria-pressed={newSide === 'white'} onclick={() => (newSide = 'white')}>I play White</button>
            <button type="button" aria-pressed={newSide === 'black'} onclick={() => (newSide = 'black')}>I play Black</button>
          </div>
          {#if addError}<span class="add-error">{addError}</span>{/if}
          <button class="btn primary" type="submit">Add and train</button>
        </form>
      {:else}
        <button class="o-card add" onclick={() => (adding = true)}>
          <span class="title o-name">+ Add your own line</span>
          <span class="label">Type any moves and train them from the games database.</span>
        </button>
      {/if}
    </div>
  </section>
</div>

<style>
  .guru {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-color: var(--gold);
  }
  .focus {
    margin: 0;
  }
  .g-days {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: 10px;
  }
  .g-day {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 12px;
    background: var(--raised);
  }
  .g-day.today {
    outline: 2px solid var(--gold);
  }
  .g-day.past {
    opacity: 0.75;
  }
  .g-date {
    font-weight: 700;
    font-size: 14px;
  }
  .g-day.today .g-date {
    color: var(--gold);
  }
  .g-task {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .g-task a {
    color: var(--text);
  }
  .g-task.done a,
  .g-task.done .g-tick span {
    text-decoration: line-through;
    color: var(--win);
  }
  .g-task .label {
    font-size: 12.5px;
  }
  .g-bar {
    height: 6px;
    border-radius: 3px;
    background: var(--border);
    overflow: hidden;
  }
  .g-bar span {
    display: block;
    height: 100%;
    background: var(--win);
  }
  .g-tick {
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }
  .plan-today {
    flex: 1 1 300px;
  }
  .plan-edit {
    flex: 2 1 460px;
  }
  .plan-topic {
    font-size: 34px;
    margin: 0;
    line-height: 1.1;
  }
  .plan-today p {
    margin: 0;
  }
  .small-btn {
    padding: 6px 14px;
    min-height: 0;
  }
  .streak-warn {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 14px;
    color: var(--gold);
  }
  .days {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 8px;
  }
  .day {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .day.today .label {
    color: var(--gold);
    font-weight: 700;
  }
  .day select,
  .plan-row input,
  .plan-row select {
    font: inherit;
    font-size: 13.5px;
    padding: 6px 4px;
    border-radius: 8px;
    border: 2px solid var(--border);
    background: var(--raised);
    color: inherit;
    min-width: 0;
    width: 100%;
  }
  .plan-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .plan-row label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 130px;
  }
  .plan-edit .note {
    margin: 0;
  }
  .courses {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .course-head {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sec-h {
    margin: 10px 0 0;
    font-size: 16px;
  }
  .l-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
    gap: 10px;
  }
  .l-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    text-decoration: none;
  }
  .l-card:hover {
    outline: 1px solid var(--brand);
    text-decoration: none;
  }
  .l-card.done {
    border-color: color-mix(in srgb, var(--win) 50%, var(--border));
  }
  .l-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .l-name {
    font-size: 16px;
  }
  .l-card .label {
    font-size: 13px;
  }
  .lvl {
    font-size: 12px;
    text-transform: capitalize;
  }
  .learn {
    max-width: 1140px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 44px;
  }
  .row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  .row > .card {
    flex: 1 1 280px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row .cal {
    flex: 3 1 520px;
  }
  .row .today {
    flex: 2 1 300px;
  }
  .spread {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .title {
    font-size: 19px;
  }
  .streak-top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .flame {
    width: 54px;
    height: 54px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: var(--gold-soft);
  }
  .streak-n {
    font-size: 38px;
    color: var(--gold);
  }
  .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
    text-align: center;
  }
  .wd .label {
    font-size: 12px;
  }
  .wbar {
    display: block;
    height: 26px;
    border-radius: 8px;
    background: var(--raised);
    margin-bottom: 4px;
  }
  .wbar.done {
    background: var(--gold);
  }
  .wbar.today {
    border: 2px dashed var(--gold);
    background: transparent;
  }
  .note {
    margin: 0;
  }
  .big-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .big-num {
    font-size: 40px;
  }
  .link {
    background: none;
    border: 0;
    color: var(--muted);
    cursor: pointer;
    text-decoration: underline dotted;
    padding: 0;
  }
  .goal-edit {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .goal-edit input {
    width: 96px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 8px;
    font: inherit;
  }
  .meter {
    height: 10px;
    border-radius: 5px;
    background: var(--raised);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--brand);
    border-radius: 5px;
    transition: width 0.4s;
  }
  .meter.small {
    height: 6px;
  }
  .legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--text-2);
  }
  .legend i,
  .marks i,
  .task i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 6px;
  }
  .badges {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    border-radius: var(--r-control);
    border: 1px dashed var(--border);
    text-align: center;
  }
  .badge.earned {
    border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
    background: var(--gold-soft);
  }
  .b-name {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-2);
  }
  .badge.earned .b-name {
    color: var(--text);
  }
  .dow,
  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .dow {
    text-align: center;
    font-size: 12px;
    color: var(--muted);
  }
  .cell {
    min-height: 58px;
    border-radius: 12px;
    padding: 6px 8px;
    border: 1px dashed var(--border);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .cell.empty {
    border: 0;
  }
  .cell.studied {
    background: var(--raised);
    border-style: solid;
  }
  .cell.today {
    border: 1.5px solid var(--brand);
    background: color-mix(in srgb, var(--brand) 18%, transparent);
  }
  .cell.future .d {
    color: var(--muted);
  }
  .d {
    font-family: var(--font-title);
    font-weight: 700;
  }
  .marks {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .marks i {
    width: 12px;
    height: 5px;
    margin: 0;
  }
  .task {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--raised);
    color: var(--text);
    text-decoration: none;
  }
  .task:hover {
    outline: 1px solid var(--brand);
    text-decoration: none;
  }
  .task i {
    width: 6px;
    align-self: stretch;
    height: auto;
    margin: 0;
  }
  .t-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .openings {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .section-h {
    font-size: 24px;
  }
  .o-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }
  .o-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border-radius: var(--r-card);
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .o-card:hover {
    border-color: var(--brand);
    transform: translateY(-1px);
    text-decoration: none;
  }
  .o-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .o-name {
    font-size: 17px;
  }
  .side {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid var(--muted);
    flex: none;
  }
  .side.white {
    background: #eef3ff;
  }
  .side.black {
    background: #0e1525;
  }
  .o-sans {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .add {
    border-style: dashed;
    text-align: left;
    cursor: pointer;
  }
  .add-form {
    gap: 10px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field input {
    height: 42px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 10px;
    font: inherit;
  }
  .add-error {
    color: var(--loss);
    font-size: 13px;
  }
  .start {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
    font-weight: 600;
  }
  @media (max-width: 767px) {
    h1 {
      font-size: 36px;
    }
    .cell {
      min-height: 44px;
      padding: 4px 5px;
    }
  }
  .head-acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>

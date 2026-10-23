<script lang="ts">
  import { onMount } from 'svelte';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { CATALOG } from '$lib/coach/catalog';
  import type { LessonEntry } from '$lib/coach/types';
  import { OPENINGS, type Opening } from '$lib/openings';
  import { addCustomOpening, customOpenings } from '$lib/customOpenings';
  import { requireGate } from '$lib/plans';
  import { dueCount, learnedCount, loadTree, userNodes, type OpeningTree } from '$lib/study/openingTree';
  import { course, loadPlan, nextStep, savePlan, topicOn, TOPICS, WEEKDAYS, type StudyPlan, type Topic } from '$lib/study/plan';
  import { reminderSupport, setReminders } from '$lib/study/reminders';
  import { loadCoach } from '$lib/coach/progress';
  import { LEGENDS } from '$lib/coach/content/legends';
  import { TEACHERS } from '$lib/masters/content';
  import TeacherBadge from '$lib/masters/TeacherBadge.svelte';
  import { STUDY_OPENINGS } from '$lib/study/openingStudy';
  import { loadInsights } from '$lib/insights/store';
  import { isWeak, studyStats, type StudyLineStat } from '$lib/study/fromGames';
  import OpeningCheckup from '$lib/study/OpeningCheckup.svelte';
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
  /** Study lines the player keeps losing in (from the games imported for Insights). */
  let studyWeak = $state<StudyLineStat[]>([]);
  const now = Date.now();
  let plan = $state<StudyPlan>({ days: ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'], time: '18:00', minutes: 30, remind: false, streakTime: '20:30' });
  let done = $state<Record<string, number>>({});
  let reminderNote = $state('');
  let reminderBusy = $state(false);
  let guru = $state<WeeklyPlan | undefined>();

  onMount(() => {
    const ins = loadInsights();
    if (ins) studyWeak = studyStats(ins.games).filter(isWeak);
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
  // The page in tabs: a map of everything (Start), then one tab per part of
  // the game, and the player's own plan. The tab is in the address
  // (?tab=openings&sub=trainer), so links can open it; old links used
  // #openings (the trainer) and #guru-plan.
  type Tab = 'start' | 'openings' | 'tactics' | 'strategy' | 'endgames' | 'plan';
  type Sub = 'mine' | 'courses' | 'lessons' | 'trainer' | 'players';
  const TABS: { id: Tab; label: string; icon: IconName; color: string; what: string }[] = [
    { id: 'start', label: 'Start', icon: 'home', color: 'var(--brand)', what: 'Everything you can learn here, in one place.' },
    { id: 'openings', label: 'Openings', icon: 'tree', color: 'var(--series-1)', what: 'How to begin a game: the first moves, and the ideas behind them.' },
    { id: 'tactics', label: 'Tactics', icon: 'puzzle', color: 'var(--win)', what: 'Tricks that win pieces, and pictures of checkmate to remember.' },
    { id: 'strategy', label: 'Strategy', icon: 'bulb', color: '#b46cff', what: 'The middle of the game: where your pieces and pawns belong, and how to make a plan.' },
    { id: 'endgames', label: 'Endgames', icon: 'crown', color: 'var(--gold)', what: 'The end of the game: how to turn a small advantage into a win, and how to save a draw.' },
    { id: 'plan', label: 'My plan', icon: 'flame', color: 'var(--gold)', what: 'What to study each day, your streak, your goal for the month and your rewards.' },
  ];
  const SUBS: { id: Sub; label: string; what: string }[] = [
    { id: 'mine', label: 'Your games', what: 'Your opening check-up: the lines where your results drop in your own games, and how to fix each one.' },
    { id: 'courses', label: 'Courses', what: 'Full courses for one opening: every line, the plans, model games, puzzles, and games against FIDE-level opponents from the line.' },
    { id: 'lessons', label: 'Lessons', what: 'Short lessons with Guru about the ideas of each opening, from the first rules to grandmaster openings.' },
    { id: 'trainer', label: 'Trainer', what: 'Learn the moves by heart: you play your side, and lines come back until you know them.' },
    { id: 'players', label: 'Great players', what: 'Train the openings great players chose in their own tournament games.' },
  ];
  const tab = $derived.by((): Tab => {
    const q = page.url.searchParams.get('tab');
    if (TABS.some((t) => t.id === q)) return q as Tab;
    const h = page.url.hash.slice(1);
    return h === 'openings' ? 'openings' : h === 'guru-plan' ? 'plan' : 'start';
  });
  const sub = $derived.by((): Sub => {
    const q = page.url.searchParams.get('sub');
    if (SUBS.some((s) => s.id === q)) return q as Sub;
    return page.url.hash === '#openings' ? 'trainer' : 'mine';
  });
  function show(t: Tab, s?: Sub) {
    const u = new URL(page.url);
    u.searchParams.set('tab', t);
    if (s) u.searchParams.set('sub', s);
    else u.searchParams.delete('sub');
    u.hash = '';
    void goto(u, { replaceState: true, noScroll: true, keepFocus: true });
  }

  type Level = 'all' | 'beginner' | 'intermediate' | 'advanced';
  const LEVELS: { id: Level; label: string }[] = [
    { id: 'all', label: 'All levels' },
    { id: 'beginner', label: 'Beginner' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'advanced', label: 'Advanced' },
  ];
  let level = $state<Level>('all');
  /** Guru's lessons for each tab, in their sections. */
  const groups = $derived.by(() => {
    void done;
    const sectionsOf = (cat: 'opening' | 'middlegame' | 'endgame', only?: string[]) => {
      const lessons = course(cat).filter((l) => !only || only.includes(l.section));
      return [...new Set(lessons.map((l) => l.section))].map((name) => ({ name, lessons: lessons.filter((l) => l.section === name) }));
    };
    return {
      openings: sectionsOf('opening'),
      tactics: sectionsOf('middlegame', ['Basics', 'Tactics', 'Checkmate patterns']),
      strategy: sectionsOf('middlegame', ['Strategy']),
      endgames: sectionsOf('endgame'),
    };
  });
  const countOf = (secs: { lessons: LessonEntry[] }[]) => {
    const all = secs.flatMap((s) => s.lessons);
    return { total: all.length, finished: all.filter((l) => done[l.id]).length };
  };
  const tabProgress = (t: Tab) => (t === 'openings' || t === 'tactics' || t === 'strategy' || t === 'endgames' ? countOf(groups[t]) : undefined);
  /** What each section is about, in a few words. */
  const SECTION_WHAT: Record<string, string> = {
    'Opening basics': 'Start here: the golden rules of the opening, and the traps to avoid.',
    'Open games (1.e4 e5)': "Both sides push the king's pawn two squares: open, lively games.",
    'Sicilian Defence': 'Black answers 1.e4 with ...c5: sharp fights on both sides of the board.',
    'Other answers to 1.e4': 'The French, the Caro-Kann, the Scandinavian and more.',
    "Queen's pawn openings": 'Games that start 1.d4 d5: the Queen’s Gambit, the Slav, the London and more.',
    'Indian defences': 'Black answers 1.d4 with ...Nf6 and fights for the centre from a distance.',
    'Flank openings': 'White starts on the side of the board: 1.c4, 1.Nf3 or 1.f4.',
    Basics: 'Start here: what each piece is worth, and how to keep yours safe.',
    Tactics: 'Tricks that win pieces: forks, pins, skewers and more.',
    'Checkmate patterns': 'Pictures of checkmate to remember, so you spot them in your games.',
    Strategy: 'Strong squares for your pieces, open files for your rooks, and passed pawns.',
    'Basic checkmates': 'Start here: checkmate with a queen or a rook against a lone king.',
    'Pawn endgames': 'Kings and pawns only: the opposition, the square of the pawn and more.',
    'Rook endgames': 'The endgames that come up most often: the Lucena and Philidor positions and more.',
    'Advanced endgames': 'For strong players: bishop and knight mate, queen against rook and more.',
  };
  const TILE_HAS = $derived<Record<Tab, string>>({
    start: '',
    openings: `${STUDY_OPENINGS.length} full courses · ${countOf(groups.openings).total} lessons · ${allOpenings.length} openings to practise`,
    tactics: `${countOf(groups.tactics).total} lessons · puzzles · Blindfold Gym`,
    strategy: `${countOf(groups.strategy).total} lessons · plans from master games`,
    endgames: `${countOf(groups.endgames).total} lessons · endgames from masters' games`,
    plan: `${current} ${current === 1 ? 'day' : 'days'} in a row · ${thisMonth.toLocaleString('en-IN')} points this month`,
  });
  /** Three ways in, by how much chess the player knows. */
  const PATHS = $derived.by(() => {
    void done;
    const lesson = (title: string, what: string) => {
      const l = CATALOG.find((x) => x.title === title);
      return { title, what, href: l ? `/coach/${l.id}` : '/coach', done: !!(l && done[l.id]) };
    };
    return [
      { who: "I'm new to chess", steps: [lesson('Piece values and good trades', 'Tactics · Basics'), lesson('Checkmate with king and queen', 'Endgames · Basic checkmates'), lesson('Opening principles', 'Openings · Lessons')] },
      { who: 'I play games and want to win more', steps: [lesson('Knight forks', 'Tactics'), lesson('Back-rank mate', 'Tactics · Checkmate patterns'), lesson('The opposition', 'Endgames · Pawn endgames')] },
      {
        who: 'I play tournaments',
        steps: [
          { title: 'A full opening course', what: 'Openings · Courses', href: '/learn?tab=openings&sub=courses', done: false },
          { title: "Endgames from masters' games", what: 'Endgames', href: '/learn/masters', done: false },
          lesson('The Lucena position: building a bridge', 'Endgames · Rook endgames'),
        ],
      },
    ];
  });
  const dueTotal = $derived(dueOpenings.reduce((s, d) => s + d.due, 0));
  import EarnHint from '$lib/economy/EarnHint.svelte';
</script>

<svelte:head><title>Learn · Chess Castles</title></svelte:head>

{#snippet lessonCards(secs: { name: string; lessons: LessonEntry[] }[])}
  {@const c = countOf(secs)}
  <div class="course-head">
    <div class="spread">
      <span class="label">{c.finished} of {c.total} lessons finished · each lesson ends with practice against the engine</span>
      <div class="lv" role="group" aria-label="Level">
        {#each LEVELS as l (l.id)}<button class="chip" aria-pressed={level === l.id} onclick={() => (level = l.id)}>{l.label}</button>{/each}
      </div>
    </div>
    <div class="meter"><span style="width: {(100 * c.finished) / Math.max(1, c.total)}%"></span></div>
  </div>
  {#each secs as sec (sec.name)}
    {@const shown = sec.lessons.filter((l) => level === 'all' || l.level === level)}
    {#if shown.length}
      <div class="sec">
        <h3 class="sec-h">{sec.name}</h3>
        {#if SECTION_WHAT[sec.name]}<p class="label">{SECTION_WHAT[sec.name]}</p>{/if}
      </div>
      <div class="l-grid">
        {#each shown as l (l.id)}
          <a class="l-card" class:done={done[l.id]} href="/coach/{l.id}">
            <span class="l-top"><span class="pill lvl {l.level}">{l.level}</span>{#if done[l.id]}<span class="done-tag"><Icon name="check" size={14} color="var(--win)" />Done</span>{/if}</span>
            <span class="title l-name">{l.title}</span>
            <span class="label">{l.blurb}</span>
          </a>
        {/each}
      </div>
    {/if}
  {/each}
  {#if secs.every((s) => !s.lessons.some((l) => level === 'all' || l.level === level))}
    <p class="label">No {level} lessons here. <button class="link" onclick={() => (level = 'all')}>Show every level</button></p>
  {/if}
{/snippet}

{#snippet tabHead(t: (typeof TABS)[number])}
  <header class="tab-head">
    <span class="tab-icon" style="--c: {t.color}"><Icon name={t.icon} size={26} color={t.color} /></span>
    <div>
      <h2 class="display">{t.label}</h2>
      <p>{t.what}</p>
    </div>
  </header>
{/snippet}

<div class="learn">
  <header class="head">
    <div>
      <h1 class="display">Learn</h1>
      <p class="label lead">Pick what you want to get better at. Every lesson ends with practice on the board.</p>
    </div>
    <span class="head-acts">
      <a class="btn" href="/books"><Icon name="book" size={18} />Chess books</a>
      <a class="btn primary" href="/puzzles"><Icon name="puzzle" size={18} />Rated puzzles</a>
    </span>
  </header>
  <EarnHint kinds={['lesson', 'line', 'review']} />

  {#if tab !== 'plan'}
    <section class="today-bar card" aria-label="Today">
      <button class="tb-streak" onclick={() => show('plan')} title="Your streak: days studied in a row">
        <Icon name="flame" size={22} color="var(--gold)" /><strong class="display num">{current}</strong><span class="label">{current === 1 ? 'day' : 'days'} in a row</span>
      </button>
      <span class="tb-task">
        <span class="label">Today · <span style="color: {TOPICS[todayTopic].color}">{TOPICS[todayTopic].label}</span></span>
        <strong>{step.title}</strong>
      </span>
      {#if dueTotal}
        <a class="tb-due" href="/learn/openings/{dueOpenings[0].o.id}"><Icon name="replay" size={16} />{dueTotal} {dueTotal === 1 ? 'move' : 'moves'} to review</a>
      {/if}
      <a class="btn primary small-btn" href={step.href}>Start</a>
    </section>
    {#if !studiedToday && current > 0}
      <p class="streak-warn"><Icon name="flame" size={18} color="var(--gold)" /> You haven't studied today yet: do one thing to keep your {current}-day streak.</p>
    {/if}
  {/if}

  <nav class="tabs" aria-label="What to learn">
    {#each TABS as t (t.id)}
      <button class="tab" style="--c: {t.color}" aria-pressed={tab === t.id} onclick={() => show(t.id)}>
        <Icon name={t.icon} size={20} color={tab === t.id ? t.color : 'currentColor'} /><span>{t.label}</span>
      </button>
    {/each}
  </nav>

  {#if tab === 'start'}
    <section class="pane" aria-label="Everything you can learn">
      <h2 class="title section-h">What do you want to learn?</h2>
      <div class="tiles">
        {#each TABS.filter((t) => t.id !== 'start') as t (t.id)}
          {@const p = tabProgress(t.id)}
          <button class="tile" style="--c: {t.color}" onclick={() => show(t.id)}>
            <span class="tile-icon"><Icon name={t.icon} size={30} color={t.color} /></span>
            <span class="title tile-name">{t.label}</span>
            <span class="tile-what">{t.what}</span>
            <span class="label tile-has">{TILE_HAS[t.id]}</span>
            {#if p}
              <span class="meter small"><span style="width: {(100 * p.finished) / Math.max(1, p.total)}%; background: {t.color}"></span></span>
              <span class="label">{p.finished} of {p.total} lessons done</span>
            {/if}
            <span class="tile-go">Open <Icon name="chevron" size={14} /></span>
          </button>
        {/each}
      </div>

      <h2 class="title section-h">Not sure where to start?</h2>
      <div class="paths">
        {#each PATHS as path (path.who)}
          <div class="path card">
            <span class="title path-who">{path.who}</span>
            <ol>
              {#each path.steps as s, i (s.title)}
                <li>
                  <a class="path-step" class:done={s.done} href={s.href}>
                    <span class="step-n num">{#if s.done}<Icon name="check" size={14} />{:else}{i + 1}{/if}</span>
                    <span class="step-text"><strong>{s.title}</strong><span class="label">{s.what}</span></span>
                  </a>
                </li>
              {/each}
            </ol>
          </div>
        {/each}
      </div>
    </section>
  {:else if tab === 'openings'}
    <section class="pane" aria-label="Openings">
      {@render tabHead(TABS[1])}
      <div class="segmented subs" role="group" aria-label="Openings">
        {#each SUBS as s (s.id)}<button aria-pressed={sub === s.id} onclick={() => show('openings', s.id)}>{s.label}</button>{/each}
      </div>
      <p class="sub-what">{SUBS.find((s) => s.id === sub)?.what}</p>

      {#if sub === 'mine'}
        <OpeningCheckup />
      {:else if sub === 'courses'}
        <div class="s-grid">
          {#each STUDY_OPENINGS as o (o.id)}
            {@const weakLine = studyWeak.find((x) => x.opening === o.id)}
            <a class="s-card" href={weakLine ? `/learn/study/${o.id}?line=${weakLine.line}&tab=games` : `/learn/study/${o.id}`}>
              <span class="side {o.side}" title="You play {o.side}"></span>
              <span class="s-text">
                <span class="title s-name">{o.name}</span>
                <span class="label">For {o.side === 'white' ? 'White' : 'Black'} · {o.lines.length} lines{o.games ? ` · ${o.games.toLocaleString('en-IN')} games` : ''}</span>
                {#if weakLine}
                  <span class="label weak-note">From your games: {weakLine.losses} losses in the {o.lines.find((l) => l.id === weakLine.line)?.name ?? 'other lines'}</span>
                {:else}
                  <span class="label">Lines and plans · trainer · model games · puzzles · play it</span>
                {/if}
              </span>
              <Icon name="chevron" size={16} color="var(--muted)" />
            </a>
          {/each}
        </div>
      {:else if sub === 'lessons'}
        {@render lessonCards(groups.openings)}
      {:else if sub === 'trainer'}
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
      {:else}
        <div class="players">
          {#each TEACHERS as t (t.id)}
            <div class="player">
              <TeacherBadge id={t.id} group={t.group} size={40} />
              <span class="p-name">{LEGENDS[t.id]?.name ?? t.id}</span>
              <span class="p-sides">
                <a class="chip" href="/learn/openings/m-{t.id}-white"><span class="side white"></span>White</a>
                <a class="chip" href="/learn/openings/m-{t.id}-black"><span class="side black"></span>Black</a>
              </span>
            </div>
          {/each}
        </div>
        <p class="label small-note">The moves come from each player's own tournament games. Chess Castles is not affiliated with, sponsored or endorsed by any of them.</p>
      {/if}
    </section>
  {:else if tab === 'tactics'}
    <section class="pane" aria-label="Tactics">
      {@render tabHead(TABS[2])}
      <div class="extras">
        <a class="extra" href="/puzzles"><Icon name="puzzle" size={22} color="var(--win)" /><span><strong>Puzzles</strong><span class="label">A new puzzle every day, and puzzles at your level</span></span></a>
        <a class="extra" href="/puzzles/themes"><Icon name="star" size={22} color="var(--win)" /><span><strong>Puzzles by theme</strong><span class="label">Only forks, only pins, only mates: practise one trick at a time</span></span></a>
        <a class="extra" href="/vision"><Icon name="eye" size={22} color="var(--win)" /><span><strong>Blindfold Gym</strong><span class="label">See the board faster: squares, checks and captures</span></span></a>
      </div>
      {@render lessonCards(groups.tactics)}
    </section>
  {:else if tab === 'strategy'}
    <section class="pane" aria-label="Strategy">
      {@render tabHead(TABS[3])}
      {@render lessonCards(groups.strategy)}
      <div class="sec">
        <h3 class="sec-h">Plans from master games</h3>
        <p class="label">Follow a master game from the end of the opening: find the moves the strong side played, and Guru explains the plan behind each one.</p>
      </div>
      <div class="s-grid">
        {#each STUDY_OPENINGS as o (o.id)}
          <a class="s-card" href="/learn/study/{o.id}?tab=middlegame">
            <span class="side {o.side}"></span>
            <span class="s-text"><span class="title s-name">{o.name}</span><span class="label">Middlegame lessons for {o.side === 'white' ? 'White' : 'Black'}</span></span>
            <Icon name="chevron" size={16} color="var(--muted)" />
          </a>
        {/each}
      </div>
    </section>
  {:else if tab === 'endgames'}
    <section class="pane" aria-label="Endgames">
      {@render tabHead(TABS[4])}
      <section aria-labelledby="masters-h" class="masters card">
        <div class="m-text">
          <h3 id="masters-h" class="title section-h">Learn endgames from masters' games</h3>
          <p class="label">Real endgames from tournament games of great players, past and present: you play one side, find the moves that were played, and Guru explains every idea.</p>
          <a class="btn primary" href="/learn/masters"><Icon name="crown" size={18} />Pick your favourite master</a>
        </div>
        <div class="m-faces" aria-hidden="true">
          {#each TEACHERS.slice(0, 8) as t (t.id)}<TeacherBadge id={t.id} group={t.group} size={46} />{/each}
        </div>
      </section>
      {@render lessonCards(groups.endgames)}
    </section>
  {:else}
    <section class="pane" aria-label="My plan">
      {@render tabHead(TABS[5])}
      <div class="row">
        <section class="card plan-today" aria-labelledby="plan-today-h">
          <span class="label">Today · {WEEKDAYS[new Date(now).getDay()]}</span>
          <h3 id="plan-today-h" class="display plan-topic" style="color: {TOPICS[todayTopic].color}">{TOPICS[todayTopic].label}</h3>
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
            <h3 id="plan-h" class="title">Your daily study plan</h3>
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
              <h3 id="guru-h" class="title">Guru's plan for your week</h3>
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
              <h3 id="guru-h" class="title">Let Guru plan your week</h3>
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
              <h3 id="streak-h" class="display streak-n">{current} {current === 1 ? 'day' : 'days'}</h3>
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
          <h3 id="goal-h" class="title">Monthly goal</h3>
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
            <h3 id="rewards-h" class="title">Rewards</h3>
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
            <h3 id="cal-h" class="title">{monthName}</h3>
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
          <h3 id="today-h" class="title">To review</h3>
          {#if dueOpenings.length}
            {#each dueOpenings.slice(0, 4) as d (d.o.id)}
              <a class="task" href="/learn/openings/{d.o.id}">
                <i style="background: var(--brand)"></i>
                <span class="t-text"><strong>{d.o.name}</strong><span class="label">{d.due} {d.due === 1 ? 'position' : 'positions'} to review</span></span>
                <Icon name="chevron" size={18} color="var(--muted)" />
              </a>
            {/each}
          {:else}
            <p class="label">Nothing due. Start an opening in the Openings tab, or try today's puzzle.</p>
          {/if}
          <a class="task" href="/puzzles">
            <i style="background: var(--win)"></i>
            <span class="t-text"><strong>Puzzle of the day</strong><span class="label">+20 points</span></span>
            <Icon name="chevron" size={18} color="var(--muted)" />
          </a>
          <a class="task" href="/play">
            <i style="background: var(--gold)"></i>
            <span class="t-text"><strong>Play a FIDE-level opponent</strong><span class="label">+10 points for a finished game</span></span>
            <Icon name="chevron" size={18} color="var(--muted)" />
          </a>
        </section>
      </div>
    </section>
  {/if}
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
  .s-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 12px;
  }
  .s-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--r-card);
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
  }
  .s-card:hover {
    border-color: var(--brand);
    text-decoration: none;
  }
  .s-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .s-name {
    font-size: 18px;
  }
  .weak-note {
    color: var(--loss);
  }
  .masters {
    display: flex;
    gap: 20px;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    flex-wrap: wrap;
  }
  .m-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
    flex: 1 1 320px;
    min-width: 0;
  }
  .m-text .section-h {
    margin: 0;
  }
  .m-text p {
    margin: 0;
    line-height: 1.5;
    max-width: 620px;
  }
  .m-faces {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-width: 230px;
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
  .lead {
    margin: 4px 0 0;
    font-size: 15px;
  }
  .today-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    flex-wrap: wrap;
  }
  .tb-streak {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 0;
    border-radius: 12px;
    background: var(--gold-soft);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .tb-streak strong {
    font-size: 24px;
    color: var(--gold);
  }
  .tb-task {
    display: flex;
    flex-direction: column;
    flex: 1 1 200px;
    min-width: 0;
  }
  .tb-due {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }
  .tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 2px 6px;
    scrollbar-width: thin;
  }
  .tab {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-2);
    font: inherit;
    font-family: var(--font-title);
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
  }
  .tab:hover {
    border-color: var(--c);
    color: var(--text);
  }
  .tab[aria-pressed='true'] {
    color: var(--text);
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, var(--card));
    box-shadow: inset 0 -3px 0 var(--c);
  }
  .pane {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tab-head {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .tab-head h2 {
    margin: 0;
    font-size: 32px;
    line-height: 1.1;
  }
  .tab-head p {
    margin: 2px 0 0;
    color: var(--text-2);
    max-width: 680px;
  }
  .tab-icon,
  .tile-icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--c) 16%, transparent);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
    gap: 12px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 16px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    border-top: 4px solid var(--c);
    background: var(--card);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .tile:hover {
    border-color: var(--c);
    transform: translateY(-2px);
  }
  .tile-name {
    font-size: 22px;
  }
  .tile-what {
    color: var(--text-2);
    line-height: 1.4;
  }
  .tile-has {
    font-size: 13px;
  }
  .tile .meter {
    width: 100%;
  }
  .tile-go {
    margin-top: auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    color: var(--c);
  }
  .paths {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 12px;
  }
  .path {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .path-who {
    font-size: 18px;
  }
  .path ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .path-step {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--raised);
    color: var(--text);
    text-decoration: none;
  }
  .path-step:hover {
    outline: 1px solid var(--brand);
    text-decoration: none;
  }
  .step-n {
    flex: none;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--brand);
    color: var(--on-action);
    font-weight: 700;
    font-size: 14px;
  }
  .path-step.done .step-n {
    background: var(--win);
  }
  .step-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .step-text .label {
    font-size: 12.5px;
  }
  .subs {
    max-width: 640px;
  }
  .sub-what {
    margin: -4px 0 0;
    color: var(--text-2);
    max-width: 720px;
  }
  .lv {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .lv .chip {
    height: 30px;
    font-size: 13.5px;
  }
  .sec {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 6px;
  }
  .sec p {
    margin: 0;
  }
  .lvl.beginner {
    color: var(--win);
  }
  .lvl.intermediate {
    color: var(--series-1);
  }
  .lvl.advanced {
    color: #b46cff;
  }
  .done-tag {
    display: inline-flex;
    gap: 3px;
    align-items: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--win);
  }
  .extras {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 10px;
  }
  .extra {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    text-decoration: none;
  }
  .extra:hover {
    border-color: var(--win);
    text-decoration: none;
  }
  .extra > span {
    display: flex;
    flex-direction: column;
  }
  .players {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 10px;
  }
  .player {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 4px 10px;
    padding: 10px 12px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--card);
  }
  .player :global(:first-child) {
    grid-row: span 2;
  }
  .p-name {
    min-width: 0;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .p-sides {
    display: flex;
    gap: 6px;
  }
  .p-sides .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px;
    font-size: 13px;
    text-decoration: none;
  }
  .p-sides .side {
    width: 10px;
    height: 10px;
  }
  .small-note {
    margin: 0;
    font-size: 12.5px;
  }
  .masters .section-h {
    font-size: 22px;
  }
  @media (max-width: 767px) {
    .tab-head h2 {
      font-size: 26px;
    }
    /* Phones: every tab in view, three to a row. */
    .tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      overflow: visible;
    }
    .tab {
      justify-content: center;
      padding: 8px 6px;
      font-size: 15px;
    }
  }
</style>

<script lang="ts">
  /**
   * Homework of a class: a student solves it (the same board as in class, every move checked by the class's room);
   * the coach sees who has done it, the ranking, and each student's answers.
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer, getClass, getHomework, type HomeworkView } from '$lib/classroom/api';
  import { HomeworkSession } from '$lib/classroom/homework.svelte';
  import TaskSolver from '$lib/classroom/TaskSolver.svelte';
  import Leaderboard from '$lib/classroom/Leaderboard.svelte';
  import { sanLine, took } from '$lib/classroom/tasks';
  import { t } from '$lib/i18n';

  const id = $derived(page.params.id ?? '');
  const hid = $derived(page.params.hid ?? '');
  const uid = $derived($session.status === 'in' ? $session.uid : (devPlayer() ?? ''));
  let role = $state<'coach' | 'student' | undefined>();
  let hw = $state<HomeworkSession | undefined>();
  let view = $state<HomeworkView | undefined>();
  let error = $state('');
  let started = '';

  $effect(() => {
    if (!uid || !id || !hid || started === `${id}/${hid}`) return;
    started = `${id}/${hid}`;
    getClass(id)
      .then(async (info) => {
        // An admin sees the answers as the coach does.
        role = info.role === 'admin' ? 'coach' : info.role;
        if (role === 'coach') view = await getHomework(id, hid);
        else hw = new HomeworkSession(id, hid, uid);
      })
      .catch((e) => (error = (e as Error).message));
  });
  onDestroy(() => hw?.close());
  const dueText = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const students = $derived(view ? Object.values(view.progress).sort((a, b) => a.name.localeCompare(b.name)) : []);
</script>

<svelte:head><title>Homework · CastlesClass · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/castleclass">← {$t('kidsclass.room.myClasses')}</a>
  {#if !uid}
    <p>{$t('kidsclass.hw.signIn')}</p>
    <button class="btn primary" onclick={startSignIn}>Sign in</button>
  {:else if error}
    <p class="err">{error}</p>
  {:else if role === 'student' && hw}
    {#if hw.error}<p class="err">{hw.error}</p>{/if}
    {#if hw.task}
      <p class="muted">{$t('kidsclass.hw.due', { date: dueText(hw.due) })}{hw.task.over ? $t('kidsclass.hw.passed') : ''}</p>
      <div class="solve"><TaskSolver host={hw} /></div>
      {#if hw.notice}<p class="note">{hw.notice}</p>{/if}
    {:else}
      <p>{$t('kidsclass.room.loading')}</p>
    {/if}
  {:else if role === 'coach' && view}
    <h1>{view.task.title}</h1>
    <p class="muted">{view.task.items.length} puzzles · due {dueText(view.due)} · {students.filter((p) => p.done).length} of {students.length} who started have finished</p>
    <h2>Ranking</h2>
    <Leaderboard rows={view.ranking} total={view.task.items.length} empty="Nobody has started yet." />
    <h2>Answers</h2>
    {#each students as p (p.uid)}
      <details class="card st">
        <summary><b>{p.name}</b> · {p.results.filter((r) => r.solved).length}/{view.task.items.length} solved · {p.points} pts{p.done ? '' : ' · not finished'}</summary>
        {#each p.results as r, i (i)}
          {@const it = view.task.items[i]}
          <p class="line" class:ok={r.solved} class:bad={!r.solved}>
            {i + 1}. {r.solved ? '✓' : '✗'} {sanLine(it.fen, r.solved ? r.moves : (r.tried[r.tried.length - 1] ?? r.moves)) || '(no move)'} <span class="muted">· {took(r.ms)}{r.wrong ? ` · ${r.wrong} wrong` : ''}</span>
          </p>
        {/each}
      </details>
    {:else}
      <p class="muted">No answers yet.</p>
    {/each}
  {:else}
    <p>{$t('kidsclass.room.loading')}</p>
  {/if}
</div>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .back {
    color: var(--muted);
    text-decoration: none;
    font-weight: 600;
  }
  .solve {
    max-width: min(100%, calc(100vh - 140px));
  }
  h1 {
    margin: 0;
    font: 700 26px var(--font-title);
  }
  h2 {
    margin: 10px 0 0;
    font: 700 18px var(--font-title);
  }
  .muted {
    color: var(--muted);
  }
  .err {
    color: var(--loss);
  }
  .note {
    color: var(--engine);
  }
  .st {
    padding: 10px 12px;
  }
  .st summary {
    cursor: pointer;
  }
  .line {
    margin: 4px 0;
    font-size: 14px;
  }
  .line.ok {
    color: var(--win);
  }
  .line.bad {
    color: var(--loss);
  }
</style>

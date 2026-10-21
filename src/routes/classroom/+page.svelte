<script lang="ts">
  /**
   * Classroom: my classes. The coach (an admin, for now) makes a class, picks its students (from their students or
   * any player) and starts it; a student sees their classes and joins the live one. Each class has a link to share.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { adminMe } from '$lib/admin';
  import { myStudents } from '$lib/students';
  import { findPlayers } from '$lib/social';
  import { classLink, deleteClass, devPlayer, getClass, myClasses, newClass, saveClass, type ClassInfo, type ClassSummary, type Member, type Report } from '$lib/classroom/api';
  import { took } from '$lib/classroom/tasks';

  let classes = $state<ClassSummary[]>([]);
  let loaded = $state(false);
  let error = $state('');
  let canCoach = $state(false);
  let name = $state('');
  let busy = $state(false);
  let copied = $state('');
  const signedIn = $derived($session.status === 'in' || !!devPlayer());

  async function load() {
    try {
      classes = await myClasses();
      error = '';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loaded = true;
    }
  }
  onMount(() => {
    const t = setInterval(() => signedIn && void load(), 30_000);
    return () => clearInterval(t);
  });
  let started = false;
  $effect(() => {
    if (!signedIn || started) return;
    started = true;
    void load();
    if (devPlayer()) canCoach = true;
    else adminMe().then(() => (canCoach = true), () => (canCoach = false));
  });

  async function create(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    busy = true;
    try {
      const { id } = await newClass(name.trim());
      name = '';
      await load();
      void openRoster(id);
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  // ----- the students of one class
  let editing = $state<ClassInfo | undefined>();
  let members = $state<Member[]>([]);
  let mine = $state<Member[]>([]);
  let q = $state('');
  let found = $state<Member[]>([]);
  let saving = $state(false);
  let reports = $state<Report[]>([]);
  async function openRoster(id: string) {
    error = '';
    try {
      const info = await getClass(id);
      editing = info;
      members = [...info.members];
      reports = info.reports ?? [];
      myStudents()
        .then((r) => (mine = r.students.map((s) => ({ uid: s.uid, name: s.name }))))
        .catch(() => (mine = []));
    } catch (e) {
      error = (e as Error).message;
    }
  }
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const text = q.trim();
    clearTimeout(searchTimer);
    if (text.length < 2) {
      found = [];
      return;
    }
    searchTimer = setTimeout(() => {
      findPlayers(text)
        .then((ps) => (found = ps.map((p) => ({ uid: p.uid, name: p.name }))))
        .catch(() => (found = []));
    }, 300);
  });
  const has = (uid: string) => members.some((m) => m.uid === uid);
  const toggle = (m: Member) => (members = has(m.uid) ? members.filter((x) => x.uid !== m.uid) : [...members, m]);
  async function save() {
    if (!editing) return;
    saving = true;
    try {
      await saveClass(editing.id, { name: editing.name, members });
      editing = undefined;
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      saving = false;
    }
  }
  async function remove(c: ClassSummary) {
    if (!confirm(`Remove the class "${c.name}"? Its reports go too.`)) return;
    try {
      await deleteClass(c.id);
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(classLink(id));
      copied = id;
      setTimeout(() => (copied = ''), 2000);
    } catch {
      prompt('The class link', classLink(id));
    }
  }
  const coachClasses = $derived(classes.filter((c) => c.mine));
  const studentClasses = $derived(classes.filter((c) => !c.mine));
</script>

<svelte:head><title>Classroom · Chess Castles</title></svelte:head>

<div class="page">
  <header class="head">
    <h1>Classroom</h1>
    <p class="muted">Live chess classes: one shared board, voice, questions with a timer and a leaderboard.</p>
  </header>

  {#if !signedIn}
    <div class="card pad">
      <p>Sign in to see your classes.</p>
      <button class="btn primary" onclick={startSignIn}>Sign in</button>
    </div>
  {:else}
    {#if error}<p class="err">{error}</p>{/if}

    {#if studentClasses.length}
      <h2>My classes</h2>
      <div class="list">
        {#each studentClasses as c (c.id)}
          <div class="card cls" class:live={c.live}>
            <div>
              <b>{c.name}</b>
              <span class="muted">with {c.coachName}</span>
            </div>
            {#if c.live}
              <button class="btn primary" onclick={() => goto(`/classroom/${c.id}`)}>● Join now: live</button>
            {:else}
              <button class="btn" onclick={() => goto(`/classroom/${c.id}`)}>Open</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if canCoach}
      <h2>Classes I teach</h2>
      <form class="new card pad" onsubmit={create}>
        <input bind:value={name} maxlength="60" placeholder="New class, e.g. Rated 1400–1600 (6 pm)" aria-label="Class name" />
        <button class="btn primary" disabled={busy || !name.trim()}>Make the class</button>
      </form>
      <div class="list">
        {#each coachClasses as c (c.id)}
          <div class="card cls" class:live={c.live}>
            <div>
              <b>{c.name}</b>
              <span class="muted">{c.students} {c.students === 1 ? 'student' : 'students'}{c.live ? ` · live for ${took(Date.now() - c.live)}` : ''}</span>
            </div>
            <div class="acts">
              <button class="btn primary" onclick={() => goto(`/classroom/${c.id}`)}>{c.live ? 'Back to the class' : 'Start the class'}</button>
              <button class="btn" onclick={() => openRoster(c.id)}>Students</button>
              <button class="btn ghost" onclick={() => copy(c.id)}>{copied === c.id ? 'Link copied ✓' : '🔗 Link'}</button>
              <button class="btn ghost" onclick={() => remove(c)} aria-label="Remove the class">🗑</button>
            </div>
          </div>
        {:else}
          {#if loaded}<p class="muted">No classes yet: make one above, then add its students.</p>{/if}
        {/each}
      </div>
    {:else if loaded && !studentClasses.length}
      <div class="card pad">
        <p>You are not in a class yet.</p>
        <p class="muted">When your coach adds you, the class shows here. You can also open the class link your coach sends.</p>
      </div>
    {/if}
  {/if}
</div>

{#if editing}
  <div class="scrim" role="presentation" onclick={() => (editing = undefined)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="The class's students">
    <header class="dh">
      <input class="title" bind:value={editing.name} maxlength="60" aria-label="Class name" />
      <button class="btn ghost" onclick={() => (editing = undefined)} aria-label="Close">✕</button>
    </header>
    <h3>In this class ({members.length})</h3>
    <div class="chips">
      {#each members as m (m.uid)}<button class="chip on" onclick={() => toggle(m)} title="Take off the class">{m.name} ✕</button>{:else}<span class="muted">No students yet: add them below.</span>{/each}
    </div>
    {#if mine.length}
      <h3>My students</h3>
      <div class="chips">
        {#each mine as m (m.uid)}<button class="chip" class:on={has(m.uid)} onclick={() => toggle(m)}>{has(m.uid) ? '✓ ' : '+ '}{m.name}</button>{/each}
      </div>
    {/if}
    <h3>Find a player</h3>
    <input class="search" bind:value={q} placeholder="Name or username" aria-label="Find a player" />
    <div class="chips">
      {#each found as m (m.uid)}<button class="chip" class:on={has(m.uid)} onclick={() => toggle(m)}>{has(m.uid) ? '✓ ' : '+ '}{m.name}</button>{/each}
    </div>
    <p class="muted small">Students join with the class link, signed in with the account you add here.</p>
    {#if reports.length}
      <h3>Past classes</h3>
      {#each reports.slice(0, 5) as r (r.ended)}
        <p class="small">{new Date(r.ended).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {took(r.ended - (r.started || r.ended))} · {r.people.length} came{r.scores[0] ? ` · top: ${r.scores[0].name} (${r.scores[0].points})` : ''}</p>
      {/each}
    {/if}
    <div class="row">
      <button class="btn ghost" onclick={() => (editing = undefined)}>Cancel</button>
      <button class="btn primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head h1 {
    margin: 8px 0 0;
    font: 700 32px var(--font-display);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
    margin: 2px 0;
  }
  .err {
    color: var(--loss);
  }
  h2 {
    margin: 10px 0 0;
    font: 700 20px var(--font-title);
  }
  .pad {
    padding: 14px 16px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    flex-wrap: wrap;
  }
  .cls > div:first-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cls b {
    font: 700 18px var(--font-title);
  }
  .cls.live {
    border-color: var(--win);
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .new {
    display: flex;
    gap: 8px;
  }
  .new input,
  .search,
  .title {
    flex: 1;
    min-width: 0;
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 11px;
    font: 600 15px var(--font-body);
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(5, 10, 20, 0.55);
  }
  .dialog {
    position: fixed;
    z-index: 81;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(620px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-panel);
    padding: 16px 18px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dh {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .title {
    font: 700 18px var(--font-title);
  }
  h3 {
    margin: 8px 0 0;
    font: 700 15px var(--font-title);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }
</style>

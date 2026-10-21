<script lang="ts">
  /**
   * Classroom: classes, sessions and homework. The coach (an admin, for now) makes a class, picks its students, plans
   * its sessions, posts announcements, sets homework and starts the class; an admin decides whether students see the
   * Classroom at all (owner, 2026-10-22: off during the beta except for a coach's demo). A student sees their classes,
   * the next session, announcements, homework to do, and joins the live class.
   */
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { adminMe } from '$lib/admin';
  import { myStudents } from '$lib/students';
  import { findPlayers } from '$lib/social';
  import {
    classLink,
    classroomAccess,
    deleteClass,
    deleteHomework,
    devPlayer,
    getClass,
    homeworkList,
    newClass,
    saveClass,
    setClassroomOpen,
    setHomework,
    START_FEN,
    type ClassInfo,
    type ClassSummary,
    type HomeworkSummary,
    type Item,
    type Member,
    type Session,
    type TaskKind,
  } from '$lib/classroom/api';
  import { forgetClassroom } from '$lib/classroom/visible';
  import { took } from '$lib/classroom/tasks';
  import Leaderboard from '$lib/classroom/Leaderboard.svelte';
  import AskDialog from '$lib/classroom/AskDialog.svelte';

  let classes = $state<ClassSummary[]>([]);
  let open = $state(false);
  let closed = $state(false);
  let loaded = $state(false);
  let error = $state('');
  let canCoach = $state(false);
  let name = $state('');
  let busy = $state(false);
  let copied = $state('');
  let homework = $state<Record<string, HomeworkSummary[]>>({});
  const signedIn = $derived($session.status === 'in' || !!devPlayer());

  async function load() {
    try {
      const r = await classroomAccess();
      classes = r.classes;
      open = r.open;
      closed = !!r.closed;
      error = '';
      // Homework of each class (a few classes: one small request each).
      for (const c of r.classes) homeworkList(c.id).then((h) => (homework = { ...homework, [c.id]: h }), () => {});
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loaded = true;
    }
  }
  let started = false;
  $effect(() => {
    if (!signedIn || started) return;
    started = true;
    void load();
    if (devPlayer()) canCoach = true;
    else adminMe().then(() => (canCoach = true), () => (canCoach = false));
  });

  async function toggleOpen() {
    try {
      open = (await setClassroomOpen(!open)).open;
      forgetClassroom();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function create(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    busy = true;
    try {
      const { id } = await newClass(name.trim());
      name = '';
      await load();
      void openClass(id, 'students');
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  // ----- sessions across classes
  type Row = { id: string; cls: string; at: number; minutes: number; title: string; live: boolean };
  let sessTab = $state<'live' | 'upcoming' | 'done'>('upcoming');
  const now = Date.now();
  const liveNow = $derived(classes.filter((c) => c.live));
  const upcoming = $derived(
    classes
      .flatMap((c) => c.sessions.map((s): Row => ({ id: c.id, cls: c.name, ...s, live: !!c.live })))
      .sort((a, b) => a.at - b.at)
      .slice(0, 30),
  );
  const completed = $derived(
    classes
      .flatMap((c) => c.past.map((p) => ({ id: c.id, cls: c.name, ...p })))
      .sort((a, b) => b.ended - a.ended)
      .slice(0, 30),
  );
  const when = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const inTime = (t: number) => {
    const m = Math.round((t - Date.now()) / 60000);
    if (m < 0) return 'now';
    if (m < 60) return `in ${m} min`;
    if (m < 1440) return `in ${Math.round(m / 60)} h`;
    return `in ${Math.round(m / 1440)} days`;
  };

  // ----- one class (the coach's editor)
  let editing = $state<ClassInfo | undefined>();
  let edTab = $state<'students' | 'schedule' | 'notes' | 'homework' | 'board' | 'past'>('students');
  let members = $state<Member[]>([]);
  let sessions = $state<Session[]>([]);
  let mine = $state<Member[]>([]);
  let q = $state('');
  let found = $state<Member[]>([]);
  let saving = $state(false);
  let note = $state('');
  let setting = $state(false);
  // A new session (the coach's local time)
  let sDate = $state(new Date().toISOString().slice(0, 10));
  let sTime = $state('18:00');
  let sMinutes = $state(60);
  let sTitle = $state('');
  let sWeeks = $state(1);
  async function openClass(id: string, tab: typeof edTab = 'students') {
    error = '';
    try {
      const info = await getClass(id);
      editing = info;
      edTab = tab;
      members = [...info.members];
      sessions = [...(info.sessions ?? [])];
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
  function addSession() {
    const start = new Date(`${sDate}T${sTime}`).getTime();
    if (!Number.isFinite(start)) return;
    const extra = Array.from({ length: Math.max(1, sWeeks) }, (_, i) => ({ at: start + i * 7 * 86_400_000, minutes: sMinutes, title: sTitle.trim() }));
    sessions = [...sessions, ...extra].sort((a, b) => a.at - b.at);
  }
  async function save() {
    if (!editing) return;
    saving = true;
    try {
      await saveClass(editing.id, { name: editing.name, members, sessions });
      editing = undefined;
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      saving = false;
    }
  }
  async function announce() {
    if (!editing || !note.trim()) return;
    try {
      const r = await saveClass(editing.id, { announce: note.trim() });
      editing = { ...editing, notes: r.info.notes };
      note = '';
      void load();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function unannounce(nid: string) {
    if (!editing) return;
    const r = await saveClass(editing.id, { unannounce: nid });
    editing = { ...editing, notes: r.info.notes };
    void load();
  }
  async function newHomework(task: { kind: TaskKind; title: string; points: number; minus: number; tries: number; items: Item[]; homework?: number }) {
    if (!editing) return;
    setting = false;
    try {
      await setHomework(editing.id, { kind: task.kind, title: task.title, points: task.points, minus: task.minus, tries: task.tries, items: task.items, due: task.homework ?? Date.now() + 7 * 86_400_000 });
      homework = { ...homework, [editing.id]: await homeworkList(editing.id) };
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function dropHomework(cid: string, hid: string) {
    if (!confirm('Remove this homework and its answers?')) return;
    await deleteHomework(cid, hid).catch((e) => (error = (e as Error).message));
    homework = { ...homework, [cid]: await homeworkList(cid) };
  }
  async function remove(c: ClassSummary) {
    if (!confirm(`Remove the class "${c.name}"? Its reports and homework go too.`)) return;
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
  // A student's view of a class: its leaderboard, on demand.
  let boardOf = $state<{ id: string; name: string; rows: NonNullable<ClassInfo['leaderboard']> } | undefined>();
  async function showBoard(c: ClassSummary) {
    try {
      const info = await getClass(c.id);
      boardOf = { id: c.id, name: c.name, rows: info.leaderboard ?? [] };
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const coachClasses = $derived(classes.filter((c) => c.mine));
  const studentClasses = $derived(classes.filter((c) => !c.mine));
  const todo = (c: ClassSummary) => (homework[c.id] ?? []).filter((h) => !h.mine?.done && h.due > now);
</script>

<svelte:head><title>Classroom · Chess Castles</title></svelte:head>

<div class="page">
  <header class="head">
    <h1>Classroom</h1>
    <p class="muted">Live chess classes: one shared board, voice, questions with a timer, games, homework and leaderboards.</p>
  </header>

  {#if !signedIn}
    <div class="card pad">
      <p>Sign in to see your classes.</p>
      <button class="btn primary" onclick={startSignIn}>Sign in</button>
    </div>
  {:else if closed}
    <div class="card pad">
      <p>The Classroom is not open yet.</p>
      <p class="muted">Your coach will tell you when your class starts here.</p>
    </div>
  {:else}
    {#if error}<p class="err">{error}</p>{/if}

    {#if canCoach}
      <div class="card pad switch">
        <div>
          <b>Students can see the Classroom: {open ? 'on' : 'off'}</b>
          <span class="muted small">{open ? 'Students in a class see it in their menu and can join.' : 'Hidden from every student (only admins see it). Switch on for a demo or when classes begin.'}</span>
        </div>
        <button class="btn" class:primary={!open} onclick={toggleOpen}>{open ? 'Switch off' : 'Switch on'}</button>
      </div>
    {/if}

    {#if classes.length}
      <div class="sessions card pad">
        <div class="chips" role="tablist" aria-label="Sessions">
          <button class="chip" class:on={sessTab === 'live'} onclick={() => (sessTab = 'live')}>● Live now ({liveNow.length})</button>
          <button class="chip" class:on={sessTab === 'upcoming'} onclick={() => (sessTab = 'upcoming')}>Upcoming ({upcoming.length})</button>
          {#if canCoach}<button class="chip" class:on={sessTab === 'done'} onclick={() => (sessTab = 'done')}>Completed ({completed.length})</button>{/if}
        </div>
        {#if sessTab === 'live'}
          {#each liveNow as c (c.id)}
            <div class="srow"><span><b>{c.name}</b> <span class="muted">live for {took(Date.now() - c.live)}</span></span><button class="btn primary" onclick={() => goto(`/classroom/${c.id}`)}>{c.mine ? 'Back to the class' : 'Join now'}</button></div>
          {:else}
            <p class="muted">No class is live right now.</p>
          {/each}
        {:else if sessTab === 'upcoming'}
          {#each upcoming as s (s.id + s.at)}
            <div class="srow"><span><b>{when(s.at)}</b> · {s.cls}{s.title ? ` · ${s.title}` : ''} <span class="muted">({s.minutes} min, {inTime(s.at)})</span></span></div>
          {:else}
            <p class="muted">No sessions planned.{canCoach ? ' Plan them in a class: Schedule.' : ''}</p>
          {/each}
        {:else}
          {#each completed as p (p.id + p.ended)}
            <div class="srow"><span><b>{when(p.started || p.ended)}</b> · {p.cls} <span class="muted">· {took(p.ended - (p.started || p.ended))} · {p.people} came{p.top ? ` · top: ${p.top}` : ''}</span></span></div>
          {:else}
            <p class="muted">No classes held yet.</p>
          {/each}
        {/if}
      </div>
    {/if}

    {#if studentClasses.length}
      <h2>My classes</h2>
      <div class="list">
        {#each studentClasses as c (c.id)}
          <div class="card cls" class:live={c.live}>
            <div class="main-c">
              <b>{c.name}</b>
              <span class="muted">with {c.coachName}{c.sessions[0] ? ` · next: ${when(c.sessions[0].at)}` : ''}</span>
              {#if c.notes[0]}<span class="notec">📢 {c.notes[0].text}</span>{/if}
              {#each todo(c) as h (h.id)}
                <a class="hw" href="/classroom/{c.id}/homework/{h.id}">📝 {h.title} · {h.items} puzzles · due {when(h.due)}{h.mine ? ` · ${h.mine.solved} solved` : ''}</a>
              {/each}
              {#each (homework[c.id] ?? []).filter((h) => h.mine?.done || h.due <= now).slice(0, 3) as h (h.id)}
                <a class="hw done" href="/classroom/{c.id}/homework/{h.id}">✓ {h.title}{h.mine ? ` · ${h.mine.points} pts` : ''}</a>
              {/each}
            </div>
            <div class="acts">
              {#if c.live}<button class="btn primary" onclick={() => goto(`/classroom/${c.id}`)}>● Join now: live</button>{:else}<button class="btn" onclick={() => goto(`/classroom/${c.id}`)}>Open</button>{/if}
              <button class="btn ghost" onclick={() => showBoard(c)}>🏆 Leaderboard</button>
            </div>
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
            <div class="main-c">
              <b>{c.name}</b>
              <span class="muted">{c.students} {c.students === 1 ? 'student' : 'students'}{c.live ? ` · live for ${took(Date.now() - c.live)}` : c.sessions[0] ? ` · next: ${when(c.sessions[0].at)}` : ''}</span>
              {#if c.notes[0]}<span class="notec">📢 {c.notes[0].text}</span>{/if}
              {#if (homework[c.id] ?? []).length}<span class="muted small">📝 {(homework[c.id] ?? []).length} homework · {(homework[c.id] ?? []).reduce((n, h) => n + h.done, 0)} finished answers</span>{/if}
            </div>
            <div class="acts">
              <button class="btn primary" onclick={() => goto(`/classroom/${c.id}`)}>{c.live ? 'Back to the class' : 'Start the class'}</button>
              <button class="btn" onclick={() => openClass(c.id)}>Manage</button>
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

{#if boardOf}
  <div class="scrim" role="presentation" onclick={() => (boardOf = undefined)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Leaderboard">
    <header class="dh"><h2>🏆 {boardOf.name}</h2><button class="btn ghost" onclick={() => (boardOf = undefined)} aria-label="Close">✕</button></header>
    <p class="muted small">Every class so far: points from the questions in class.</p>
    <Leaderboard rows={boardOf.rows} me={$session.status === 'in' ? $session.uid : (devPlayer() ?? '')} empty="Scores show here after the first class." />
  </div>
{/if}

{#if editing}
  <div class="scrim" role="presentation" onclick={() => (editing = undefined)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Manage the class">
    <header class="dh">
      <input class="title" bind:value={editing.name} maxlength="60" aria-label="Class name" />
      <button class="btn ghost" onclick={() => (editing = undefined)} aria-label="Close">✕</button>
    </header>
    <div class="chips" role="tablist">
      {#each [['students', `Students (${members.length})`], ['schedule', `Schedule (${sessions.length})`], ['notes', 'Announcements'], ['homework', 'Homework'], ['board', 'Leaderboard'], ['past', 'Past classes']] as [k, l] (k)}
        <button class="chip" class:on={edTab === k} onclick={() => (edTab = k as typeof edTab)}>{l}</button>
      {/each}
    </div>

    {#if edTab === 'students'}
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
    {:else if edTab === 'schedule'}
      <div class="grid2">
        <label class="f"><span>Date</span><input type="date" bind:value={sDate} /></label>
        <label class="f"><span>Time</span><input type="time" bind:value={sTime} /></label>
        <label class="f"><span>Minutes</span><input type="number" min="15" max="300" step="15" bind:value={sMinutes} /></label>
        <label class="f"><span>Repeat weekly</span><select bind:value={sWeeks}>{#each [1, 4, 8, 12, 24] as w (w)}<option value={w}>{w === 1 ? 'Just once' : `${w} weeks`}</option>{/each}</select></label>
      </div>
      <div class="announce">
        <input bind:value={sTitle} maxlength="80" placeholder="Topic (optional), e.g. Rook endgames" aria-label="Topic" />
        <button class="btn" onclick={addSession}>+ Add</button>
      </div>
      {#each sessions as s, i (s.at + ':' + i)}
        <div class="srow"><span><b>{when(s.at)}</b> · {s.minutes} min{s.title ? ` · ${s.title}` : ''}</span><button class="btn ghost" onclick={() => (sessions = sessions.filter((_, j) => j !== i))} aria-label="Remove">✕</button></div>
      {:else}
        <p class="muted">No sessions planned yet. Students see the next one on their class card.</p>
      {/each}
    {:else if edTab === 'notes'}
      <div class="announce">
        <input bind:value={note} maxlength="400" placeholder="e.g. Tournament on Sunday at 3 pm" aria-label="Announcement" onkeydown={(e) => e.key === 'Enter' && announce()} />
        <button class="btn primary" onclick={announce} disabled={!note.trim()}>📢 Announce</button>
      </div>
      {#each editing.notes ?? [] as n (n.id)}
        <div class="srow"><span>📢 {n.text} <span class="muted small">{when(n.at)}</span></span><button class="btn ghost" onclick={() => unannounce(n.id)} aria-label="Remove">✕</button></div>
      {:else}
        <p class="muted">Announcements show on the students' class card and pop up in a live class.</p>
      {/each}
    {:else if edTab === 'homework'}
      <button class="btn primary" onclick={() => (setting = true)}>📝 Set homework</button>
      {#each homework[editing.id] ?? [] as h (h.id)}
        <div class="srow">
          <span><a href="/classroom/{editing.id}/homework/{h.id}"><b>{h.title}</b></a> · {h.items} puzzles · due {when(h.due)} · {h.done} finished{h.top[0] ? ` · top: ${h.top[0].name} (${h.top[0].points})` : ''}</span>
          <button class="btn ghost" onclick={() => dropHomework(editing!.id, h.id)} aria-label="Remove">✕</button>
        </div>
      {:else}
        <p class="muted">No homework yet. Students solve it at home before the due date; the board checks every move.</p>
      {/each}
    {:else if edTab === 'board'}
      <Leaderboard rows={editing.leaderboard ?? []} empty="Scores show here after the first class." />
    {:else}
      {#each editing.reports ?? [] as r (r.ended)}
        <details class="past">
          <summary>{when(r.started || r.ended)} · {took(r.ended - (r.started || r.ended))} · {r.people.length} came{r.scores[0] ? ` · top: ${r.scores[0].name} (${r.scores[0].points})` : ''}</summary>
          <p class="small">Present: {r.people.map((p) => `${p.name} (${p.minutes} min)`).join(', ') || 'nobody'}</p>
          {#each r.tasks as t, i (i)}<p class="small">{i + 1}. {t.title}: {t.top.map((x) => `${x.name} ${x.points}`).join(', ') || 'no answers'}</p>{/each}
        </details>
      {:else}
        <p class="muted">The report of each class shows here after "End class".</p>
      {/each}
    {/if}

    {#if edTab === 'students' || edTab === 'schedule'}
      <div class="row">
        <button class="btn ghost" onclick={() => (editing = undefined)}>Cancel</button>
        <button class="btn primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    {/if}
  </div>
{/if}

{#if setting}
  <AskDialog fen={START_FEN} used={new Set()} homeworkOnly onask={newHomework} onclose={() => (setting = false)} />
{/if}

<style>
  .page {
    max-width: 920px;
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
  h3 {
    margin: 8px 0 0;
    font: 700 15px var(--font-title);
  }
  .pad {
    padding: 14px 16px;
  }
  .switch {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .switch > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sessions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .srow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--border-soft);
    flex-wrap: wrap;
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
  .main-c {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }
  .cls b {
    font: 700 18px var(--font-title);
  }
  .cls.live {
    border-color: var(--win);
  }
  .notec {
    font-size: 14px;
    background: var(--gold-soft);
    border-radius: 8px;
    padding: 4px 8px;
    align-self: flex-start;
  }
  .hw {
    font-size: 14px;
    color: var(--live);
    text-decoration: none;
    font-weight: 600;
  }
  .hw.done {
    color: var(--muted);
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .new,
  .announce {
    display: flex;
    gap: 8px;
  }
  .new input,
  .search,
  .title,
  .announce input,
  .f input,
  .f select {
    flex: 1;
    min-width: 0;
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 11px;
    font: 600 15px var(--font-body);
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--muted);
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
    width: min(680px, calc(100vw - 24px));
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
    justify-content: space-between;
  }
  .dh h2 {
    margin: 0;
  }
  .title {
    font: 700 18px var(--font-title);
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
  .past {
    border-top: 1px solid var(--border-soft);
    padding: 6px 0;
  }
  .past summary {
    cursor: pointer;
  }
</style>

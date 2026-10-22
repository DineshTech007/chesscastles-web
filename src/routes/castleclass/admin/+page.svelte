<script lang="ts">
  /**
   * CastleClass for admins: every coach and the rights an admin gave them (the owner and moderators add, change, pause
   * and remove coaches), the classes live right now (watch one unseen), every class (hand it to another coach), and
   * the problems coaches and students meet in class (voice, camera, connection, or reported by hand).
   */
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { findPlayers } from '$lib/social';
  import { adminDashboard, devPlayer, PERM_LABELS, removeCoach, resolveIssue, saveClass, saveCoach, type Dashboard, type Issue, type Perms } from '$lib/classroom/api';
  import { took } from '$lib/classroom/tasks';

  const NEW_COACH: Perms = { classes: true, enrol: true, live: true, homework: true, video: true, games: true, pdf: true, maxClasses: 10, maxStudents: 30 };
  const KIND: Record<Issue['kind'], string> = { report: '⚠ Reported', voice: '🎙️ Voice/video', camera: '📷 Camera', mic: '🎤 Microphone', connection: '📶 Connection', other: 'Other' };

  let d = $state<Dashboard | undefined>();
  let error = $state('');
  let busy = $state(false);
  const signedIn = $derived($session.status === 'in' || !!devPlayer());

  async function load() {
    try {
      d = await adminDashboard();
      error = '';
    } catch (e) {
      error = (e as Error).message;
    }
  }
  let started = false;
  $effect(() => {
    if (!signedIn || started) return;
    started = true;
    void load();
  });
  // Live classes change by the minute: fresh numbers every 30 seconds while the page is open.
  $effect(() => {
    if (!signedIn) return;
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 30_000);
    return () => clearInterval(t);
  });

  const when = (t: number) => (t ? new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const ago = (t: number) => (t ? `${took(Date.now() - t)} ago` : 'never');

  // ----- problems
  let showDone = $state(false);
  const issues = $derived((d?.issues ?? []).filter((i) => showDone || !i.resolved));
  async function resolve(i: Issue, on = true) {
    try {
      await resolveIssue(i.id, on);
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  // ----- coaches (the owner and moderators)
  type Edit = { uid: string; name: string; perms: Perms; active: boolean; note: string; isNew: boolean };
  let edit = $state<Edit | undefined>();
  let q = $state('');
  let found = $state<{ uid: string; name: string }[]>([]);
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
  function addCoach(p: { uid: string; name: string }) {
    const was = d?.coaches.find((c) => c.uid === p.uid && !c.admin);
    edit = was ? { uid: was.uid, name: was.name, perms: { ...was.perms }, active: was.active, note: was.note, isNew: false } : { uid: p.uid, name: p.name, perms: { ...NEW_COACH }, active: true, note: '', isNew: true };
    q = '';
    found = [];
  }
  function editCoach(c: Dashboard['coaches'][number]) {
    edit = { uid: c.uid, name: c.name, perms: { ...c.perms }, active: c.active, note: c.note, isNew: false };
  }
  async function saveEdit() {
    if (!edit) return;
    busy = true;
    try {
      await saveCoach(edit.uid, { perms: edit.perms, active: edit.active, note: edit.note.trim() });
      edit = undefined;
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function pause(c: Dashboard['coaches'][number]) {
    try {
      await saveCoach(c.uid, { active: !c.active });
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  async function dropCoach() {
    if (!edit || !confirm(`Remove ${edit.name} as a coach? Their classes stay (hand them to another coach below).`)) return;
    try {
      await removeCoach(edit.uid);
      edit = undefined;
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  // ----- classes: hand one to another coach
  async function reassign(id: string, uid: string) {
    const c = d?.coaches.find((x) => x.uid === uid);
    if (!c) return;
    try {
      await saveClass(id, { coach: c.uid, coachName: c.name });
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const watch = (id: string) => goto(`/castleclass/${id}?watch=1`);
</script>

<svelte:head><title>Admin · CastleClass · Chess Castles</title></svelte:head>

<div class="page">
  <header class="head">
    <a class="back" href="/castleclass">← CastleClass</a>
    <h1>CastleClass admin</h1>
    <p class="muted">Coaches and their rights, the classes live now, and the problems people meet in class.</p>
  </header>

  {#if !signedIn}
    <div class="card pad">
      <p>Sign in with an admin account.</p>
      <button class="btn primary" onclick={startSignIn}>Sign in</button>
    </div>
  {:else if error && !d}
    <p class="err">{error}</p>
  {:else if !d}
    <p class="muted">Loading…</p>
  {:else}
    {#if error}<p class="err">{error}</p>{/if}
    <div class="stats">
      <div class="stat card" class:hot={d.totals.live > 0}><b>{d.totals.live}</b><span>live now</span></div>
      <div class="stat card"><b>{d.totals.online}</b><span>students in class now</span></div>
      <div class="stat card"><b>{d.totals.coaches}</b><span>active coaches</span></div>
      <div class="stat card"><b>{d.totals.classes}</b><span>classes</span></div>
      <div class="stat card"><b>{d.totals.students}</b><span>students enrolled</span></div>
      <div class="stat card"><b>{d.totals.held7}</b><span>classes held, 7 days ({Math.round(d.totals.minutes7 / 60)} h)</span></div>
      <div class="stat card" class:warn={d.totals.issues > 0}><b>{d.totals.issues}</b><span>open problems</span></div>
    </div>

    <section>
      <h2>● Live now</h2>
      {#each d.live as l (l.id)}
        <div class="card row-c live">
          <div class="main-c">
            <b>{l.name}</b>
            <span class="muted small">
              {l.coachName}{l.coachHere === false ? ' (not in the room)' : ''} · live for {took(Date.now() - l.since)} · {l.online ?? 0} of {l.students} students here{l.voice ? ` · ${l.voice} on voice` : ''}{l.cams ? ` · ${l.cams} 📷` : ''}{l.task ? ` · question: ${l.task}` : ''}{l.games ? ` · ${l.games} games` : ''}{l.watching ? ` · ${l.watching} admin watching` : ''}
            </span>
          </div>
          <button class="btn primary" onclick={() => watch(l.id)}>👁 Watch</button>
        </div>
      {:else}
        <p class="muted">No class is live right now.</p>
      {/each}
    </section>

    <section>
      <div class="sh">
        <h2>Problems</h2>
        <label class="toggle"><input type="checkbox" bind:checked={showDone} /> Show dealt with</label>
      </div>
      {#each issues as i (i.id)}
        <div class="card issue" class:done={i.resolved}>
          <div class="main-c">
            <span><b>{KIND[i.kind] ?? i.kind}</b> · {i.name} <span class="muted">({i.role})</span>{i.className ? ` · ${i.className}` : ''} · <span class="muted">{when(i.at)}</span></span>
            <span>{i.text}</span>
            {#if i.detail}<details><summary class="muted small">Details</summary><p class="small mono">{i.detail}</p></details>{/if}
          </div>
          {#if i.resolved}
            <button class="btn ghost" onclick={() => resolve(i, false)}>Open again</button>
          {:else}
            <button class="btn" onclick={() => resolve(i)}>✓ Dealt with</button>
          {/if}
        </div>
      {:else}
        <p class="muted">No problems reported. Voice, camera and connection failures in class show here by themselves, and coaches can report one (⚠ in the class).</p>
      {/each}
    </section>

    <section>
      <h2>Coaches</h2>
      {#if d.manager}
        <div class="card pad add">
          <b>Add a coach</b>
          <input class="search" bind:value={q} placeholder="Find the player: name or username" aria-label="Find a player" />
          <div class="chips">
            {#each found as p (p.uid)}<button class="chip" onclick={() => addCoach(p)}>+ {p.name}</button>{/each}
          </div>
          <p class="muted small">The coach signs in with this Chess Castles account. They see CastleClass in their menu and can do what you allow.</p>
        </div>
      {:else}
        <p class="muted small">The owner and moderators add and change coaches.</p>
      {/if}
      {#each d.coaches as c (c.uid)}
        <div class="card row-c" class:paused={!c.active}>
          <div class="main-c">
            <span><b>{c.name}</b>{#if c.admin} <span class="pill">Admin</span>{:else if !c.active} <span class="pill bad">Paused</span>{/if}{#if c.live} <span class="pill ok">● live</span>{/if}</span>
            <span class="muted small">{c.classes} {c.classes === 1 ? 'class' : 'classes'} · {c.students} students · {c.held7} held in 7 days ({c.minutes7} min) · last class {ago(c.last)}{c.issues ? ` · ⚠ ${c.issues} open problems` : ''}</span>
            {#if !c.admin}<span class="muted small">{PERM_LABELS.filter(([k]) => c.perms[k]).map(([, l]) => l).join(' · ') || 'No rights'} · up to {c.perms.maxClasses} classes, {c.perms.maxStudents} students each</span>{/if}
            {#if c.note}<span class="small">📝 {c.note}</span>{/if}
          </div>
          {#if d.manager && !c.admin}
            <div class="acts">
              <button class="btn" onclick={() => editCoach(c)}>Rights</button>
              <button class="btn ghost" onclick={() => pause(c)}>{c.active ? 'Pause' : 'Resume'}</button>
            </div>
          {/if}
        </div>
      {:else}
        <p class="muted">No coaches yet.{d.manager ? ' Add one above.' : ''}</p>
      {/each}
    </section>

    <section>
      <h2>All classes</h2>
      {#each d.classes as c (c.id)}
        <div class="card row-c" class:live={c.live}>
          <div class="main-c">
            <b>{c.name}</b>
            <span class="muted small">{c.students} students · made {when(c.created)} · last held {ago(c.last)} · {c.held7} in 7 days{c.next ? ` · next: ${when(c.next)}` : ''}</span>
          </div>
          <div class="acts">
            {#if c.live}<button class="btn primary" onclick={() => watch(c.id)}>👁 Watch</button>{/if}
            <label class="coachsel">
              <span class="muted small">Coach</span>
              <select value={c.coach} onchange={(e) => reassign(c.id, e.currentTarget.value)} aria-label="The class's coach">
                {#if !d.coaches.some((x) => x.uid === c.coach)}<option value={c.coach}>{c.coachName}</option>{/if}
                {#each d.coaches.filter((x) => x.active || x.uid === c.coach) as x (x.uid)}<option value={x.uid}>{x.name}{x.admin ? ' (admin)' : ''}</option>{/each}
              </select>
            </label>
          </div>
        </div>
      {:else}
        <p class="muted">No classes yet.</p>
      {/each}
      <p class="muted small">To change a class's students, schedule or homework: CastleClass → Other coaches' classes → Manage.</p>
    </section>
  {/if}
</div>

{#if edit}
  <div class="scrim" role="presentation" onclick={() => (edit = undefined)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Coach rights">
    <h2>{edit.isNew ? `Make ${edit.name} a coach` : `${edit.name}: coach rights`}</h2>
    <div class="perms">
      {#each PERM_LABELS as [k, label, about] (k)}
        <label class="perm">
          <input type="checkbox" bind:checked={edit.perms[k]} />
          <span><b>{label}</b><span class="muted small">{about}</span></span>
        </label>
      {/each}
    </div>
    <div class="grid2">
      <label class="f"><span>Most classes</span><input type="number" min="1" max="50" bind:value={edit.perms.maxClasses} /></label>
      <label class="f"><span>Most students in a class</span><input type="number" min="1" max="60" bind:value={edit.perms.maxStudents} /></label>
    </div>
    <label class="f"><span>Note (only admins see it)</span><input bind:value={edit.note} maxlength="200" placeholder="e.g. Next Move academy, evening batches" /></label>
    {#if !edit.isNew}<label class="toggle"><input type="checkbox" bind:checked={edit.active} /> Active (off: paused, can see but not change or start classes)</label>{/if}
    <div class="row">
      {#if !edit.isNew}<button class="btn ghost danger" onclick={dropCoach}>Remove as coach</button>{/if}
      <span class="grow"></span>
      <button class="btn ghost" onclick={() => (edit = undefined)}>Cancel</button>
      <button class="btn primary" onclick={saveEdit} disabled={busy}>{busy ? 'Saving…' : edit.isNew ? 'Make coach' : 'Save'}</button>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 980px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head h1 {
    margin: 4px 0 0;
    font: 700 30px var(--font-display);
  }
  .back {
    color: var(--muted);
    text-decoration: none;
    font-size: 14px;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
    margin: 2px 0;
  }
  .mono {
    font-family: ui-monospace, monospace;
    word-break: break-all;
  }
  .err {
    color: var(--loss);
  }
  h2 {
    margin: 6px 0;
    font: 700 20px var(--font-title);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sh {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pad {
    padding: 14px 16px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    gap: 2px;
  }
  .stat b {
    font: 800 26px var(--font-title);
  }
  .stat span {
    font-size: 13px;
    color: var(--muted);
  }
  .stat.hot {
    border-color: var(--win);
  }
  .stat.hot b {
    color: var(--win);
  }
  .stat.warn {
    border-color: var(--gold);
  }
  .row-c,
  .issue {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    flex-wrap: wrap;
  }
  .row-c.live {
    border-color: var(--win);
  }
  .row-c.paused {
    opacity: 0.75;
  }
  .issue.done {
    opacity: 0.6;
  }
  .main-c {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .main-c b {
    font: 700 17px var(--font-title);
  }
  .acts {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .pill.ok {
    color: var(--win);
  }
  .pill.bad {
    color: var(--loss);
  }
  .add {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .search,
  .f input,
  .coachsel select {
    min-width: 0;
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    font: 600 15px var(--font-body);
  }
  .coachsel {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .coachsel select {
    max-width: 200px;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
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
    width: min(560px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-panel);
    padding: 16px 18px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dialog h2 {
    margin: 0;
  }
  .perms {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .perm {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 6px 0;
    border-top: 1px solid var(--border-soft);
  }
  .perm input {
    margin-top: 4px;
  }
  .perm > span {
    display: flex;
    flex-direction: column;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--muted);
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
  }
  .btn.ghost.danger {
    color: var(--loss);
  }
</style>

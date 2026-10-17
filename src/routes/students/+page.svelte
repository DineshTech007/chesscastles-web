<script lang="ts">
  /** Coach tools (Elite): your students' progress and games, and the work you set them. */
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import FriendGames from '$lib/components/FriendGames.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { PLAN_INFO, RANK, currentPlan, planSettings } from '$lib/plans';
  import { WORK_PRESETS, coachLink, deleteWork, myStudents, removeStudent, setWork, type Assignment, type Student, type WorkKind } from '$lib/students';
  import { SPEED_LABEL, KFIDE_SPEEDS } from '$lib/kfide';

  let data = $state<{ students: Student[]; assignments: Assignment[] } | undefined>();
  let error = $state('');
  let open = $state<Student | undefined>();
  let copied = $state(false);
  // New work.
  let preset = $state(0);
  let title = $state(WORK_PRESETS[0].title);
  let ref = $state(WORK_PRESETS[0].ref);
  let kind = $state<WorkKind>(WORK_PRESETS[0].kind);
  let note = $state('');
  let msg = $state('');

  const allowed = $derived(RANK[$currentPlan] >= RANK[$planSettings.config.gates.coach_tools]);
  const load = () =>
    myStudents().then(
      (d) => ((data = d), (error = '')),
      (e) => (error = e.message),
    );
  $effect(() => {
    if ($session.status === 'in') void load();
  });
  const usePreset = (i: number) => {
    preset = i;
    title = WORK_PRESETS[i].title;
    ref = WORK_PRESETS[i].ref;
    kind = WORK_PRESETS[i].kind;
  };
  async function give(e: Event) {
    e.preventDefault();
    if (!open) return;
    msg = '';
    try {
      await setWork({ student: open.uid, kind, ref, title, note });
      note = '';
      msg = `Sent to ${open.name}.`;
      await load();
    } catch (err) {
      msg = err instanceof Error ? err.message : 'Not sent.';
    }
  }
  async function copy(uid: string) {
    try {
      await navigator.clipboard.writeText(coachLink(uid));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* the link is shown */
    }
  }
  const ago = (t: number) => {
    if (!t) return '—';
    const d = Math.floor((Date.now() - t) / 86_400_000);
    return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  };
  const workFor = (uid: string) => data?.assignments.filter((a) => a.student === uid) ?? [];
</script>

<svelte:head><title>My students · Chess Castles</title></svelte:head>

<header class="head">
  <h1 class="display">My students</h1>
  <p class="label">Your students’ progress and games, and the work you set them.</p>
</header>

{#if $session.status !== 'in'}
  <div class="card gate"><button class="btn primary" onclick={() => startSignIn()}>Sign in</button></div>
{:else if !allowed && !data}
  <div class="card gate">
    <PlanBadge plan="elite" size={56} />
    <h2 class="title">Coach tools come with {PLAN_INFO.elite.name}</h2>
    <p>Share one link with your students. See their CC Rating, games and study at a glance, and set them puzzles, openings and lessons.</p>
    <a class="btn primary" href="/plans">See plans</a>
  </div>
{:else if error && !data}
  <p class="error">{error}</p>
{:else if !data}
  <div class="card skel"></div>
{:else}
  <section class="card invite">
    <h2 class="title">Invite students</h2>
    <p class="label">Students open this link, sign in and agree. They can leave at any time.</p>
    <div class="link-row">
      <input readonly value={coachLink($session.uid)} aria-label="Your coach link" onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
      <button class="btn" onclick={() => copy($session.status === 'in' ? $session.uid : '')}><Icon name="copy" size={16} />{copied ? 'Copied' : 'Copy'}</button>
    </div>
  </section>

  {#if !data.students.length}
    <p class="label">No students yet. Share your link to start.</p>
  {:else}
    <div class="scroll card">
      <table>
        <thead>
          <tr><th scope="col">Student</th>{#each KFIDE_SPEEDS as s (s)}<th scope="col">{SPEED_LABEL[s]}</th>{/each}<th scope="col">Games this week</th><th scope="col">Study this week</th><th scope="col">Last game</th><th scope="col">Work</th><th></th></tr>
        </thead>
        <tbody>
          {#each data.students as st (st.uid)}
            <tr class:on={open?.uid === st.uid}>
              <th scope="row"><button class="link" onclick={() => (open = open?.uid === st.uid ? undefined : st)}>{st.name}{#if st.plan} <PlanBadge plan={st.plan} />{/if}</button><span class="label">@{st.username}</span></th>
              {#each KFIDE_SPEEDS as s (s)}<td class="num">{st.kfideTc?.[s]?.rating ?? '—'}</td>{/each}
              <td class="num">{st.games.week}</td>
              <td class="num">{st.studyPoints ?? 0}</td>
              <td>{ago(st.games.last)}</td>
              <td class="num">{st.work.open} open · {st.work.done} done</td>
              <td><button class="btn small" onclick={() => (open = st)}>Open</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if open}
    <div class="detail">
      <section class="card work">
        <h2 class="title">Set work for {open.name}</h2>
        <form onsubmit={give}>
          <select value={preset} onchange={(e) => usePreset(Number((e.currentTarget as HTMLSelectElement).value))} aria-label="Ready-made work">
            {#each WORK_PRESETS as p, i (i)}<option value={i}>{p.title}</option>{/each}
          </select>
          <input bind:value={title} maxlength="120" placeholder="Title" aria-label="Title" required />
          <textarea bind:value={note} maxlength="1000" rows="3" placeholder="A note for your student (optional)" aria-label="Note"></textarea>
          <button class="btn primary">Send</button>
        </form>
        {#if msg}<p class="msg" role="status">{msg}</p>{/if}
        <h3 class="title">Work set</h3>
        {#if !workFor(open.uid).length}
          <p class="label">Nothing yet.</p>
        {:else}
          <ul class="list">
            {#each workFor(open.uid) as w (w.id)}
              <li class:done={!!w.done}>
                <Icon name={w.done ? 'check' : 'flag'} size={16} color={w.done ? 'var(--win)' : 'var(--muted)'} />
                <span>{w.title}{w.note ? ` · ${w.note}` : ''}</span>
                <button class="btn small" onclick={() => deleteWork(w.id).then(load)}>Remove</button>
              </li>
            {/each}
          </ul>
        {/if}
        <button class="btn small danger" onclick={() => open && removeStudent(open.uid).then(() => ((open = undefined), load()))}>Remove {open.name} from my students</button>
      </section>
      <FriendGames uid={open.uid} name={open.name} />
    </div>
  {/if}
{/if}

<style>
  .head h1 {
    margin: 0;
  }
  .head p {
    margin: 4px 0 16px;
  }
  .gate {
    max-width: 520px;
    padding: 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }
  .gate p {
    margin: 0;
    color: var(--text-2);
  }
  .invite {
    padding: 16px 18px;
    margin-bottom: 14px;
  }
  .invite h2,
  .work h2 {
    margin: 0 0 6px;
    font-size: 17px;
  }
  .invite p {
    margin: 0 0 10px;
  }
  .link-row {
    display: flex;
    gap: 8px;
  }
  .link-row input,
  form input,
  form select,
  form textarea {
    min-width: 0;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 8px 10px;
    font: inherit;
  }
  .link-row input {
    flex: 1;
  }
  .scroll {
    overflow-x: auto;
    padding: 6px 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
    font-size: 14px;
  }
  th,
  td {
    text-align: left;
    padding: 9px 8px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  th[scope='row'] {
    display: flex;
    flex-direction: column;
  }
  tr.on {
    background: var(--raised);
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }
  .btn.small {
    min-height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }
  .detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
    margin-top: 14px;
    align-items: start;
  }
  .work {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .work h3 {
    margin: 8px 0 0;
    font-size: 15px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  form .btn {
    align-self: flex-start;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .list li span {
    flex: 1;
  }
  .list li.done span {
    color: var(--muted);
    text-decoration: line-through;
  }
  .danger {
    align-self: flex-start;
    color: var(--loss);
    margin-top: 8px;
  }
  .msg {
    margin: 0;
    font-weight: 700;
    color: var(--accent);
  }
  .error {
    color: var(--loss);
  }
  .skel {
    height: 200px;
  }
  @media (max-width: 900px) {
    .detail {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>

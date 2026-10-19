<script lang="ts">
  /** Admin: find players, see their plan, usage and reports, give plans, suspend. */
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { featureName, grant, revoke, setRating, setTitle, userAction, userDetail, users, type AdminUser, type Can, type UserDetail } from '$lib/admin';
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import { TITLES, TITLE_NAME } from '$lib/titles';
  import { KFIDE_SPEEDS, SPEED_LABEL, type KfideSpeed } from '$lib/kfide';
  import { PLANS, PLAN_INFO, untilText, type Plan } from '$lib/plans';

  let { can, openUid }: { can: Can[]; openUid?: string } = $props();
  // Opened from a report: show that player.
  $effect(() => {
    if (openUid) void show(openUid);
  });
  let q = $state('');
  let filter = $state('active');
  let list = $state<AdminUser[] | undefined>();
  let error = $state('');
  let open = $state<UserDetail | undefined>();
  let busy = $state(false);
  let msg = $state('');

  // Give a plan.
  let gPlan = $state<Plan>('premium');
  let gDays = $state(30);
  let gNote = $state('');
  // Title and rating (owner).
  let tTitle = $state('');
  let rSpeed = $state<KfideSpeed>('rapid');
  let rRating = $state(1500);
  $effect(() => {
    tTitle = open?.user.title ?? '';
  });
  // Account actions.
  let reason = $state('');
  let confirmDelete = $state('');

  let timer: ReturnType<typeof setTimeout>;
  $effect(() => {
    const query = q;
    const f = filter;
    clearTimeout(timer);
    timer = setTimeout(() => load(query, f), query ? 300 : 0);
  });
  async function load(query = q, f = filter) {
    error = '';
    try {
      list = await users(query, f);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load players.';
    }
  }
  async function show(uid: string) {
    msg = '';
    confirmDelete = '';
    try {
      open = await userDetail(uid);
    } catch (e) {
      msg = e instanceof Error ? e.message : 'Could not load this player.';
    }
  }
  async function act(fn: () => Promise<unknown>, done: string) {
    if (!open) return;
    busy = true;
    msg = '';
    try {
      await fn();
      msg = done;
      const uid = open.user.uid;
      await load();
      if (done !== 'Account deleted.') await show(uid);
      else open = undefined;
    } catch (e) {
      msg = e instanceof Error ? e.message : 'That did not work.';
    } finally {
      busy = false;
    }
  }
  const date = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const ago = (t: number) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 2 ? 'now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  };
  const SOURCE: Record<string, string> = { launch: 'Launch offer', referral: 'Invite reward', admin: 'Given by admin', payment: 'Paid' };
  /** Usage over 30 days, per feature. */
  const usageSum = $derived.by(() => {
    const m = new Map<string, number>();
    for (const u of open?.usage ?? []) m.set(u.feature, (m.get(u.feature) ?? 0) + u.n);
    return [...m].sort((a, b) => b[1] - a[1]);
  });
</script>

<div class="layout" class:has-open={!!open}>
  <section class="list-col">
    <div class="search">
      <Icon name="search" size={18} color="var(--muted)" />
      <input bind:value={q} placeholder="Name or Lichess username" aria-label="Find a player" />
    </div>
    <div class="chips" role="group" aria-label="Show">
      {#each [['active', 'Recently active'], ['new', 'Newest'], ...PLANS.map((p) => [p, PLAN_INFO[p].name]), ['suspended', 'Suspended']] as [k, label] (k)}
        <button class="chip" aria-pressed={filter === k} onclick={() => (filter = k)}>{label}</button>
      {/each}
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    {#if !list}
      <div class="card skel"></div>
    {:else if !list.length}
      <p class="label">No players found.</p>
    {:else}
      <ul class="rows">
        {#each list as u (u.uid)}
          <li>
            <button class="row" class:on={open?.user.uid === u.uid} onclick={() => show(u.uid)}>
              <span class="who"><strong>{u.name}</strong><span class="label">@{u.username}{u.country ? ` · ${u.country}` : ''}</span></span>
              <span class="pchip {u.plan}"><PlanBadge plan={u.plan} size={16} /> {PLAN_INFO[u.plan].name}</span>
              <span class="label when">{ago(u.seen)}</span>
              {#if u.suspended}<span class="sus">Suspended</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
      <p class="label">{list.length} shown{list.length >= 100 ? ' (the first 100; search to narrow)' : ''}.</p>
    {/if}
  </section>

  {#if open}
    {@const u = open.user}
    <section class="card detail" aria-label="Player">
      <button class="x" onclick={() => (open = undefined)} aria-label="Close"><Icon name="close" size={18} /></button>
      <h2 class="title"><TitleBadge title={u.title} size={15} />{u.name}</h2>
      <p class="label">
        @{u.username} · <a href="/players/{encodeURIComponent(u.uid)}" target="_blank" rel="noopener">public profile</a> · joined {date(u.joined)} · seen {ago(u.seen)}
      </p>
      {#if u.suspended}<p class="sus big">This account is suspended.</p>{/if}

      <dl class="facts">
        <div><dt>Plan</dt><dd><PlanBadge plan={u.plan} /> {PLAN_INFO[u.plan].name}{u.planUntil ? ` until ${untilText(u.planUntil)}` : ''}</dd></div>
        <div><dt>CC Rating</dt><dd class="num">{u.kfide ?? '—'}{u.kfideGames ? ` (${u.kfideGames} games)` : ''}</dd></div>
        <div><dt>FIDE</dt><dd>{u.fideId ? `${u.fideId}${u.fideRating ? ` · ${u.fideRating}` : ''}` : '—'}</dd></div>
        <div><dt>Games saved</dt><dd class="num">{open.games}{open.lastGame ? `, last ${date(open.lastGame)}` : ''}</dd></div>
        <div><dt>Invited</dt><dd class="num">{open.invited} players{open.invitedBy ? ` · invited by ${open.invitedBy.replace(/^lichess:/, '')}` : ''}</dd></div>
        <div><dt>Coach tools</dt><dd>{open.students} students{open.coaches.length ? ` · coached by ${open.coaches.map((c) => c.replace(/^lichess:/, '')).join(', ')}` : ''}</dd></div>
        <div><dt>Name, place</dt><dd>{[u.first, u.last].filter(Boolean).join(' ') || '—'}{u.location ? ` · ${u.location}` : ''}</dd></div>
        <div><dt>Reports</dt><dd>{open.reportsAbout.length} about them · {open.reportsBy} sent</dd></div>
      </dl>

      {#if can.includes('owner')}
        <h3 class="title">Title and CC Rating</h3>
        <div class="acts">
          <label class="lbl">Title
            <select bind:value={tTitle}>
              <option value="">No title</option>
              {#each TITLES as t (t)}<option value={t}>{t} · {TITLE_NAME[t]}</option>{/each}
            </select>
          </label>
          <button class="btn" disabled={busy || tTitle === (u.title ?? '')} onclick={() => act(() => setTitle(u.uid, tTitle, reason), tTitle ? `Title ${tTitle} given.` : 'Title taken away.')}>Save title</button>
        </div>
        <p class="label">
          CC Ratings: {KFIDE_SPEEDS.filter((s) => u.kfideTc?.[s]).map((s) => `${SPEED_LABEL[s]} ${u.kfideTc![s]!.rating} (${u.kfideTc![s]!.games} games)`).join(' · ') || 'none yet'}
          {#if u.ratingSet && Object.keys(u.ratingSet).length}<br />Set by you: {KFIDE_SPEEDS.filter((s) => u.ratingSet?.[s]).map((s) => `${SPEED_LABEL[s]} ${u.ratingSet![s]!.rating} on ${date(u.ratingSet![s]!.at)}`).join(' · ')}{/if}
        </p>
        <div class="acts">
          <label class="lbl">Speed
            <select bind:value={rSpeed}>{#each KFIDE_SPEEDS as s (s)}<option value={s}>{SPEED_LABEL[s]}</option>{/each}</select>
          </label>
          <label class="lbl">CC Rating <input type="number" min="400" max="3000" step="1" bind:value={rRating} /></label>
          <button class="btn" disabled={busy || !(rRating >= 400 && rRating <= 3000)} onclick={() => act(() => setRating(u.uid, rSpeed, Math.round(rRating), reason), `${SPEED_LABEL[rSpeed]} CC Rating set to ${Math.round(rRating)}.`)}>Set rating</button>
        </div>
        <p class="label">From now on the player's {SPEED_LABEL[rSpeed]} games count from this rating (their earlier games stay in their history). It shows on leaderboards at once and on their own screens the next time they open Chess Castles. The reason box below goes into the admin log.</p>
      {/if}

      <h3 class="title">Plans</h3>
      {#if !open.grants.length}
        <p class="label">Never had a plan: Free.</p>
      {:else}
        <ul class="grants">
          {#each open.grants as g (g.id)}
            {@const active = g.start <= Date.now() && g.until > Date.now()}
            <li class:active>
              <span><PlanBadge plan={g.plan} /> {PLAN_INFO[g.plan].name}</span>
              <span class="label">{date(g.start)} → {date(g.until)} · {SOURCE[g.source] ?? g.source}{g.note ? ` · ${g.note}` : ''}</span>
              {#if g.until > Date.now() && can.includes('grant')}<button class="btn small" disabled={busy} onclick={() => act(() => revoke(g.id), 'Plan ended.')}>End now</button>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if can.includes('grant')}
        <form class="give" onsubmit={(e) => (e.preventDefault(), act(() => grant(u.uid, gPlan, gDays, gNote), `${PLAN_INFO[gPlan].name} given for ${gDays} days.`))}>
          <select bind:value={gPlan} aria-label="Plan">{#each PLANS.filter((p) => p !== 'free') as p (p)}<option value={p}>{PLAN_INFO[p].name}</option>{/each}</select>
          <input type="number" min="1" max="3660" bind:value={gDays} aria-label="Days" />
          <span class="label">days</span>
          <input class="note" bind:value={gNote} placeholder="Why (e.g. coach, prize, paid by UPI)" aria-label="Note" />
          <button class="btn primary" disabled={busy}>Give plan</button>
        </form>
      {/if}

      <h3 class="title">Used in the last 30 days</h3>
      {#if !usageSum.length}
        <p class="label">No limited features used.</p>
      {:else}
        <div class="usage">{#each usageSum as [f, n] (f)}<span class="pill">{featureName(f)} · <strong class="num">{n}</strong></span>{/each}</div>
      {/if}

      {#if open.reportsAbout.length}
        <h3 class="title">Reports about this player</h3>
        <ul class="reports">
          {#each open.reportsAbout as r (r.id)}
            <li><strong>{r.reason}</strong> <span class="label">{date(r.created)} · {r.status}</span>{#if r.details}<p>{r.details}</p>{/if}</li>
          {/each}
        </ul>
      {/if}

      {#if can.includes('suspend') || can.includes('owner')}
        <h3 class="title">Account</h3>
        <input class="reason" bind:value={reason} placeholder="Reason (kept in the admin log)" aria-label="Reason" />
        <div class="acts">
          {#if can.includes('suspend')}
            {#if u.suspended}
              <button class="btn" disabled={busy} onclick={() => act(() => userAction(u.uid, 'unsuspend', reason), 'Account restored.')}>Restore account</button>
            {:else}
              <button class="btn warn" disabled={busy} onclick={() => act(() => userAction(u.uid, 'suspend', reason), 'Account suspended.')}>Suspend</button>
            {/if}
          {/if}
          {#if can.includes('owner')}
            <button class="btn" disabled={busy} onclick={() => act(() => userAction(u.uid, 'reset_rating', reason), 'CC Rating reset.')}>Reset CC Rating</button>
          {/if}
        </div>
        {#if can.includes('owner')}
          <details class="danger">
            <summary>Delete this account</summary>
            <p class="label">Removes the profile, friends, messages, saved games, plans and coach links (reports stay). Their Lichess account is not touched. Type the username to confirm.</p>
            <div class="acts">
              <input bind:value={confirmDelete} placeholder={u.username} aria-label="Type the username" />
              <button class="btn warn" disabled={busy || confirmDelete.trim().toLowerCase() !== u.username.toLowerCase()} onclick={() => act(() => userAction(u.uid, 'delete', reason), 'Account deleted.')}>Delete for ever</button>
            </div>
          </details>
        {/if}
      {/if}
      {#if msg}<p class="msg" role="status">{msg}</p>{/if}
    </section>
  {/if}
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }
  .layout.has-open {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
  }
  .search input {
    flex: 1;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    outline: none;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 10px 0;
  }
  .rows {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: var(--raised);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .row.on {
    border-color: var(--accent);
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .who strong,
  .who .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pchip {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--card);
    border: 1px solid var(--border);
    white-space: nowrap;
  }
  .pchip.premium,
  .pchip.elite {
    border-color: var(--gold);
  }
  .when {
    font-size: 12.5px;
    white-space: nowrap;
  }
  .sus {
    grid-column: 1 / -1;
    color: var(--loss);
    font-size: 12.5px;
    font-weight: 700;
  }
  .sus.big {
    margin: 0 0 8px;
  }
  .detail {
    position: relative;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .x {
    position: absolute;
    top: 10px;
    right: 10px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .detail h2 {
    margin: 0;
    font-size: 22px;
  }
  .detail h3 {
    margin: 12px 0 4px;
    font-size: 15px;
  }
  .detail p {
    margin: 0;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 14px;
    margin: 10px 0 0;
  }
  .facts dt {
    font-size: 12px;
    color: var(--muted);
  }
  .facts dd {
    margin: 0;
    font-weight: 600;
    font-size: 14px;
  }
  .grants,
  .reports {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .grants li {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--raised);
    opacity: 0.7;
  }
  .grants li.active {
    opacity: 1;
    border-left: 3px solid var(--accent);
  }
  .grants .label {
    flex: 1;
    font-size: 12.5px;
  }
  .btn.small {
    min-height: 30px;
    padding: 0 10px;
    font-size: 13px;
  }
  .give,
  .lbl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
  .lbl input {
    width: 90px;
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 6px;
  }
  .give select,
  .give input,
  .reason,
  .acts input {
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 0 10px;
    font: inherit;
  }
  .give input[type='number'] {
    width: 80px;
  }
  .give .note {
    flex: 1;
    min-width: 160px;
  }
  .reason {
    width: 100%;
  }
  .usage {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .reports li {
    padding: 8px;
    border-radius: 8px;
    background: var(--raised);
  }
  .btn.warn {
    border-color: var(--loss);
    color: var(--loss);
  }
  .danger {
    margin-top: 8px;
  }
  .danger summary {
    cursor: pointer;
    color: var(--loss);
    font-weight: 700;
  }
  .msg {
    margin-top: 8px !important;
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
    .layout.has-open {
      grid-template-columns: minmax(0, 1fr);
    }
    .layout.has-open .list-col {
      display: none;
    }
  }
</style>

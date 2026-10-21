<script lang="ts">
  /** The admin dashboard: visitors, pages, features, members, plans and the free-plan meters. */
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { featureName, overview, pageName, type Overview } from '$lib/admin';
  import { PLANS, PLANS_ON, PLAN_INFO } from '$lib/plans';
  import { fedName } from '$lib/fideFeds';
  import DayChart from './DayChart.svelte';
  import DayTable from './DayTable.svelte';
  import RankBars from './RankBars.svelte';

  let days = $state(30);
  let data = $state<Overview | undefined>();
  let error = $state('');
  let refreshed = $state(Date.now());
  $effect(() => {
    const d = days;
    error = '';
    overview(d).then(
      (o) => days === d && ((data = o), (refreshed = Date.now())),
      (e) => (error = e.message),
    );
  });
  // Launch days: the health numbers refresh every minute while the dashboard is open.
  $effect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const d = days;
      overview(d).then(
        (o) => days === d && ((data = o), (refreshed = Date.now())),
        () => {},
      );
    }, 60_000);
    return () => clearInterval(t);
  });
  const today = $derived(data ? Object.keys(data.series.views ?? {}).sort().at(-1) : undefined);
  const errorsToday = $derived(data && today ? (data.series.errors?.[today] ?? 0) : 0);
  const slowShare = $derived.by(() => {
    const l = data?.top.load ?? [];
    const all = l.reduce((s, r) => s + r.count, 0);
    return all ? Math.round((100 * (l.find((r) => r.key === 'slow')?.count ?? 0)) / all) : 0;
  });
  const KIND: Record<string, [string, string]> = {
    js: ['Script', '#e64a19'],
    promise: ['Script', '#e64a19'],
    api: ['Our server', '#c084fc'],
    server: ['Server crash', '#ef4444'],
    lichess: ['Lichess', '#4d86e6'],
    chunk: ['Old tab reloaded', '#9aa4b2'],
    engine: ['Engine', '#edb040'],
  };
  const ago = (t: number) => {
    const m = Math.round((Date.now() - t) / 60_000);
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  };
  const browserName = (k: string) => ({ chrome: 'Chrome', edge: 'Edge', safari: 'Safari', firefox: 'Firefox', samsung: 'Samsung Internet', opera: 'Opera', other: 'Other' })[k] ?? k;
  const osName = (k: string) => ({ android: 'Android', ios: 'iPhone / iPad', windows: 'Windows', mac: 'Mac', linux: 'Linux', other: 'Other' })[k] ?? k;
  const loadName = (k: string) => ({ fast: 'Fast (under 2 s)', ok: 'OK (2 to 5 s)', slow: 'Slow (over 5 s)' })[k] ?? k;
  const kindName = (k: string) => KIND[k]?.[0] ?? k;
  /** Two-letter country codes as names. */
  const countryName = (k: string) => {
    if (k === 'XX') return 'Unknown';
    try {
      return new Intl.DisplayNames(undefined, { type: 'region' }).of(k) ?? k;
    } catch {
      return fedName(k) ?? k;
    }
  };
  const visitorName = (k: string) => ({ new: 'New visitors', returning: 'Returning visitors', signed_in: 'Signed in' })[k] ?? k;
  const deviceName = (k: string) => ({ mobile: 'Phone', tablet: 'Tablet', desktop: 'Computer', unknown: 'Unknown' })[k] ?? k;
  const GB = 1024 ** 3;
  const payingNote = 'Plans given free now (launch offer, invites, admin): payments are not connected yet.';
</script>

<div class="bar">
  <div class="segmented range" role="group" aria-label="Period">
    {#each [7, 30, 90] as d (d)}<button aria-pressed={days === d} onclick={() => (days = d)}>{d} days</button>{/each}
  </div>
  {#if data}<span class="label">India time, from {new Date(data.from + 'T00:00:00').toLocaleDateString()}</span>{/if}
</div>

{#if error}
  <p class="error">{error}</p>
{:else if !data}
  <div class="grid4">{#each [0, 1, 2, 3] as i (i)}<div class="card skel"></div>{/each}</div>
{:else}
  <!-- Site health first: what needs attention right now. -->
  <section class="card health" aria-label="Site health">
    <div class="h-top">
      <h3 class="title">Site health</h3>
      <span class="label">Updates every minute · {ago(refreshed)}</span>
    </div>
    <div class="h-kpis">
      <div class="h-kpi"><span class="label">On the site now</span><strong class="num"><span class="pulse"></span>{data.health?.live ?? 0}</strong><span class="label">last 5 minutes</span></div>
      <div class="h-kpi"><span class="label">Errors today</span><strong class="num" class:alert={errorsToday > 0}>{errorsToday}</strong><span class="label">from browsers</span></div>
      <div class="h-kpi"><span class="label">Server crashes (7 days)</span><strong class="num" class:alert={(data.health?.errors ?? []).some((e) => e.kind === 'server')}>{(data.health?.errors ?? []).filter((e) => e.kind === 'server').reduce((s, e) => s + e.n, 0)}</strong><span class="label">our API</span></div>
      <div class="h-kpi"><span class="label">Slow first loads</span><strong class="num" class:alert={slowShare >= 20}>{slowShare}%</strong><span class="label">over 5 seconds</span></div>
    </div>
    {#if data.health?.livePages.length}
      <p class="label live-pages">Now on: {data.health.livePages.map((p) => `${pageName(p.page)} (${p.n})`).join(' · ')}</p>
    {/if}
    {#if !data.health?.errors.length}
      <p class="ok-line">No errors in the last 7 days.</p>
    {:else}
      <div class="err-wrap">
        <table class="errs">
          <thead><tr><th scope="col">What</th><th scope="col">Error</th><th scope="col">Where</th><th scope="col">Times</th><th scope="col">Last</th></tr></thead>
          <tbody>
            {#each data.health.errors as e (e.kind + e.message)}
              <tr>
                <td><span class="kind" style="--c: {KIND[e.kind]?.[1] ?? '#9aa4b2'}">{kindName(e.kind)}</span></td>
                <td class="msg">{e.message}</td>
                <td class="label">{e.page ? pageName(e.page) : '–'}{e.device ? ` · ${deviceName(e.device)}` : ''}{e.browser ? ` · ${browserName(e.browser)}` : ''}</td>
                <td class="num">{e.n}</td>
                <td class="label nowrap">{ago(e.last)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="label">“Lichess” errors are often the player's side (a friend who doesn't accept challenges, an expired sign-in); many of the same one point at a real problem. “Old tab reloaded”: a page open before a deploy reloaded itself once, nothing to fix.</p>
    {/if}
  </section>

  <div class="kpis">
    <div class="card kpi"><span class="label">Visitors</span><strong class="num">{data.totals.visitors.toLocaleString()}</strong><span class="label">distinct per day, added up</span></div>
    <div class="card kpi"><span class="label">Page views</span><strong class="num">{data.totals.views.toLocaleString()}</strong><span class="label">{data.totals.visitors ? (data.totals.views / data.totals.visitors).toFixed(1) : 0} per visitor</span></div>
    <div class="card kpi"><span class="label">New sign-ups</span><strong class="num">{data.totals.signups.toLocaleString()}</strong><span class="label">{data.members.new1 ?? 0} today · {data.members.new7 ?? 0} this week</span></div>
    <div class="card kpi"><span class="label">Members</span><strong class="num">{(data.members.total ?? 0).toLocaleString()}</strong><span class="label">{data.members.active1 ?? 0} active today · {data.members.active7 ?? 0} this week</span></div>
    <a class="card kpi" href="#reports"><span class="label">Open reports</span><strong class="num" class:alert={data.openReports > 0}>{data.openReports}</strong><span class="label">fair play and support</span></a>
    <a class="card kpi" href="#feedback"><span class="label">New feedback</span><strong class="num">{data.feedback?.fresh ?? 0}</strong><span class="label">{data.feedback?.avg ? `average ${data.feedback.avg.toFixed(1)} / 5` : 'no ratings yet'}</span></a>
  </div>

  <div class="grid3">
    <DayChart title="Visitors per day" series={data.series.visitors} from={data.from} days={data.days} />
    <DayChart title="Page views per day" series={data.series.views} from={data.from} days={data.days} />
    <DayChart title="Sign-ups per day" series={data.series.signup} from={data.from} days={data.days} />
  </div>

  <DayTable series={data.series} from={data.from} days={data.days} />

  <div class="grid2">
    <RankBars title="Most viewed pages" rows={data.top.views} name={pageName} />
    <RankBars title="Features used most" rows={data.top.features} name={featureName} note="Every visitor, signed in or not." />
  </div>

  <div class="grid3">
    <RankBars title="Limits reached" rows={data.top.limits} name={featureName} note="Where people hit a limit." empty="No limits reached yet." />
    {#if PLANS_ON}<RankBars title="Plan interest" rows={data.top.interest} name={(k) => PLAN_INFO[k as keyof typeof PLAN_INFO]?.name ?? k} note="“I want …” taps on the Plans page." empty="No taps yet." />{/if}
    {#if PLANS_ON}<section class="card plans">
      <h3 class="title">Members by plan</h3>
      <p class="label note">{payingNote}</p>
      <ul>
        {#each PLANS as p (p)}
          <li><span><PlanBadge plan={p} /> {PLAN_INFO[p].name}</span><strong class="num">{data.plans[p].toLocaleString()}</strong></li>
        {/each}
      </ul>
    </section>{/if}
  </div>

  <div class="grid4">
    <RankBars title="Where visitors come from" rows={data.top.ref} name={(k) => (k === 'direct' ? 'Direct / app' : k)} />
    <RankBars title="Countries" rows={data.top.country} name={countryName} />
    <RankBars title="Devices" rows={data.top.device} name={deviceName} />
    <RankBars title="New or returning" rows={data.top.visitor} name={visitorName} />
  </div>

  <div class="grid4">
    <RankBars title="Browsers" rows={data.top.browser ?? []} name={browserName} empty="Counted from today." />
    <RankBars title="Systems" rows={data.top.os ?? []} name={osName} empty="Counted from today." />
    <RankBars title="First page load" rows={data.top.load ?? []} name={loadName} empty="Counted from today." />
    <RankBars title="Errors by kind" rows={data.top.error ?? []} name={kindName} empty="No errors." />
  </div>

  <div class="grid2">
    <section class="card usage">
      <h3 class="title">Limited features, signed-in players</h3>
      {#if !data.usage.length}
        <p class="label">Nothing used yet.</p>
      {:else}
        <table>
          <thead><tr><th scope="col">Feature</th><th scope="col">Uses</th><th scope="col">Players</th></tr></thead>
          <tbody>
            {#each data.usage as u (u.feature)}<tr><th scope="row">{featureName(u.feature)}</th><td class="num">{u.uses.toLocaleString()}</td><td class="num">{u.players.toLocaleString()}</td></tr>{/each}
          </tbody>
        </table>
      {/if}
    </section>
    <section class="card meters">
      <h3 class="title">Free plan meters</h3>
      <div class="meter">
        <span>Database size</span>
        <span class="track"><span class="fill" style="width: {Math.min(100, (100 * data.dbBytes) / (5 * GB))}%"></span></span>
        <span class="num">{(data.dbBytes / 1024 ** 2).toFixed(1)} MB of 5 GB</span>
      </div>
      <div class="meter">
        <span>Guru lessons today</span>
        <span class="track"><span class="fill" style="width: {Math.min(100, data.guruToday / 3)}%"></span></span>
        <span class="num">{data.guruToday}</span>
      </div>
      <p class="label">
        Requests (100,000 a day free) and database reads and writes are on the <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener">Cloudflare dashboard</a>. Analytics are anonymous: no names, cookies or IP addresses.
      </p>
    </section>
  </div>
{/if}

<style>
  .health {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 12px;
    border-color: color-mix(in srgb, var(--gold) 40%, var(--border));
  }
  .h-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .h-top h3 {
    margin: 0;
  }
  .h-kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .h-kpi {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--raised);
  }
  .h-kpi strong {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 26px;
  }
  .pulse {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--win);
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }
  .alert {
    color: var(--loss);
  }
  .live-pages,
  .ok-line {
    margin: 0;
  }
  .ok-line {
    color: var(--win);
    font-weight: 700;
  }
  .err-wrap {
    max-height: 420px;
    overflow: auto;
  }
  .errs {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .errs th {
    text-align: left;
    font-size: 12px;
    color: var(--muted);
    padding: 6px 8px;
    position: sticky;
    top: 0;
    background: var(--card);
  }
  .errs td {
    padding: 7px 8px;
    border-top: 1px solid var(--border);
    vertical-align: top;
    text-align: left;
  }
  .errs .msg {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 12px;
    word-break: break-word;
  }
  .nowrap {
    white-space: nowrap;
  }
  .kind {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    white-space: nowrap;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, transparent);
  }
  @media (max-width: 900px) {
    .h-kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  /* Phones: each error as a small card (kind, times, when; the message; where), not five squeezed columns. */
  @media (max-width: 640px) {
    .errs thead {
      display: none;
    }
    .errs,
    .errs tbody {
      display: block;
    }
    .errs tr {
      display: grid;
      grid-template-columns: auto 1fr auto;
      grid-template-areas: 'kind times last' 'msg msg msg' 'where where where';
      gap: 4px 8px;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid var(--border);
    }
    .errs td {
      padding: 0;
      border: 0;
    }
    .errs td:nth-child(1) {
      grid-area: kind;
    }
    .errs td:nth-child(2) {
      grid-area: msg;
    }
    .errs td:nth-child(3) {
      grid-area: where;
    }
    .errs td:nth-child(4) {
      grid-area: times;
      font-weight: 800;
    }
    .errs td:nth-child(4)::before {
      content: '× ';
      color: var(--muted);
      font-weight: 600;
    }
    .errs td:nth-child(5) {
      grid-area: last;
    }
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .range {
    width: 300px;
    max-width: 100%;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }
  .kpi {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--text);
    text-decoration: none;
  }
  .kpi strong {
    font-size: 28px;
  }
  .kpi .alert {
    color: var(--loss);
  }
  .grid2,
  .grid3,
  .grid4 {
    display: grid;
    gap: 12px;
    margin-bottom: 12px;
  }
  .grid2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .grid4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .skel {
    height: 110px;
  }
  .plans,
  .usage,
  .meters {
    padding: 14px 16px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .note {
    margin: -4px 0 8px;
    font-size: 12.5px;
  }
  .plans ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .plans li {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  th,
  td {
    text-align: right;
    padding: 6px 4px;
    border-bottom: 1px solid var(--border);
  }
  th[scope='row'],
  thead th:first-child {
    text-align: left;
    font-weight: 600;
  }
  .meter {
    display: grid;
    grid-template-columns: 140px minmax(60px, 1fr) auto;
    gap: 10px;
    align-items: center;
    font-size: 13.5px;
    margin-bottom: 8px;
  }
  .track {
    height: 8px;
    border-radius: 4px;
    background: var(--raised);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
  }
  .meters p {
    margin: 6px 0 0;
    font-size: 12.5px;
  }
  .error {
    color: var(--loss);
  }
  @media (max-width: 1200px) {
    .kpis {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .grid4 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 900px) {
    .grid2,
    .grid3 {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 560px) {
    .kpis,
    .grid4 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .meter {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .meter .track {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>

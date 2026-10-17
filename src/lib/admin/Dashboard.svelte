<script lang="ts">
  /** The admin dashboard: visitors, pages, features, members, plans and the free-plan meters. */
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { featureName, overview, pageName, type Overview } from '$lib/admin';
  import { PLANS, PLAN_INFO } from '$lib/plans';
  import { fedName } from '$lib/fideFeds';
  import DayChart from './DayChart.svelte';
  import RankBars from './RankBars.svelte';

  let days = $state(30);
  let data = $state<Overview | undefined>();
  let error = $state('');
  $effect(() => {
    const d = days;
    error = '';
    overview(d).then(
      (o) => days === d && (data = o),
      (e) => (error = e.message),
    );
  });
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
  <div class="kpis">
    <div class="card kpi"><span class="label">Visitors</span><strong class="num">{data.totals.visitors.toLocaleString()}</strong><span class="label">distinct per day, added up</span></div>
    <div class="card kpi"><span class="label">Page views</span><strong class="num">{data.totals.views.toLocaleString()}</strong><span class="label">{data.totals.visitors ? (data.totals.views / data.totals.visitors).toFixed(1) : 0} per visitor</span></div>
    <div class="card kpi"><span class="label">New sign-ups</span><strong class="num">{data.totals.signups.toLocaleString()}</strong><span class="label">{data.members.new1 ?? 0} today · {data.members.new7 ?? 0} this week</span></div>
    <div class="card kpi"><span class="label">Members</span><strong class="num">{(data.members.total ?? 0).toLocaleString()}</strong><span class="label">{data.members.active1 ?? 0} active today · {data.members.active7 ?? 0} this week</span></div>
    <a class="card kpi" href="#reports"><span class="label">Open reports</span><strong class="num" class:alert={data.openReports > 0}>{data.openReports}</strong><span class="label">fair play and support</span></a>
  </div>

  <div class="grid3">
    <DayChart title="Visitors per day" series={data.series.visitors} from={data.from} days={data.days} />
    <DayChart title="Page views per day" series={data.series.views} from={data.from} days={data.days} />
    <DayChart title="Sign-ups per day" series={data.series.signup} from={data.from} days={data.days} />
  </div>

  <div class="grid2">
    <RankBars title="Most viewed pages" rows={data.top.views} name={pageName} />
    <RankBars title="Features used most" rows={data.top.features} name={featureName} note="Every visitor, signed in or not." />
  </div>

  <div class="grid3">
    <RankBars title="Limits reached" rows={data.top.limits} name={featureName} note="Where people want more: the best signal for paid plans." empty="No limits reached yet." />
    <RankBars title="Plan interest" rows={data.top.interest} name={(k) => PLAN_INFO[k as keyof typeof PLAN_INFO]?.name ?? k} note="“I want …” taps on the Plans page." empty="No taps yet." />
    <section class="card plans">
      <h3 class="title">Members by plan</h3>
      <p class="label note">{payingNote}</p>
      <ul>
        {#each PLANS as p (p)}
          <li><span><PlanBadge plan={p} /> {PLAN_INFO[p].name}</span><strong class="num">{data.plans[p].toLocaleString()}</strong></li>
        {/each}
      </ul>
    </section>
  </div>

  <div class="grid4">
    <RankBars title="Where visitors come from" rows={data.top.ref} name={(k) => (k === 'direct' ? 'Direct / app' : k)} />
    <RankBars title="Countries" rows={data.top.country} name={countryName} />
    <RankBars title="Devices" rows={data.top.device} name={deviceName} />
    <RankBars title="New or returning" rows={data.top.visitor} name={visitorName} />
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
    grid-template-columns: repeat(5, minmax(0, 1fr));
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

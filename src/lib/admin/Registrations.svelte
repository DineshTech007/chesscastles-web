<script lang="ts">
  /** Who registered when: new players per day (India time) and the list of recent registrations, newest first. */
  import { call } from '$lib/social';
  import DayChart from './DayChart.svelte';

  interface Signup {
    uid: string;
    name: string;
    username: string;
    via: string;
    country?: string;
    created: number;
    seen: number;
    games: number;
    suspended: boolean;
  }
  let days = $state(30);
  let data = $state<{ days: number; from: string; perDay: Record<string, number>; total: number; recent: Signup[] } | undefined>();
  let error = $state('');
  $effect(() => {
    const d = days;
    call<NonNullable<typeof data>>('GET', `admin/signups?days=${d}`).then(
      (r) => ((data = r), (error = '')),
      (e) => (error = (e as Error).message),
    );
  });

  const IST = { timeZone: 'Asia/Kolkata' } as const;
  const when = (t: number) => new Date(t).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const today = $derived(data?.perDay[new Date().toLocaleDateString('en-CA', IST)] ?? 0);
  const yesterday = $derived(data?.perDay[new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', IST)] ?? 0);
  const inRange = $derived(Object.values(data?.perDay ?? {}).reduce((s, n) => s + n, 0));
  const via = (v: string) => (v === 'lichess' ? 'Lichess' : v === 'google' ? 'Google' : v);
</script>

<section class="reg">
  <div class="head">
    <h2 class="title">Registrations</h2>
    <div class="segmented" role="group" aria-label="Days">
      {#each [7, 30, 90] as d (d)}<button aria-pressed={days === d} onclick={() => (days = d)}>{d} days</button>{/each}
    </div>
  </div>
  {#if error}<p class="label err">{error}</p>{/if}
  {#if data}
    <div class="tiles">
      <div class="card tile"><span class="label">Today</span><strong class="num">{today}</strong></div>
      <div class="card tile"><span class="label">Yesterday</span><strong class="num">{yesterday}</strong></div>
      <div class="card tile"><span class="label">Last {data.days} days</span><strong class="num">{inRange}</strong></div>
      <div class="card tile"><span class="label">All players</span><strong class="num">{data.total}</strong></div>
    </div>
    <DayChart title="New players per day (India time)" series={data.perDay} from={data.from} days={data.days} />
    <div class="card table-card">
      <table>
        <thead><tr><th>Registered (IST)</th><th>Player</th><th>Signed in with</th><th>Country</th><th>Games</th><th>Last seen</th></tr></thead>
        <tbody>
          {#each data.recent as s (s.uid)}
            <tr class:sus={s.suspended}>
              <td class="num">{when(s.created)}</td>
              <td><strong>{s.name}</strong>{#if s.username && s.username !== s.name}<span class="label"> · {s.username}</span>{/if}</td>
              <td>{via(s.via)}</td>
              <td>{#if s.country}<img src="/flags/{s.country}.svg" alt="" width="18" height="12" /> {s.country}{/if}</td>
              <td class="num">{s.games}</td>
              <td class="num">{s.seen ? when(s.seen) : '–'}</td>
            </tr>
          {:else}
            <tr><td colspan="6" class="label">No registrations in these days.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if !error}
    <p class="label">Loading…</p>
  {/if}
</section>

<style>
  .reg {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .title {
    margin: 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
  }
  .tile strong {
    font-size: 26px;
  }
  .table-card {
    padding: 0;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    text-align: left;
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  th {
    font-size: 12px;
    color: var(--text-2);
    font-weight: 700;
  }
  td img {
    vertical-align: -1px;
    border-radius: 2px;
  }
  tr.sus td {
    opacity: 0.5;
    text-decoration: line-through;
  }
  .err {
    color: var(--loss, #e5534b);
  }
</style>

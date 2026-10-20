<script lang="ts">
  /**
   * The dashboard's day by day: each day's visitors, page views, visits, sign-ups, games and errors in one row,
   * newest first (days in UTC, as the counts are kept). Real players only: the owner's, admins' and the
   * tester's visits are not counted.
   */
  let { series, from, days }: { series: Record<string, Record<string, number>>; from: string; days: number } = $props();

  const COLUMNS: [key: string, title: string][] = [
    ['visitors', 'Visitors'],
    ['visitor_new', 'New'],
    ['views', 'Page views'],
    ['sessions', 'Visits'],
    ['signup', 'Sign-ups'],
    ['games', 'Games'],
    ['errors', 'Errors'],
  ];
  const rows = $derived.by(() => {
    const start = Date.parse(from + 'T00:00:00Z');
    return Array.from({ length: days }, (_, i) => new Date(start + (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
  });
  const label = (day: string) => new Date(day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const at = (key: string, day: string) => series[key]?.[day] ?? 0;
</script>

<section class="card table-card">
  <h3 class="title">Day by day</h3>
  <table>
    <thead>
      <tr><th>Day</th>{#each COLUMNS as [, title] (title)}<th class="n">{title}</th>{/each}</tr>
    </thead>
    <tbody>
      {#each rows as day (day)}
        <tr>
          <td>{label(day)}</td>
          {#each COLUMNS as [key] (key)}
            <td class="n num" class:zero={!at(key, day)} class:err={key === 'errors' && at(key, day) > 0}>{at(key, day).toLocaleString()}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="label note">New: first visit that day on this browser. Visits: tabs opened. Games: played by signed-in players. Days in UTC (India is 5½ hours ahead).</p>
</section>

<style>
  .table-card {
    padding: 0;
    overflow: auto;
    max-height: 480px;
    margin-bottom: 12px;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--card);
  }
  h3 {
    padding: 12px 12px 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  th {
    font-size: 12px;
    color: var(--text-2);
    font-weight: 700;
  }
  .n {
    text-align: right;
  }
  .zero {
    color: var(--text-2);
    opacity: 0.6;
  }
  .err {
    color: var(--loss, #e5534b);
  }
  .note {
    padding: 8px 12px 12px;
    margin: 0;
  }
</style>

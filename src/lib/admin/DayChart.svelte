<script lang="ts">
  /** One number per day as columns (visitors, page views…), with the total and a tooltip per day. */
  let { title, series, from, days }: { title: string; series: Record<string, number> | undefined; from: string; days: number } = $props();

  const W = 600;
  const H = 150;
  const PAD_B = 18;
  const list = $derived.by(() => {
    const out: { day: string; n: number }[] = [];
    const start = Date.parse(from + 'T00:00:00Z');
    for (let i = 0; i < days; i++) {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day, n: series?.[day] ?? 0 });
    }
    return out;
  });
  const total = $derived(list.reduce((s, d) => s + d.n, 0));
  const max = $derived(Math.max(1, ...list.map((d) => d.n)));
  const slot = $derived(W / list.length);
  const barW = $derived(Math.max(2, slot - 2));
  let hover = $state<number | undefined>();
  const label = (day: string) => new Date(day + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
</script>

<figure class="card chart">
  <figcaption>
    <span class="label">{title}</span>
    <strong class="num">{total.toLocaleString()}</strong>
    {#if hover !== undefined}<span class="tip num">{label(list[hover].day)}: {list[hover].n.toLocaleString()}</span>{/if}
  </figcaption>
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="{title} per day, {total} in all" onmouseleave={() => (hover = undefined)}>
    <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} class="base" />
    {#each list as d, i (d.day)}
      {@const h = (d.n / max) * (H - PAD_B - 8)}
      <rect class="bar" class:on={hover === i} x={i * slot + 1} y={H - PAD_B - h} width={barW} height={Math.max(0, h)} rx={Math.min(4, barW / 2)} />
      <!-- A tall hit area per day, easier to hover than the column. -->
      <rect class="hit" x={i * slot} y="0" width={slot} height={H} role="presentation" onmouseenter={() => (hover = i)} />
    {/each}
  </svg>
  <div class="axis label"><span>{label(list[0].day)}</span><span>max {max.toLocaleString()} a day</span><span>{label(list[list.length - 1].day)}</span></div>
</figure>

<style>
  .chart {
    margin: 0;
    padding: 14px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  figcaption {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  figcaption strong {
    font-size: 24px;
  }
  .tip {
    margin-left: auto;
    font-size: 13px;
    color: var(--text-2);
  }
  svg {
    width: 100%;
    height: 120px;
    display: block;
  }
  .base {
    stroke: var(--border);
    stroke-width: 1;
  }
  .bar {
    fill: var(--accent);
    opacity: 0.85;
  }
  .bar.on {
    opacity: 1;
  }
  .hit {
    fill: transparent;
  }
  .axis {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
</style>

<script lang="ts">
  import type { RatingPoint } from '$lib/api';

  let { points }: { points: RatingPoint[] } = $props();

  const SERIES = [
    { key: 'standard', label: 'Standard', color: 'var(--series-1)' },
    { key: 'rapid', label: 'Rapid', color: 'var(--series-2)' },
    { key: 'blitz', label: 'Blitz', color: 'var(--series-3)' },
  ] as const;
  type Key = (typeof SERIES)[number]['key'];

  const W = 720;
  const H = 300;
  const PAD = { l: 48, r: 72, t: 16, b: 30 };
  let hover = $state<number | undefined>();
  let showTable = $state(false);

  const shown = $derived(SERIES.filter((s) => points.some((p) => p[s.key] !== undefined)));
  const values = $derived(points.flatMap((p) => shown.map((s) => p[s.key]).filter((v): v is number => v !== undefined)));
  const lo = $derived(values.length ? Math.floor((Math.min(...values) - 25) / 50) * 50 : 0);
  const hi = $derived(values.length ? Math.ceil((Math.max(...values) + 25) / 50) * 50 : 1);
  const x = (i: number) => PAD.l + (points.length < 2 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - PAD.t - PAD.b);

  /** Path segments, broken where a month has no rating. */
  function path(key: Key): string {
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  const ticks = $derived.by(() => {
    const step = hi - lo > 600 ? 200 : hi - lo > 250 ? 100 : 50;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  });
  const years = $derived.by(() => {
    const out: { i: number; label: string }[] = [];
    let last = '';
    const every = points.length > 120 ? 2 : 1;
    points.forEach((p, i) => {
      const yr = p.month.slice(0, 4);
      if (yr !== last && p.month.endsWith('-01') && Number(yr) % every === 0) out.push({ i, label: yr });
      last = yr;
    });
    return out;
  });
  const lastOf = (key: Key) => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i][key] !== undefined) return { i, v: points[i][key]! };
    return undefined;
  };

  /** End labels pushed apart so they never overlap. */
  const endLabels = $derived.by(() => {
    const items = shown
      .map((s) => ({ s, last: lastOf(s.key) }))
      .filter((e) => e.last)
      .map((e) => ({ ...e, ly: y(e.last!.v) }))
      .sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < items.length; i++) items[i].ly = Math.max(items[i].ly, items[i - 1].ly + 15);
    return items;
  });

  function onmove(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = (px - PAD.l) / (W - PAD.l - PAD.r);
    hover = Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1))));
  }

  const monthName = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  };
</script>

<div class="chart">
  <div class="legend" aria-hidden="true">
    {#each shown as s (s.key)}<span><i style="background: {s.color}"></i>{s.label}</span>{/each}
    <button class="link" onclick={() => (showTable = !showTable)}>{showTable ? 'Show chart' : 'Show table'}</button>
  </div>

  {#if showTable}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Month</th>{#each shown as s (s.key)}<th>{s.label}</th>{/each}<th>Games</th></tr></thead>
        <tbody>
          {#each [...points].reverse() as p (p.month)}
            <tr><td>{monthName(p.month)}</td>{#each shown as s (s.key)}<td class="num">{p[s.key] ?? '—'}</td>{/each}<td class="num">{p.games}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <svg
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="Rating history from {monthName(points[0].month)} to {monthName(points[points.length - 1].month)}"
      onpointermove={onmove}
      onpointerleave={() => (hover = undefined)}
    >
      {#each ticks as t (t)}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} class="grid" />
        <text x={PAD.l - 8} y={y(t) + 4} class="tick" text-anchor="end">{t}</text>
      {/each}
      {#each years as yr (yr.i)}
        <text x={x(yr.i)} y={H - 8} class="tick" text-anchor="middle">{yr.label}</text>
      {/each}
      {#each shown as s (s.key)}
        <path d={path(s.key)} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      {/each}
      {#each endLabels as e (e.s.key)}
        <circle cx={x(e.last!.i)} cy={y(e.last!.v)} r="4" fill={e.s.color} class="ring" />
        <text x={x(e.last!.i) + 9} y={e.ly + 4} class="end">{e.last!.v}</text>
      {/each}
      {#if hover !== undefined}
        <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} class="cross" />
        {#each shown as s (s.key)}
          {#if points[hover][s.key] !== undefined}
            <circle cx={x(hover)} cy={y(points[hover][s.key]!)} r="5" fill={s.color} class="ring" />
          {/if}
        {/each}
      {/if}
    </svg>
    {#if hover !== undefined}
      {@const p = points[hover]}
      <div class="tip" style="left: {Math.min(84, Math.max(16, (x(hover) / W) * 100))}%">
        <strong>{monthName(p.month)}</strong>
        {#each shown as s (s.key)}
          {#if p[s.key] !== undefined}<span><i style="background: {s.color}"></i>{s.label} <b class="num">{p[s.key]}</b></span>{/if}
        {/each}
        {#if p.games}<span class="muted">{p.games} standard {p.games === 1 ? 'game' : 'games'}</span>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart {
    position: relative;
  }
  .legend {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 13.5px;
    color: var(--text-2);
    margin-bottom: 6px;
  }
  .legend i,
  .tip i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 6px;
  }
  .link {
    margin-left: auto;
    background: none;
    border: 0;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    touch-action: pan-y;
  }
  .grid {
    stroke: var(--border-soft);
    stroke-width: 1;
  }
  .tick {
    fill: var(--muted);
    font-size: 12px;
  }
  .end {
    fill: var(--text);
    font-size: 12.5px;
    font-weight: 700;
  }
  .ring {
    stroke: var(--card);
    stroke-width: 2;
  }
  .cross {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .tip {
    position: absolute;
    top: 34px;
    transform: translateX(-50%);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: var(--shadow);
  }
  .muted {
    color: var(--muted);
  }
  .table-wrap {
    max-height: 320px;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-soft);
  }
  th {
    color: var(--muted);
    font-weight: 500;
    position: sticky;
    top: 0;
    background: var(--card);
  }
</style>

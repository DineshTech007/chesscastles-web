<script lang="ts">
  /**
   * The CC Rating along the games at one speed: the line from the starting
   * rating through every game, the highest point marked, hover (or the arrow
   * keys) for each game's date, result and change.
   */
  import { formatDate } from '$lib/format';
  import { KFIDE_SPEEDS, SPEED_LABEL, type KfideAll, type KfideSpeed } from '$lib/kfide';

  let { all }: { all: KfideAll } = $props();
  /** "4 Oct 2026", without the time. */
  const day = (ms: number) => formatDate(ms).split(',')[0];

  const speeds = $derived(KFIDE_SPEEDS.filter((s) => all[s].history.length));
  let chosen = $state<KfideSpeed | undefined>();
  const speed = $derived(chosen && speeds.includes(chosen) ? chosen : speeds.includes(all.main) ? all.main : speeds[0]);
  /** The rating before the first game, then after each game. */
  const pts = $derived.by(() => {
    const h = speed ? all[speed].history : [];
    return h.length ? [{ r: h[0].before, at: h[0].at, g: undefined }, ...h.map((g) => ({ r: g.after, at: g.at, g }))] : [];
  });
  const range = $derived.by(() => {
    const rs = pts.map((p) => p.r);
    const lo = Math.min(...rs);
    const hi = Math.max(...rs);
    const pad = Math.max(30, (hi - lo) * 0.15);
    return { lo: lo - pad, hi: hi + pad };
  });
  /** Where the highest rating was first reached. */
  const peak = $derived(pts.reduce((b, p, i) => (p.r > pts[b].r ? i : b), 0));
  const X = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * 100 : 50);
  const Y = (r: number) => (1 - (r - range.lo) / (range.hi - range.lo)) * 100;
  const path = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(2)},${Y(p.r).toFixed(2)}`).join(' '));
  /** Three round ratings for the grid. */
  const ticks = $derived.by(() => {
    const span = range.hi - range.lo;
    const step = [10, 20, 25, 50, 100, 200, 250, 500].find((s) => span / s <= 4) ?? 1000;
    const out: number[] = [];
    for (let v = Math.ceil(range.lo / step) * step; v < range.hi; v += step) out.push(v);
    return out;
  });

  let at = $state<number | undefined>();
  function onmove(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    at = Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1))));
  }
  function onkey(e: KeyboardEvent) {
    const now = at ?? pts.length - 1;
    const to = e.key === 'ArrowLeft' ? now - 1 : e.key === 'ArrowRight' ? now + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? pts.length - 1 : undefined;
    if (to === undefined) return;
    e.preventDefault();
    at = Math.max(0, Math.min(pts.length - 1, to));
  }
  const tip = $derived.by(() => {
    if (at === undefined || !pts[at]) return undefined;
    const p = pts[at];
    if (!p.g) return { head: 'Start', text: `${p.r}` };
    const d = p.g.after - p.g.before;
    return { head: `${day(p.at)} · ${p.g.score === 1 ? 'Won' : p.g.score === 0 ? 'Lost' : 'Draw'} vs FIDE ${p.g.opponent}`, text: `${p.r} (${d >= 0 ? '+' : ''}${d})` };
  });
</script>

{#if pts.length > 1 && speed}
  <div class="chart">
    <div class="head">
      {#if speeds.length > 1}
        <div class="seg" role="group" aria-label="Speed">
          {#each speeds as s (s)}<button class:on={s === speed} aria-pressed={s === speed} onclick={() => (chosen = s)}>{SPEED_LABEL[s]}</button>{/each}
        </div>
      {:else}
        <span class="label">{SPEED_LABEL[speed]}</span>
      {/if}
      <!-- The game under the pointer, else the highest rating. -->
      {#if tip}
        <span class="label peak-text" aria-hidden="true">{tip.head} · <strong class="num">{tip.text}</strong></span>
      {:else}
        <span class="label peak-text">Highest <strong class="num">{pts[peak].r}</strong>{pts[peak].g ? ` · ${day(pts[peak].at)}` : ''}</span>
      {/if}
    </div>
    <div
      class="plot"
      role="slider"
      tabindex="0"
      aria-label="{SPEED_LABEL[speed]} CC Rating over {pts.length - 1} games. Arrow keys go through the games."
      aria-valuemin={Math.round(range.lo)}
      aria-valuemax={Math.round(range.hi)}
      aria-valuenow={pts[at ?? pts.length - 1].r}
      aria-valuetext={tip ? `${tip.head}: ${tip.text}` : `Now ${pts[pts.length - 1].r}`}
      onpointermove={onmove}
      onpointerleave={() => (at = undefined)}
      onkeydown={onkey}
      onblur={() => (at = undefined)}
    >
      {#each ticks as t (t)}
        <span class="grid" style="top: {Y(t)}%"></span>
        <span class="tick num" style="top: {Y(t)}%">{t}</span>
      {/each}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} class="line" vector-effect="non-scaling-stroke" />
        {#if at !== undefined}<line x1={X(at)} x2={X(at)} y1="0" y2="100" class="cross" vector-effect="non-scaling-stroke" />{/if}
      </svg>
      <span class="dot peak" style="left: {X(peak)}%; top: {Y(pts[peak].r)}%" title="Highest"></span>
      <span class="dot" style="left: {X(pts.length - 1)}%; top: {Y(pts[pts.length - 1].r)}%"></span>
      {#if at !== undefined}<span class="dot hover" style="left: {X(at)}%; top: {Y(pts[at].r)}%"></span>{/if}
    </div>
    <div class="ends label" aria-hidden="true"><span>{day(pts[0].at)}</span><span>{pts.length - 1} games</span><span>{day(pts[pts.length - 1].at)}</span></div>
  </div>
{/if}

<style>
  .chart {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .peak-text strong {
    color: var(--text);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--r-control);
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: none;
    color: var(--text-2);
    font: inherit;
    font-size: 14px;
    padding: 5px 12px;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--raised);
    color: var(--text);
    font-weight: 700;
  }
  .plot {
    position: relative;
    height: 150px;
    margin-left: 40px;
    touch-action: pan-y;
    cursor: crosshair;
    outline-offset: 4px;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .line {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .cross {
    stroke: var(--muted);
    stroke-width: 1;
  }
  .grid {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed var(--border);
  }
  .tick {
    position: absolute;
    left: -40px;
    width: 34px;
    text-align: right;
    transform: translateY(-50%);
    font-size: 12px;
    color: var(--muted);
  }
  .dot {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--series-1);
    border: 2px solid var(--card);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .dot.peak {
    width: 12px;
    height: 12px;
    background: var(--gold);
  }
  .dot.hover {
    background: var(--text);
  }
  .ends {
    display: flex;
    justify-content: space-between;
    margin-left: 40px;
    font-size: 12px;
  }
</style>

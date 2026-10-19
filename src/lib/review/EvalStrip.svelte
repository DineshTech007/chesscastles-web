<script lang="ts">
  /**
   * The game report in one slim row, for the move panel: a small graph of
   * White's winning chances with the key moments marked (click to go to a
   * move, hover to see it), and both players' accuracy, which opens the full
   * report.
   */
  import type { GameReview } from '$lib/coach/review';
  import { evalLabel } from '$lib/engine/stockfish';
  import MoveBadge from './MoveBadge.svelte';
  import { BADGES, type MoveClass } from './badges';
  import { curve } from './report';

  let {
    review,
    names,
    current,
    onselect,
    onreport,
  }: {
    review: GameReview;
    names: { white: string; black: string };
    /** The ply shown on the board (moves played). */
    current?: number;
    onselect?: (ply: number) => void;
    onreport?: () => void;
  } = $props();

  const MARKED: MoveClass[] = ['brilliant', 'only', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const pts = $derived(curve(review));
  const last = $derived(Math.max(1, pts[pts.length - 1]?.ply ?? 1));
  const X = (ply: number) => (ply / last) * 100;
  const Y = (w: number) => 4 + 92 * (1 - w);
  const line = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.ply).toFixed(2)},${Y(p.w).toFixed(2)}`).join(' '));
  const area = $derived(`${line} L100,100 L0,100 Z`);
  const marks = $derived(pts.filter((p) => p.move && MARKED.includes(p.move.cls)));

  let hover = $state<number | undefined>();
  function onmove(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hover = Math.max(0, Math.min(last, Math.round(((e.clientX - r.left) / r.width) * last)));
  }
  function onkey(e: KeyboardEvent) {
    const at = current ?? 0;
    const to = e.key === 'ArrowLeft' ? at - 1 : e.key === 'ArrowRight' ? at + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? last : undefined;
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onselect?.(Math.max(0, Math.min(last, to)));
  }
  const tip = $derived.by(() => {
    const m = hover === undefined ? undefined : pts.find((p) => p.ply === hover)?.move;
    if (!m) return undefined;
    return { san: `${Math.floor(m.ply / 2) + 1}${m.color === 'white' ? '.' : '...'}${m.san}`, cls: m.cls, eval: evalLabel(m.after), right: X(m.ply + 1) > 55 };
  });
</script>

<div class="strip">
  <div
    class="mini"
    role="slider"
    tabindex="0"
    aria-label="White's winning chances through the game. Arrow keys go through the moves."
    aria-valuemin={0}
    aria-valuemax={last}
    aria-valuenow={current ?? 0}
    onpointermove={onmove}
    onpointerleave={() => (hover = undefined)}
    onclick={() => hover !== undefined && onselect?.(hover)}
    onkeydown={onkey}
  >
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect width="100" height="100" class="dark" />
      <path d={area} class="white" />
      <line x1="0" x2="100" y1="50" y2="50" class="mid" vector-effect="non-scaling-stroke" />
      {#if current !== undefined}<line x1={X(current)} x2={X(current)} y1="0" y2="100" class="now" vector-effect="non-scaling-stroke" />{/if}
      {#if hover !== undefined}<line x1={X(hover)} x2={X(hover)} y1="0" y2="100" class="cross" vector-effect="non-scaling-stroke" />{/if}
    </svg>
    {#each marks as m (m.ply)}
      <span class="dot" style="left: {X(m.ply)}%; top: {Y(m.w)}%; background: {BADGES[m.move!.cls].color}"></span>
    {/each}
    {#if tip}
      <span class="tip" class:right={tip.right}><MoveBadge kind={tip.cls} size={14} title={false} /><strong>{tip.san}</strong> {tip.eval}</span>
    {/if}
  </div>
  <button class="acc" onclick={onreport} title="Open the full report: every badge, the turning point, and how each side played">
    <span class="who" title={names.white}><i class="disc white"></i><strong class="num">{review.sides.white.accuracy}</strong></span>
    <span class="who" title={names.black}><i class="disc black"></i><strong class="num">{review.sides.black.accuracy}</strong></span>
    <span class="more">Report ›</span>
  </button>
</div>

<style>
  .strip {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }
  .mini {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    height: 44px;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    touch-action: pan-y;
  }
  .mini:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .dark {
    fill: #2a3142;
  }
  .white {
    fill: #e9edf5;
  }
  .mid {
    stroke: #8c9bbe;
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0.7;
  }
  .now {
    stroke: var(--brand);
    stroke-width: 2;
  }
  .cross {
    stroke: var(--live);
    stroke-width: 1;
  }
  .dot {
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    border: 1px solid var(--card);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .tip {
    position: absolute;
    top: 3px;
    left: 4px;
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--raised);
    border: 1px solid var(--border);
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
  }
  .tip.right {
    left: auto;
    right: 4px;
  }
  .acc {
    flex: none;
    display: grid;
    grid-template-columns: auto auto;
    gap: 2px 10px;
    align-items: center;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--raised);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .acc:hover {
    border-color: var(--brand);
  }
  .who {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    font-size: 15px;
  }
  .disc {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--muted);
  }
  .disc.white {
    background: #eef3ff;
  }
  .disc.black {
    background: #0e1525;
  }
  .more {
    grid-column: 1 / -1;
    font-size: 12px;
    color: var(--brand);
    text-align: center;
  }
</style>

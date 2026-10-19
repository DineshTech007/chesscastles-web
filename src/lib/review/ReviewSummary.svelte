<script lang="ts">
  /**
   * The game report: White's winning chances along the game (a white area
   * above, a dark one below the even line) with every key moment marked by its
   * badge, the turning point called out; then both players side by side
   * (accuracy and each badge's count) and how each played by part of the game
   * and kind of position. Hover the graph for the move; click to go to it.
   */
  import type { GameReview } from '$lib/coach/review';
  import MoveBadge from './MoveBadge.svelte';
  import { evalLabel } from '$lib/engine/stockfish';
  import { BADGES, BADGE_ORDER, type MoveClass } from './badges';
  import { AREAS, areasOf, curve, markOf, turningPoints } from './report';

  let {
    review,
    names,
    current,
    onselect,
    compact = false,
    counts = true,
  }: {
    review: GameReview;
    names: { white: string; black: string };
    /** The ply shown on the board (moves played). */
    current?: number;
    onselect?: (ply: number) => void;
    /** In a narrow panel: the graph, the turning point and accuracy, the rest behind "Full report". */
    compact?: boolean;
    /** Accuracy and badge counts (off where the page shows its own). */
    counts?: boolean;
  } = $props();
  let full = $state(false);

  const W = 600;
  const H = 120;
  const PAD = 6;
  /** Moments marked on the graph. */
  const MARKED: MoveClass[] = ['brilliant', 'only', 'inaccuracy', 'mistake', 'miss', 'blunder'];

  const pts = $derived(curve(review));
  const last = $derived(Math.max(1, pts[pts.length - 1]?.ply ?? 1));
  const x = (ply: number) => PAD + ((W - 2 * PAD) * ply) / last;
  const y = (w: number) => PAD + (H - 2 * PAD) * (1 - w);
  /** The line, and the white area under it (White's share). */
  const line = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.ply).toFixed(1)},${y(p.w).toFixed(1)}`).join(' '));
  const area = $derived(`${line} L${x(last).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`);
  const marks = $derived(pts.filter((p) => p.move && MARKED.includes(p.move.cls)));
  const turning = $derived(turningPoints(review, 1)[0]);
  const moveNo = (ply: number) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}`;

  let hover = $state<number | undefined>();
  function onmove(e: PointerEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const ply = Math.round(((e.clientX - r.left) / r.width) * last);
    hover = Math.max(0, Math.min(last, ply));
  }
  /** Arrow keys step the board through the game, Home/End jump to its ends. */
  function onkey(e: KeyboardEvent) {
    const at = current ?? 0;
    const to = e.key === 'ArrowLeft' ? at - 1 : e.key === 'ArrowRight' ? at + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? last : undefined;
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onselect?.(Math.max(0, Math.min(last, to)));
  }
  const hp = $derived(hover === undefined ? undefined : pts.find((p) => p.ply === hover));
  const tip = $derived.by(() => {
    const m = hp?.move;
    if (!m) return undefined;
    return { text: `${moveNo(m.ply)}${m.san}`, cls: m.cls, eval: evalLabel(m.after), left: (x(hp!.ply) / W) * 100 };
  });

  const areas = $derived({ white: areasOf(review, 'white'), black: areasOf(review, 'black') });
  const count = (c: 'white' | 'black', k: MoveClass) => review.sides[c].classes[k] ?? 0;
  const shownBadges = $derived(BADGE_ORDER.filter((k) => count('white', k) || count('black', k) || k === 'blunder' || k === 'mistake' || k === 'best'));
</script>

<div class="report">
  <div class="graph-box">
    <svg
      viewBox="0 0 {W} {H}"
      class="graph"
      role="slider"
      tabindex="0"
      aria-label="White's winning chances through the game, with the key moments marked. Arrow keys go through the moves."
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={current ?? 0}
      onkeydown={onkey}
      onpointermove={onmove}
      onpointerleave={() => (hover = undefined)}
      onclick={() => hover !== undefined && onselect?.(hover)}
    >
      <rect x="0" y="0" width={W} height={H} rx="10" class="dark" />
      <path d={area} class="white" />
      <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} class="mid" />
      <path d={line} class="edge" />
      {#if current !== undefined}<line x1={x(current)} x2={x(current)} y1={PAD} y2={H - PAD} class="now" />{/if}
      {#if hover !== undefined}<line x1={x(hover)} x2={x(hover)} y1={PAD} y2={H - PAD} class="cross" />{/if}
      {#each marks as m (m.ply)}
        <circle cx={x(m.ply)} cy={y(m.w)} r={m.move === turning ? 6.5 : 5} fill={BADGES[m.move!.cls].color} class="dot" class:turn={m.move === turning} />
      {/each}
    </svg>
    {#if tip}
      <div class="tip" style="left: {tip.left}%">
        <MoveBadge kind={tip.cls} size={16} title={false} />
        <strong>{tip.text}</strong>
        <span>{BADGES[tip.cls].label} · {tip.eval}</span>
      </div>
    {/if}
  </div>
  <div class="legend">
    {#each MARKED as k (k)}<span><MoveBadge kind={k} size={14} title={false} />{BADGES[k].label}</span>{/each}
  </div>
  {#if turning}
    <button class="turning" onclick={() => onselect?.(turning.ply)}>
      <MoveBadge kind={turning.cls} size={18} title={false} />
      <span><strong>Turning point: {moveNo(turning.ply)}{turning.san}</strong> by {turning.color === 'white' ? names.white : names.black}, {Math.round(turning.drop * 100)}% of the winning chances gone in one move. See it</span>
    </button>
  {/if}

  {#if counts}
  <div class="table">
    <div class="row head">
      <span></span>
      <span class="who"><span class="disc white"></span>{names.white}</span>
      <span class="who"><span class="disc black"></span>{names.black}</span>
    </div>
    <div class="row acc">
      <span class="label">Accuracy</span>
      <strong class="num big" class:lead={review.sides.white.accuracy >= review.sides.black.accuracy}>{review.sides.white.accuracy}</strong>
      <strong class="num big" class:lead={review.sides.black.accuracy >= review.sides.white.accuracy}>{review.sides.black.accuracy}</strong>
    </div>
    {#if compact && !full}
      <button class="more" onclick={() => (full = true)}>Full report: every badge, and how each side played</button>
    {:else}
    {#each shownBadges as k (k)}
      <div class="row">
        <span class="badge-name"><MoveBadge kind={k} size={18} title={false} />{BADGES[k].label}</span>
        <span class="num count" style="color: {count('white', k) ? BADGES[k].color : 'var(--muted)'}">{count('white', k)}</span>
        <span class="num count" style="color: {count('black', k) ? BADGES[k].color : 'var(--muted)'}">{count('black', k)}</span>
      </div>
    {/each}
    {/if}
  </div>
  {/if}

  {#if !compact || full}
  <div class="table">
    <div class="row head">
      <span class="title">How each side played</span>
      {#if counts}<span></span><span></span>{:else}<span class="who"><span class="disc white"></span>{names.white}</span><span class="who"><span class="disc black"></span>{names.black}</span>{/if}
    </div>
    {#each AREAS as a (a.id)}
      {@const w = areas.white[a.id]}
      {@const b = areas.black[a.id]}
      {#if w || b}
        <div class="row" title={a.hint}>
          <span class="badge-name">{a.label}</span>
          <span class="area">{#if w}<MoveBadge kind={markOf(w.accuracy)} size={18} title={false} /><span class="num">{w.accuracy}</span>{:else}<span class="label">–</span>{/if}</span>
          <span class="area">{#if b}<MoveBadge kind={markOf(b.accuracy)} size={18} title={false} /><span class="num">{b.accuracy}</span>{:else}<span class="label">–</span>{/if}</span>
        </div>
      {/if}
    {/each}
    <p class="label note">Accuracy in each part of the game. Sharp moments: positions where one move was much better than the rest (tactics). Calm moves: positions with several fair moves (strategy).</p>
  </div>
  {/if}
</div>

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .graph-box {
    position: relative;
  }
  .graph {
    width: 100%;
    height: auto;
    display: block;
    cursor: pointer;
    touch-action: pan-y;
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
    stroke-dasharray: 4 4;
    opacity: 0.7;
  }
  .edge {
    fill: none;
    stroke: #8c9bbe;
    stroke-width: 2;
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
    stroke: var(--card);
    stroke-width: 2;
  }
  .dot.turn {
    stroke: #fff;
  }
  .tip {
    position: absolute;
    top: -6px;
    transform: translate(-50%, -100%);
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px 8px;
    border-radius: 8px;
    background: var(--raised);
    border: 1px solid var(--border);
    font-size: 13px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
  }
  .tip span {
    color: var(--muted);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 12px;
    color: var(--muted);
  }
  .legend span {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .turning {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    text-align: left;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .table {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 8px;
    border-top: 1px solid var(--border-soft);
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 4px 2px;
  }
  .row.head {
    padding-bottom: 6px;
  }
  .who {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-weight: 700;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    justify-content: center;
  }
  .disc {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid var(--muted);
    flex: none;
  }
  .disc.white {
    background: #eef3ff;
  }
  .disc.black {
    background: #0e1525;
  }
  .row > :nth-child(2),
  .row > :nth-child(3) {
    text-align: center;
    justify-self: center;
  }
  .big {
    font-size: 22px;
    padding: 2px 12px;
    border-radius: 8px;
    background: var(--raised);
  }
  .big.lead {
    background: #e9edf5;
    color: #0b1426;
  }
  .badge-name {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .count {
    font-weight: 700;
  }
  .area {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .more {
    border: 0;
    background: none;
    color: var(--brand);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    padding: 6px 2px;
  }
  .note {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.4;
  }
</style>

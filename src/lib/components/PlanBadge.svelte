<script lang="ts" module>
  let next = 0;
</script>

<script lang="ts">
  /**
   * A plan's badge, shown beside player names: a round, polished badge with
   * the plan's piece in white. Pawn bronze, Bishop emerald, Rook gold, Queen
   * royal purple.
   */
  import { PLAN_INFO, type Plan } from '$lib/plans';

  let { plan, size = 18, title }: { plan: Plan; size?: number; title?: string } = $props();
  const id = `pb${next++}`;

  const COLORS: Record<Plan, [light: string, mid: string, dark: string]> = {
    pawn: ['#f3c08f', '#c47a3d', '#7a3f14'],
    bishop: ['#7cf0c8', '#16a37a', '#065a43'],
    rook: ['#ffe596', '#f0b232', '#9a5d06'],
    queen: ['#f5b8ff', '#a855f7', '#4c1d95'],
  };
  const c = $derived(COLORS[plan]);
  const label = $derived(title ?? `${PLAN_INFO[plan].name} member`);
</script>

<svg class="badge" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
  <title>{label}</title>
  <defs>
    <linearGradient id="{id}g" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color={c[0]} />
      <stop offset="0.55" stop-color={c[1]} />
      <stop offset="1" stop-color={c[2]} />
    </linearGradient>
    <linearGradient id="{id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="11.5" fill={c[2]} />
  <circle cx="12" cy="12" r="10.6" fill="url(#{id}g)" />
  <ellipse cx="12" cy="7.2" rx="7.2" ry="4.4" fill="url(#{id}s)" />
  <g fill="#fff" stroke={c[2]} stroke-width="0.5" stroke-linejoin="round">
    {#if plan === 'pawn'}
      <circle cx="12" cy="7.9" r="2.6" />
      <path d="M9.4 11.2h5.2c-.1 1.7.3 3.1 1.3 4.6H8.1c1-1.5 1.4-2.9 1.3-4.6z" />
      <path d="M7 16.2h10v2.5H7z" />
    {:else if plan === 'bishop'}
      <circle cx="12" cy="5.2" r="1.2" />
      <path d="M12 6.7c2.4 1.7 3.6 3.5 3.6 5.3 0 1.5-.9 2.6-2 3.1h-3.2c-1.1-.5-2-1.6-2-3.1 0-1.8 1.2-3.6 3.6-5.3z" />
      <path d="M7.2 16h9.6v2.7H7.2z" />
      <path d="M13.1 9.3 11.2 11.6" fill="none" stroke={c[2]} stroke-width="1" stroke-linecap="round" />
    {:else if plan === 'rook'}
      <path d="M7.4 5h2.1v1.7h1.5V5h2v1.7h1.5V5h2.1v3.5l-1.5 1.2.6 5.5H8.3l.6-5.5-1.5-1.2z" />
      <path d="M6.8 16h10.4v2.7H6.8z" />
    {:else}
      <path d="M6.7 15.3 5.4 8.9l3.5 3L12 6.8l3.1 5.1 3.5-3-1.3 6.4z" />
      <circle cx="5.3" cy="8" r="1.15" />
      <circle cx="12" cy="5.7" r="1.25" />
      <circle cx="18.7" cy="8" r="1.15" />
      <path d="M6.6 16.1h10.8v2.6H6.6z" />
    {/if}
  </g>
</svg>

<style>
  .badge {
    display: inline-block;
    vertical-align: -0.2em;
    flex: none;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  }
</style>

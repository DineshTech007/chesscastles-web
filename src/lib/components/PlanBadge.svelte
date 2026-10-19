<script lang="ts" module>
  let next = 0;
</script>

<script lang="ts">
  /**
   * A plan's badge, shown beside player names: a round, polished badge.
   * Free a plain muted ring, Premium a gold star, Elite a royal-purple crown.
   */
  import { PLAN_INFO, PLANS_ON, type Plan } from '$lib/plans';

  let { plan, size = 18, title }: { plan: Plan; size?: number; title?: string } = $props();
  const id = `pb${next++}`;

  const COLORS: Record<Plan, [light: string, mid: string, dark: string]> = {
    free: ['#c9d2e3', '#8a97b3', '#525c74'],
    premium: ['#ffe596', '#f0b232', '#9a5d06'],
    elite: ['#f5b8ff', '#a855f7', '#4c1d95'],
  };
  const c = $derived(COLORS[plan]);
  const label = $derived(title ?? `${PLAN_INFO[plan].name} member`);
</script>

{#if PLANS_ON}
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
    {#if plan === 'free'}
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" stroke-width="1.6" />
    {:else if plan === 'premium'}
      <path d="M12 5.2 14 10l5 .5-3.8 3.4 1.1 4.9L12 16.3l-4.3 2.5 1.1-4.9L5 10.5l5-.5z" />
    {:else}
      <path d="M6.7 15.3 5.4 8.9l3.5 3L12 6.8l3.1 5.1 3.5-3-1.3 6.4z" />
      <circle cx="5.3" cy="8" r="1.15" />
      <circle cx="12" cy="5.7" r="1.25" />
      <circle cx="18.7" cy="8" r="1.15" />
      <path d="M6.6 16.1h10.8v2.6H6.6z" />
    {/if}
  </g>
</svg>
{/if}

<style>
  .badge {
    display: inline-block;
    vertical-align: -0.2em;
    flex: none;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  }
</style>

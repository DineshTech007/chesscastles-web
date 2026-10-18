<script lang="ts">
  /** A teacher's initials in a coloured circle (no photos of real people). */
  import { LEGENDS } from '$lib/coach/content/legends';
  import type { Group } from './content';

  let { id, group, size = 48 }: { id: string; group: Group; size?: number } = $props();
  const initials = $derived(
    (LEGENDS[id]?.name ?? id)
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
  const TONE: Record<Group, string> = { india: '#f2994a', today: '#38bdf8', women: '#e879a8', legends: '#edb040' };
</script>

<span class="badge" style="--size: {size}px; --tone: {TONE[group]}" aria-hidden="true">{initials}</span>

<style>
  .badge {
    width: var(--size);
    height: var(--size);
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: calc(var(--size) * 0.4);
    letter-spacing: 0.02em;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 16%, var(--card));
    border: 2px solid color-mix(in srgb, var(--tone) 60%, transparent);
  }
</style>

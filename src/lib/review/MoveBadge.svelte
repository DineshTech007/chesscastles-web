<script lang="ts">
  import { BADGES, badgeSvg, type MoveClass } from './badges';

  let { kind, size = 22, title = true }: { kind: MoveClass; size?: number; title?: boolean } = $props();
</script>

<svg class="badge" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={BADGES[kind].label}>
  {#if title}<title>{BADGES[kind].label}</title>{/if}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own constant SVG -->
  {@html badgeSvg(kind)}
</svg>

<style>
  .badge {
    display: inline-block;
    flex: none;
    vertical-align: middle;
  }
</style>

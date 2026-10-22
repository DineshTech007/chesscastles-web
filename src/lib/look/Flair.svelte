<script lang="ts">
  /** The award a player wears beside their name (their flair): its emoji, with its name on hover. */
  import { AWARDS } from '$lib/awards/awards';

  let { id, size = 18 }: { id: string; size?: number } = $props();
  const a = $derived(AWARDS.find((x) => x.id === id));
</script>

{#if a?.icon}<span class="flair" style="font-size: {size}px" title={a.name} aria-label={a.name}>{a.icon}</span>{/if}

<style>
  .flair {
    display: inline-block;
    line-height: 1;
    vertical-align: middle;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  }
</style>

<script lang="ts">
  /** A player's name in the style they wear from the Shop (cosmetics.css: .nfx-<id>); plain without one. */
  import type { Snippet } from 'svelte';
  import { ITEM } from './core';

  let { style = '', children }: { style?: string; children: Snippet } = $props();
  const on = $derived(!!style && ITEM[style]?.slot === 'name');
</script>

{#if on}<span class="nfx nfx-{style}">{@render children()}</span>{:else}{@render children()}{/if}

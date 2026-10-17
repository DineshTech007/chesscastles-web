<script lang="ts">
  /** Shows a page only when the plan's limit allows it (asked once when the page opens). */
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import LimitReached from './LimitReached.svelte';
  import { useFeature, type Feature } from '$lib/plans';

  let { feature, ref, back, backLabel, children }: { feature: Feature; ref?: string; back: string; backLabel: string; children: Snippet } = $props();
  let allowed = $state<boolean | undefined>();
  onMount(async () => (allowed = await useFeature(feature, ref)));
</script>

{#if allowed === false}
  <LimitReached {feature} {back} {backLabel} />
{:else if allowed}
  {@render children()}
{/if}

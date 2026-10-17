<script lang="ts">
  /** Adds a "repair" line from Guru's plan to the opening trainer, then opens it. */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { addRepairLine } from '$lib/insights/plan';

  let error = $state('');
  onMount(() => {
    const line = page.url.searchParams.get('line') ?? '';
    const color = page.url.searchParams.get('color') === 'black' ? 'black' : 'white';
    const id = addRepairLine(line, color, 'Repair line (from Guru)');
    if (id) goto(`/learn/openings/${id}`, { replaceState: true });
    else error = 'This line could not be added to the opening trainer.';
  });
</script>

<div class="card" style="max-width: 520px; margin: 40px auto; padding: 20px">
  {#if error}<p>{error}</p><a class="btn" href="/learn">Back to Learn</a>{:else}<p>Adding the line to your opening trainer…</p>{/if}
</div>

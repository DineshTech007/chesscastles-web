<script lang="ts">
  /** A game shared inside the link itself (/g#…), for players who were not signed in. */
  import SharedGameView from '$lib/components/SharedGameView.svelte';
  const hash = typeof location === 'undefined' ? '' : location.hash;
</script>

{#if hash.length > 1}
  <SharedGameView source={hash} />
{:else}
  <div class="card" style="max-width: 520px; margin: 40px auto"><p>This game link is not complete.</p><a class="btn primary" href="/">Go to Chess Castles</a></div>
{/if}

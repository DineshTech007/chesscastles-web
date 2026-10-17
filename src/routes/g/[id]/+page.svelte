<script lang="ts">
  /** A game shared by its short link. */
  import { page } from '$app/state';
  import SharedGameView from '$lib/components/SharedGameView.svelte';
</script>

{#key page.params.id}<SharedGameView source={page.params.id!} />{/key}

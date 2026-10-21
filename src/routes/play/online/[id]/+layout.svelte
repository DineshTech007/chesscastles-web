<script lang="ts">
  /**
   * A new online game opened from an online game's page (a rematch, a challenge accepted from the popup) is the same
   * page with another game id: the page is built afresh for it, so it never keeps showing the old game.
   */
  import { page } from '$app/state';
  let { children } = $props();
</script>

{#key page.params.id}{@render children()}{/key}

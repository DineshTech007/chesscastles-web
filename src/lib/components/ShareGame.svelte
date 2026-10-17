<script lang="ts">
  /** A "Share" button for a game: a link that opens the game on Chess Castles for anyone. */
  import { track } from '$lib/analytics';
  import Icon from './Icon.svelte';
  import { shareGame } from '$lib/share';
  import type { SavedGame } from '$lib/stores/myGames';

  let { game, label = 'Share', small = false }: { game: () => SavedGame | undefined; label?: string; small?: boolean } = $props();
  let note = $state('');
  let busy = $state(false);

  async function share() {
    track('feature', 'share_game');
    const g = game();
    if (!g) return;
    busy = true;
    const r = await shareGame(g);
    busy = false;
    note = r === 'copied' ? 'Link copied' : r === 'failed' ? "Couldn't share" : '';
    if (note) setTimeout(() => (note = ''), 2500);
  }
</script>

<button class="btn share" class:small disabled={busy} onclick={share} title="Share this game by link">
  <Icon name="send" size={small ? 15 : 18} />{note || (busy ? 'Sharing…' : label)}
</button>

<style>
  .share {
    gap: 6px;
  }
  .small {
    min-height: 34px;
    padding: 0 12px;
    font-size: 13.5px;
  }
</style>

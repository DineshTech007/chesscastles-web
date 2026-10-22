<script lang="ts">
  /**
   * My awards (owner, 2026-10-22: a menu item with every badge a child can win: welcome, games, CC Rating, puzzles,
   * study). The same cabinet as on the profile (src/lib/awards), with what the account kept from other devices.
   */
  import AwardsCabinet from '$lib/awards/AwardsCabinet.svelte';
  import { earnedNow } from '$lib/awards/awards';
  import { session } from '$lib/auth';
  import { myProfile } from '$lib/social';
  import { rewards } from '$lib/puzzles/rewards';
  import { puzzleRating } from '$lib/puzzles/rating';
  import { study } from '$lib/study/progress';
  import { kfide } from '$lib/stores/me';
  import { myGames } from '$lib/stores/myGames';
  import { loadTrophies } from '$lib/tournament/tournament';

  let kept = $state<string[]>([]);
  let keptBest = $state(0);
  $effect(() => {
    if ($session.status !== 'in') return;
    myProfile().then(
      (p) => {
        kept = p.progress?.awards ?? [];
        keptBest = p.progress?.rushBest ?? 0;
      },
      () => {},
    );
  });
  const won = $derived.by(() => {
    void [$rewards, $study, $puzzleRating, $kfide, $myGames];
    return new Set([...earnedNow(), ...kept]);
  });
  const trophies = loadTrophies();
</script>

<svelte:head><title>My awards · Chess Castles</title></svelte:head>

<div class="page">
  <h1 class="display">My awards</h1>
  <p class="muted">Every badge you can win on Chess Castles: games, CC Rating, puzzles, Puzzle Rush, lessons and tournaments. The glowing one in each group is the next to win.</p>
  <AwardsCabinet earned={won} mine rating={$puzzleRating} rushBest={Math.max($rewards.rushBest, keptBest)} stars={$rewards.stars} {trophies} />
  {#if $session.status === 'out'}<p class="muted small">Sign in to keep your awards on every device.</p>{/if}
</div>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h1 {
    margin: 8px 0 0;
    font-size: 32px;
  }
  .muted {
    color: var(--muted);
    margin: 0;
  }
  .small {
    font-size: 13px;
  }
</style>

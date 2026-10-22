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
  import { t } from '$lib/i18n';

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

<svelte:head><title>{$t('awards.page.title')}</title></svelte:head>

<div class="page">
  <h1 class="display">{$t('awards.title.mine')}</h1>
  <p class="muted">{$t('awards.page.lead')}</p>
  <AwardsCabinet earned={won} mine full rating={$puzzleRating} rushBest={Math.max($rewards.rushBest, keptBest)} stars={$rewards.stars} {trophies} />
  {#if $session.status === 'out'}<p class="muted small">{$t('awards.page.signin')}</p>{/if}
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

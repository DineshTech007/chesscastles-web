<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import LessonViewer from '$lib/coach/LessonViewer.svelte';
  import { analyseGame, reviewLesson, type GameReview } from '$lib/coach/review';
  import type { Lesson } from '$lib/coach/types';
  import GameReport from '$lib/review/GameReport.svelte';
  import { myGames, type SavedGame } from '$lib/stores/myGames';
  import { quota, useFeature } from '$lib/plans';
  import LimitReached from '$lib/components/LimitReached.svelte';

  let lesson = $state<Lesson | undefined>();
  let review = $state<GameReview | undefined>();
  let game = $state<SavedGame | undefined>();
  let tab = $state<'moves' | 'story'>('moves');
  let progress = $state(0);
  let failed = $state('');
  let limited = $state(false);
  let alive = true;

  onMount(async () => {
    myGames.load();
    const g = myGames.get(page.params.id!);
    if (!g) {
      failed = 'This game is not in My games on this device.';
      return;
    }
    if (g.uci.length < 4) {
      failed = 'This game is too short to review.';
      return;
    }
    if (!(await useFeature('review', g.id))) {
      limited = true;
      return;
    }
    try {
      const r = await analyseGame(g, (p) => (progress = p), quota('review_depth'));
      if (!alive) return;
      game = g;
      review = r;
      lesson = reviewLesson(g, r);
    } catch {
      failed = 'The engine could not analyse this game in this browser.';
    }
  });
  onDestroy(() => (alive = false));
</script>

<svelte:head><title>Game review · Coach · Chess Castles</title></svelte:head>

{#if limited}
  <LimitReached feature="review" back="/games" backLabel="Back to My games" />
{:else if lesson && review && game}
  <div class="tabs segmented" role="group" aria-label="Review view">
    <button aria-pressed={tab === 'moves'} onclick={() => (tab = 'moves')}>Every move</button>
    <button aria-pressed={tab === 'story'} onclick={() => (tab = 'story')}>Guru's story</button>
  </div>
  {#if tab === 'moves'}
    <GameReport {game} {review} />
  {:else}
    <LessonViewer {lesson} back="/coach" backLabel="Back to the Coach" />
  {/if}
{:else}
  <div class="wait card">
    <GuruAvatar size={84} talking={!failed} />
    {#if failed}
      <p>{failed}</p>
      <a class="btn" href="/coach">Back to the Coach</a>
    {:else}
      <p class="title">Guru is studying your game…</p>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)}>
        <span style="width: {progress * 100}%"></span>
      </div>
      <p class="label">Every move is checked with the engine. This takes about a minute.</p>
    {/if}
  </div>
{/if}

<style>
  .tabs {
    max-width: 360px;
    margin: 0 0 16px;
  }
  .wait {
    max-width: 520px;
    margin: 48px auto;
    padding: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .wait p {
    margin: 0;
  }
  .title {
    font-size: 20px;
  }
  .bar {
    width: 100%;
    height: 10px;
    border-radius: 5px;
    background: var(--border);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--brand);
    transition: width 0.3s;
  }
</style>

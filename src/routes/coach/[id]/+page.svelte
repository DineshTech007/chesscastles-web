<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import LessonViewer from '$lib/coach/LessonViewer.svelte';
  import { loadLesson } from '$lib/coach/catalog';
  import type { Lesson } from '$lib/coach/types';
  import { useFeature } from '$lib/plans';
  import LimitReached from '$lib/components/LimitReached.svelte';

  let lesson = $state<Lesson | undefined>();
  let failed = $state(false);
  let limited = $state(false);
  onMount(async () => {
    // A lesson with Guru counts towards the plan's Guru lessons (the same lesson again is free).
    if (!(await useFeature('guru', page.params.id))) return void (limited = true);
    try {
      lesson = await loadLesson(page.params.id!);
      if (!lesson) failed = true;
    } catch {
      failed = true;
    }
  });
</script>

<svelte:head><title>{lesson?.title ?? 'Lesson'} · Coach · Chess Castles</title></svelte:head>

{#if limited}
  <LimitReached feature="guru" back="/coach" backLabel="All lessons" />
{:else if lesson}
  <LessonViewer {lesson} />
{:else}
  <div class="wait card">
    <GuruAvatar size={72} />
    {#if failed}
      <p>This lesson could not be loaded.</p>
      <a class="btn" href="/coach">All lessons</a>
    {:else}
      <p>Guru is preparing the lesson…</p>
    {/if}
  </div>
{/if}

<style>
  .wait {
    max-width: 480px;
    margin: 48px auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
</style>

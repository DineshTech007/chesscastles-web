<script lang="ts">
  /** One endgame lesson from a master's game (counts as a Guru lesson for the plan's daily limit). */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import FeatureGate from '$lib/components/FeatureGate.svelte';
  import MastersLesson from '$lib/masters/MastersLesson.svelte';
  import { LEGENDS } from '$lib/coach/content/legends';
  import { shortName, TEACHERS } from '$lib/masters/content';
  import { lessonTitle, loadLessons, type MasterLesson } from '$lib/masters/data';

  const teacherId = $derived(page.params.teacher!);
  const gameId = $derived(Number(page.params.game));
  const teacher = $derived(TEACHERS.find((t) => t.id === teacherId));

  let lessons = $state<MasterLesson[] | undefined>();
  let failed = $state(false);

  onMount(async () => {
    try {
      lessons = await loadLessons(teacherId);
    } catch {
      failed = true;
    }
  });

  const at = $derived(lessons ? lessons.findIndex((l) => l.game === gameId) : -1);
  const lesson = $derived(lessons && at >= 0 ? lessons[at] : undefined);
  const nextHref = $derived(lessons && at >= 0 && at + 1 < lessons.length ? `/learn/masters/${teacherId}/${lessons[at + 1].game}` : undefined);
  const name = $derived(LEGENDS[teacherId]?.name ?? 'Master');
</script>

<svelte:head>
  <title>{lesson ? `${lessonTitle(lesson)} · ${name}` : name} · Endgames with the masters · Chess Castles</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
  <a class="back" href="/learn/masters/{teacherId}"><Icon name="back" size={16} />{shortName(name)}'s endgames</a>
  {#if !teacher || failed || (lessons && !lesson)}
    <div class="card note">
      {failed ? 'The lesson could not be loaded. Check your connection and try again.' : "That lesson isn't in the list."}
      <a href="/learn/masters">See all masters</a>
    </div>
  {:else if lesson}
    {#key gameId}
      <FeatureGate feature="guru" ref="master-{teacherId}-{gameId}" back="/learn/masters/{teacherId}" backLabel="{shortName(name)}'s endgames">
        <MastersLesson {lesson} {teacher} {nextHref} />
      </FeatureGate>
    {/key}
  {:else}
    <div class="card note">Loading the lesson…</div>
  {/if}
</div>

<style>
  .page {
    max-width: 1140px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 14px;
    width: fit-content;
  }
  .note {
    padding: 14px 16px;
  }
</style>

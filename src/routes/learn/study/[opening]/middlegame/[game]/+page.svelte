<script lang="ts">
  /** A middlegame lesson: continue a model game of the line right after the opening (counts as a Guru lesson). */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import FeatureGate from '$lib/components/FeatureGate.svelte';
  import MastersLesson from '$lib/masters/MastersLesson.svelte';
  import type { MasterLesson } from '$lib/masters/data';
  import { playerName } from '$lib/masters/content';
  import { curatedFor, planOf, PLANS, studyById } from '$lib/study/openingStudy';
  import { loadMiddlegame, type MiddlegameLesson } from '$lib/study/studyData';

  const opening = $derived(studyById(page.params.opening!));
  const gameId = $derived(Number(page.params.game));
  let lessons = $state<MiddlegameLesson[] | undefined>();
  let failed = $state(false);

  onMount(async () => {
    try {
      lessons = await loadMiddlegame(page.params.opening!);
    } catch {
      failed = true;
    }
  });

  const at = $derived(lessons ? lessons.findIndex((l) => l.game === gameId) : -1);
  const lesson = $derived(lessons && at >= 0 ? lessons[at] : undefined);
  const chapter = $derived(opening && lesson ? opening.lines.find((l) => l.id === lesson.chapter) : undefined);
  const nextHref = $derived.by(() => {
    if (!lessons || at < 0 || !opening) return undefined;
    const next = lessons.slice(at + 1).find((l) => l.chapter === lesson!.chapter) ?? lessons[at + 1];
    return next ? `/learn/study/${opening.id}/middlegame/${next.game}` : undefined;
  });
  /** Guru's intro: the line's written plans, else the opening's overview. */
  const tips = $derived.by(() => {
    if (!opening || !chapter) return [];
    const p = PLANS[opening.id];
    const written = curatedFor(opening, chapter).flatMap((c) => planOf(opening, c)?.plans ?? []);
    return written.length ? written.slice(0, 2) : [p.overview];
  });
  const player = $derived(lesson ? playerName(lesson.color === 'white' ? lesson.white : lesson.black) : '');
</script>

<svelte:head>
  <title>Middlegame · {opening?.name ?? 'Opening study'} · Chess Castles</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
  {#if opening}
    <a class="back" href="/learn/study/{opening.id}?tab=middlegame{lesson ? `&line=${lesson.chapter}` : ''}"><Icon name="back" size={16} />{opening.name}</a>
  {/if}
  {#if !opening || failed || (lessons && !lesson)}
    <div class="card note">
      {failed ? 'The lesson could not be loaded. Check your connection and try again.' : "That lesson isn't in the list."}
      <a href="/learn/study">Opening study</a>
    </div>
  {:else if lesson}
    {#key gameId}
      <FeatureGate feature="guru" ref="study-mg-{opening.id}-{gameId}" back="/learn/study/{opening.id}" backLabel={opening.name}>
        <MastersLesson
          lesson={lesson as unknown as MasterLesson}
          {player}
          {tips}
          title={chapter ? `${opening.name}: ${chapter.title ?? chapter.name}` : opening.name}
          starsId="study-{opening.id}"
          {nextHref}
        />
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

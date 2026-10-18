<script lang="ts">
  /** One master's endgame lessons, by type of endgame. */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import TeacherBadge from '$lib/masters/TeacherBadge.svelte';
  import { LEGENDS } from '$lib/coach/content/legends';
  import { tr, type Lang } from '$lib/coach/i18n';
  import { loadCoach } from '$lib/coach/progress';
  import { CATS, GOALS, shortName, TEACHERS, type Cat } from '$lib/masters/content';
  import { difficulty, eventLabel, lessonTitle, loadLessons, loadStars, type MasterLesson } from '$lib/masters/data';

  const id = page.params.teacher!;
  const teacher = TEACHERS.find((t) => t.id === id);
  const legend = LEGENDS[id];

  let lessons = $state<MasterLesson[] | undefined>();
  let failed = $state(false);
  let stars = $state<Record<string, number>>({});
  let lang = $state<Lang>('en');
  let cat = $state<Cat | 'all'>('all');

  onMount(async () => {
    lang = loadCoach().lang;
    stars = loadStars();
    if (!teacher) return;
    try {
      lessons = await loadLessons(id);
    } catch {
      failed = true;
    }
  });

  const cats = $derived(CATS.filter((c) => lessons?.some((l) => l.cat === c.id)));
  const shown = $derived((lessons ?? []).filter((l) => cat === 'all' || l.cat === cat));
  const done = $derived((lessons ?? []).filter((l) => stars[`${id}/${l.game}`]).length);

  const LEVEL = ['', 'Easy', 'Medium', 'Hard'];
</script>

<svelte:head>
  <title>{legend?.name ?? 'Player'} · Learn endgames from masters' games · Chess Castles</title>
</svelte:head>

<div class="page">
  <a class="back" href="/learn/masters"><Icon name="back" size={16} />All masters</a>
  {#if !teacher || !legend}
    <div class="card note">That teacher isn't in the list. <a href="/learn/masters">See all masters</a></div>
  {:else}
    <header class="card head">
      <TeacherBadge id={teacher.id} group={teacher.group} size={72} />
      <div class="who">
        <h1 class="display">{legend.name}</h1>
        <p class="bio">{tr(legend.bio, lang)}</p>
        {#if lessons}
          <span class="label">{lessons.length} endgame lessons from {shortName(legend.name)}'s games · {done} finished</span>
        {/if}
      </div>
    </header>

    {#if failed}
      <div class="card note">The lessons could not be loaded. Check your connection and try again.</div>
    {:else if !lessons}
      <div class="card note">Loading lessons…</div>
    {:else}
      <div class="chips" role="group" aria-label="Type of endgame">
        <button class="chip" aria-pressed={cat === 'all'} onclick={() => (cat = 'all')}>All ({lessons.length})</button>
        {#each cats as c (c.id)}
          <button class="chip" aria-pressed={cat === c.id} onclick={() => (cat = c.id)}>{c.name} ({lessons.filter((l) => l.cat === c.id).length})</button>
        {/each}
      </div>

      {#each CATS.filter((c) => cat === 'all' || c.id === cat) as c (c.id)}
        {@const list = shown.filter((l) => l.cat === c.id)}
        {#if list.length}
          <section aria-labelledby="c-{c.id}">
            <h2 id="c-{c.id}" class="title sec-h">{c.name}</h2>
            <p class="label tip">{tr(c.tip, lang)}</p>
            <div class="grid">
              {#each list as l (l.game)}
                {@const got = stars[`${id}/${l.game}`] ?? 0}
                {@const d = difficulty(l)}
                <a class="l-card" class:done={got > 0} href="/learn/masters/{id}/{l.game}">
                  <span class="l-top">
                    <span class="pill goal {l.goal}">{GOALS[l.goal].label}</span>
                    <span class="label lvl">{LEVEL[d]}</span>
                  </span>
                  <span class="title l-name">{lessonTitle(l)}</span>
                  <span class="label">{eventLabel(l)}</span>
                  <span class="stars" aria-label="{got} of 3 stars">
                    {#each [1, 2, 3] as s (s)}
                      <Icon name="star" size={15} color={s <= got ? 'var(--gold)' : 'var(--border)'} />
                    {/each}
                  </span>
                </a>
              {/each}
            </div>
          </section>
        {/if}
      {/each}
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 1140px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
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
  .head {
    display: flex;
    gap: 18px;
    align-items: center;
    padding: 18px 20px;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .who h1 {
    margin: 0;
    font-size: 38px;
  }
  .bio {
    margin: 0;
    line-height: 1.5;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .sec-h {
    margin: 6px 0 2px;
    font-size: 20px;
  }
  .tip {
    margin: 0 0 10px;
    max-width: 780px;
    line-height: 1.5;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
    gap: 10px;
  }
  .l-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    text-decoration: none;
  }
  .l-card:hover {
    outline: 1px solid var(--brand);
    text-decoration: none;
  }
  .l-card.done {
    border-color: color-mix(in srgb, var(--win) 50%, var(--border));
  }
  .l-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .l-name {
    font-size: 16px;
  }
  .l-card .label {
    font-size: 13px;
  }
  .goal {
    font-size: 12px;
  }
  .goal.win {
    color: var(--win);
  }
  .goal.squeeze {
    color: var(--live);
  }
  .goal.hold {
    color: var(--engine);
  }
  .stars {
    display: flex;
    gap: 2px;
  }
  @media (max-width: 560px) {
    .head {
      flex-direction: column;
      align-items: flex-start;
    }
    .who h1 {
      font-size: 32px;
    }
  }
</style>

<script lang="ts">
  /** "Endgames with the masters": choose a great player, then learn endgames from their real games. */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import TeacherBadge from '$lib/masters/TeacherBadge.svelte';
  import { LEGENDS } from '$lib/coach/content/legends';
  import { GROUPS, TEACHERS } from '$lib/masters/content';
  import { loadIndex, loadStars, type MastersIndex } from '$lib/masters/data';

  let index = $state<MastersIndex | undefined>();
  let failed = $state(false);
  let stars = $state<Record<string, number>>({});

  onMount(async () => {
    stars = loadStars();
    try {
      index = await loadIndex();
    } catch {
      failed = true;
    }
  });

  const doneOf = (teacher: string) => Object.keys(stars).filter((k) => k.startsWith(`${teacher}/`)).length;
  const available = $derived(TEACHERS.filter((t) => !index || index.teachers[t.id]?.count));
</script>

<svelte:head>
  <title>Learn endgames from masters' games · Chess Castles</title>
  <meta name="description" content="Study real endgames from the tournament games of great players: play one side, find the moves that were played, and see how endgames are won, outplayed and defended." />
</svelte:head>

<div class="page">
  <a class="back" href="/learn"><Icon name="back" size={16} />Learn</a>
  <header class="head">
    <h1 class="display">Learn endgames from masters' games</h1>
    <p class="intro">
      Pick your favourite master and study real endgames from their tournament games: you play their side, find the moves that were played, and Guru explains
      the idea behind each one. Every move was checked with the engine.
    </p>
  </header>

  {#if failed}
    <div class="card note">The lessons could not be loaded. Check your connection and try again.</div>
  {/if}

  {#each GROUPS as g (g.id)}
    {@const list = available.filter((t) => t.group === g.id)}
    {#if list.length}
      <section aria-labelledby="g-{g.id}">
        <h2 id="g-{g.id}" class="title section-h">{g.label}</h2>
        <div class="grid">
          {#each list as t (t.id)}
            {@const count = index?.teachers[t.id]?.count ?? 0}
            {@const done = doneOf(t.id)}
            <a class="t-card" href="/learn/masters/{t.id}">
              <TeacherBadge id={t.id} group={t.group} size={52} />
              <span class="t-text">
                <span class="title t-name">{LEGENDS[t.id]?.name ?? t.id}</span>
                <span class="label">{t.country}{count ? ` · ${count} lessons` : ''}</span>
                {#if count}
                  <span class="meter small"><span style="width: {(100 * done) / count}%"></span></span>
                {/if}
              </span>
              <Icon name="chevron" size={16} color="var(--muted)" />
            </a>
          {/each}
        </div>
      </section>
    {/if}
  {/each}

  <p class="label source">
    The games are public records of classical over-the-board tournament play (CaissaBase). Players are named only as the players of these games:
    Chess Castles is not affiliated with, sponsored or endorsed by any of them.
  </p>
</div>

<style>
  .page {
    max-width: 1140px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 14px;
    width: fit-content;
  }
  .head h1 {
    margin: 0;
    font-size: 44px;
  }
  .intro {
    margin: 6px 0 0;
    max-width: 760px;
    color: var(--muted);
    line-height: 1.5;
  }
  .note {
    padding: 14px 16px;
  }
  .section-h {
    font-size: 22px;
    margin: 0 0 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 12px;
  }
  .t-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    border-radius: var(--r-card);
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .t-card:hover {
    border-color: var(--brand);
    transform: translateY(-1px);
    text-decoration: none;
  }
  .t-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .t-name {
    font-size: 18px;
  }
  .meter.small {
    height: 5px;
  }
  .source {
    font-size: 12px;
  }
</style>

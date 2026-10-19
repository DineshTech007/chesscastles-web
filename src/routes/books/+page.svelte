<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { allProgress, loadLibrary, minutesOf, type BookMeta, type BookProgress } from '$lib/books/books';

  let books = $state<BookMeta[] | undefined>();
  let error = $state('');
  let progress = $state<Record<string, BookProgress>>({});
  type Shelf = 'all' | 'opening' | 'middlegame' | 'endgame' | 'general';
  let filter = $state<Shelf>('all');

  onMount(() => {
    progress = allProgress();
    loadLibrary().then(
      (b) => (books = b),
      () => (error = 'The library could not be loaded. Check your connection and try again.'),
    );
  });

  const SHELVES: [Shelf, string][] = [
    ['all', 'All books'],
    ['opening', 'Opening'],
    ['middlegame', 'Middlegame'],
    ['endgame', 'Endgame'],
    ['general', 'General & history'],
  ];
  const count = (k: Shelf) => (books ?? []).filter((b) => k === 'all' || b.topics?.includes(k)).length;
  const shown = $derived((books ?? []).filter((b) => filter === 'all' || b.topics?.includes(filter)));
  const reading = $derived(
    (books ?? [])
      .filter((b) => progress[b.slug]?.at)
      .sort((a, b) => progress[b.slug].at - progress[a.slug].at)
      .slice(0, 3),
  );
  const pct = (b: BookMeta) => Math.round(((progress[b.slug]?.read.length ?? 0) / b.chapters) * 100);
</script>

<svelte:head><title>Audio Books · Chess Castles</title></svelte:head>

{#snippet cover(b: BookMeta, small = false)}
  <div class="cover" class:small style:--c={b.colour} aria-hidden="true">
    <span class="c-year">{b.year}</span>
    <span class="c-title">{b.title}</span>
    <span class="c-author">{b.author.split(',')[0]}</span>
    <span class="c-piece">♞</span>
  </div>
{/snippet}

<h1 class="display h">Audio Books</h1>
<p class="lead">
  Classic chess books by champions and masters, free to read or listen to. Tap <strong>Listen</strong> on any book and
  Chess Castles reads it aloud to you, chess moves included. Every book here is in the public domain.
</p>

{#if reading.length}
  <h2 class="title sub">Continue</h2>
  <div class="continue">
    {#each reading as b (b.slug)}
      <a class="cont card" href="/books/{b.slug}">
        {@render cover(b, true)}
        <span class="cinfo">
          <strong>{b.title}</strong>
          <span class="label">Chapter {(progress[b.slug].chapter ?? 0) + 1} of {b.chapters} · {pct(b)}% read</span>
          <span class="bar"><span style:width="{pct(b)}%"></span></span>
        </span>
        <Icon name="chevron" color="var(--muted)" />
      </a>
    {/each}
  </div>
{/if}

<div class="tabs" role="tablist" aria-label="Show">
  {#each SHELVES as [k, label] (k)}
    <button role="tab" aria-selected={filter === k} class:on={filter === k} onclick={() => (filter = k)}>{label}{#if books}<span class="n">{count(k)}</span>{/if}</button>
  {/each}
</div>

{#if error}
  <p class="card err">{error}</p>
{:else if !books}
  <p class="label">Loading the library…</p>
{:else}
  <div class="grid">
    {#each shown as b (b.slug)}
      <article class="book card">
        <a href="/books/{b.slug}" class="cover-link" aria-label="Read {b.title}">{@render cover(b)}</a>
        <div class="info">
          <h3><a href="/books/{b.slug}">{b.title}</a></h3>
          <p class="label by">{b.author} · {b.year}</p>
          <p class="tags">
            <span class="tag">{b.level}</span>
            {#each b.topics ?? [] as t (t)}<span class="tag topic">{t === 'general' ? 'General' : t[0].toUpperCase() + t.slice(1)}</span>{/each}
            {#if b.diagrams}<span class="tag">♟ {b.diagrams} diagrams</span>{/if}
            <span class="tag">{b.chapters} chapters · {minutesOf(b.words) >= 60 ? `${Math.round(minutesOf(b.words) / 60)} h` : `${minutesOf(b.words)} min`} read</span>
            {#if b.audio}<span class="tag gold">🎧 Audiobook</span>{/if}
          </p>
          <p class="about">{b.about}</p>
          {#if pct(b)}<span class="bar"><span style:width="{pct(b)}%"></span></span>{/if}
          <div class="acts">
            <a class="btn primary" href="/books/{b.slug}"><Icon name="book" size={18} color="currentColor" />{progress[b.slug]?.at ? 'Continue' : 'Read'}</a>
            <a class="btn" href="/books/{b.slug}?listen=1"><Icon name="speaker" size={18} color="currentColor" />Listen</a>
          </div>
        </div>
      </article>
    {/each}
  </div>
{/if}

<p class="label foot">
  Old chess books write moves like <em>P-K4</em> or <em>Kt-KB3</em> instead of <em>e4</em> or <em>Nf3</em>.
  <a href="/books/notation">How to read old chess notation</a>. Texts from <a href="https://www.gutenberg.org" target="_blank" rel="noopener">Project Gutenberg</a> and <a href="https://en.wikisource.org" target="_blank" rel="noopener">Wikisource</a>.
</p>

<style>
  .h {
    font-size: 38px;
    margin: 8px 0 6px;
  }
  .lead {
    max-width: 70ch;
    color: var(--muted);
    margin: 0 0 18px;
  }
  .sub {
    margin: 0 0 10px;
  }
  .continue {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
    margin-bottom: 22px;
  }
  .cont {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    color: inherit;
    text-decoration: none;
  }
  .cinfo {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .tabs button {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    border-radius: 999px;
    padding: 7px 14px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--action);
    color: var(--on-action);
    border-color: transparent;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 14px;
  }
  .book {
    display: flex;
    gap: 14px;
    padding: 14px;
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 1.25;
  }
  h3 a {
    color: inherit;
    text-decoration: none;
  }
  .by,
  .tags,
  .about {
    margin: 0;
  }
  .about {
    font-size: 14px;
    line-height: 1.45;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .tag {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--raised);
    color: var(--muted);
  }
  .tag.topic {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--text);
  }
  .tabs .n {
    margin-left: 6px;
    font-size: 12px;
    opacity: 0.7;
  }
  .tag.gold {
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    color: var(--text);
  }
  .acts {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 4px;
  }
  .acts .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .bar {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--raised);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--win);
  }
  /* A made-up cover in the book's colour. */
  .cover {
    position: relative;
    width: 110px;
    height: 160px;
    flex: none;
    border-radius: 4px 8px 8px 4px;
    padding: 12px 10px 10px 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
    color: #fff;
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 85%, #fff), var(--c) 45%, color-mix(in srgb, var(--c) 70%, #000));
    box-shadow:
      inset 6px 0 0 rgba(0, 0, 0, 0.22),
      inset 7px 0 0 rgba(255, 255, 255, 0.18),
      0 4px 12px rgba(0, 0, 0, 0.25);
  }
  .cover.small {
    width: 52px;
    height: 74px;
    padding: 6px 5px 5px 9px;
  }
  .cover.small .c-title {
    font-size: 8px;
  }
  .cover.small .c-year,
  .cover.small .c-author {
    display: none;
  }
  .cover.small .c-piece {
    font-size: 26px;
  }
  .c-year {
    font-size: 10px;
    letter-spacing: 0.1em;
    opacity: 0.8;
  }
  .c-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    font-size: 13px;
    line-height: 1.15;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    overflow-wrap: anywhere;
    hyphens: auto;
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .c-author {
    font-size: 10px;
    opacity: 0.9;
    margin-top: auto;
    position: relative;
    z-index: 1;
  }
  .c-piece {
    position: absolute;
    right: -6px;
    bottom: -10px;
    font-size: 64px;
    opacity: 0.18;
    line-height: 1;
  }
  .err {
    color: var(--loss);
  }
  .foot {
    margin-top: 22px;
    max-width: 75ch;
  }
  @media (max-width: 420px) {
    .grid {
      grid-template-columns: 1fr;
    }
    .cover:not(.small) {
      width: 84px;
      height: 122px;
    }
  }
</style>

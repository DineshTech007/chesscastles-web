<script lang="ts">
  /** The frame of Chess Castles' policy pages: title, date, links between them, and readable text. */
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';

  let { title, updated, children }: { title: string; updated: string; children: Snippet } = $props();
  const DOCS = [
    ['/legal/terms', 'Terms of use'],
    ['/legal/privacy', 'Privacy'],
    ['/legal/fair-play', 'Fair play'],
    ['/legal/refunds', 'Refunds'],
    ['/contact', 'Contact'],
    ['/help', 'Help & support'],
  ];
</script>

<svelte:head><title>{title} · Chess Castles</title></svelte:head>

<div class="legal">
  <nav class="docs" aria-label="Policies">
    {#each DOCS as [href, label] (href)}
      <a {href} class:on={page.url.pathname === href}>{label}</a>
    {/each}
  </nav>
  <article class="card">
    <h1 class="display">{title}</h1>
    <p class="label">Last updated {updated}</p>
    {@render children()}
  </article>
</div>

<style>
  .legal {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .docs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .docs a {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
  }
  .docs a.on {
    background: var(--action);
    color: var(--on-action);
    border-color: transparent;
  }
  article {
    padding: clamp(18px, 4vw, 36px);
    line-height: 1.65;
  }
  h1 {
    margin: 0 0 2px;
    font-size: clamp(28px, 5vw, 38px);
  }
  article :global(h2) {
    font-size: 20px;
    margin: 1.6em 0 0.4em;
  }
  article :global(p),
  article :global(li) {
    max-width: 72ch;
  }
  article :global(ul) {
    padding-left: 1.2em;
  }
  article :global(li) {
    margin: 0.3em 0;
  }
  article :global(.box) {
    padding: 12px 14px;
    border-radius: 10px;
    border-left: 4px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 9%, transparent);
  }
</style>

<script lang="ts">
  /**
   * One person's kind words (the /wishes page, the home page's strip and the admin page's preview): who they are
   * above, their words below. Long words get a scroll bar inside the card; `compact` shows the first lines only,
   * with a link to the page.
   */
  import { t } from '$lib/i18n';
  import { toParagraphs, wishPhotoUrl, type Wish } from '$lib/wishes';

  let {
    wish,
    photo,
    compact = false,
  }: {
    wish: Pick<Wish, 'id' | 'name' | 'role' | 'text' | 'photo'>;
    /** A photo to show instead (the admin page's new one). */
    photo?: string;
    /** The first lines only, and "Show more" to the page (the home page). */
    compact?: boolean;
  } = $props();

  const paragraphs = $derived(toParagraphs(wish.text));
  const src = $derived(photo ?? wishPhotoUrl(wish));
  const initials = $derived(
    wish.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?',
  );
</script>

<article class="card wish" class:compact>
  <header class="who">
    {#if src}<img {src} alt={wish.name} width="64" height="64" loading="lazy" />{:else}<span class="initials" aria-hidden="true">{initials}</span>{/if}
    <span class="id">
      <strong>{wish.name || 'Name'}</strong>
      {#if wish.role}<span class="label">{wish.role}</span>{/if}
    </span>
    <span class="mark" aria-hidden="true">“</span>
  </header>
  <div class="words" tabindex={compact ? undefined : 0}>
    {#each paragraphs as p, i (i)}<p>{p}</p>{/each}
  </div>
  {#if compact}<a class="more" href="/wishes">{$t('wishes.more')} →</a>{/if}
</article>

<style>
  .wish {
    position: relative;
    padding: 18px 22px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-soft, var(--border));
  }
  img,
  .initials {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    flex: none;
    object-fit: cover;
    border: 2px solid var(--gold-soft, var(--border));
  }
  .initials {
    display: grid;
    place-items: center;
    background: var(--raised);
    color: var(--text-2);
    font-weight: 800;
    font-size: 20px;
  }
  .id {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .id strong {
    font-size: 16px;
  }
  .mark {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 56px;
    line-height: 0.6;
    align-self: flex-start;
    color: var(--gold);
    opacity: 0.35;
  }
  /* Long words scroll inside the card, so a page of many people stays easy to walk through. */
  .words {
    max-width: 68ch;
    max-height: 320px;
    overflow-y: auto;
    padding-right: 6px;
    scrollbar-width: thin;
    scrollbar-color: var(--gold) transparent;
  }
  .words:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 6px;
  }
  .words p {
    margin: 0 0 12px;
    font-size: 16px;
    line-height: 1.65;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .words p:last-child {
    margin-bottom: 0;
  }
  /* The home page: the first lines only. */
  .compact .words {
    max-height: none;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    padding-right: 0;
  }
  .compact .words p {
    display: inline;
    font-size: 15px;
  }
  .compact .words p::after {
    content: ' ';
  }
  .compact img,
  .compact .initials {
    width: 48px;
    height: 48px;
  }
  .more {
    align-self: flex-start;
    font-weight: 700;
    color: var(--accent);
    text-decoration: none;
  }
  .more:hover {
    text-decoration: underline;
  }
  @media (max-width: 480px) {
    .wish {
      padding: 16px 16px 14px;
    }
    .words {
      max-height: 260px;
    }
  }
</style>

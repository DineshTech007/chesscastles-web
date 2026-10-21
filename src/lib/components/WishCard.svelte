<script lang="ts">
  /**
   * One person's kind words (the /wishes page, the home page's strip and the admin page's preview): who they are
   * above, their words below. Words written in another language show their English translation first, with a
   * switch to the original. Long words get a scroll bar inside the card; `compact` shows the first lines only,
   * with a link to the page.
   */
  import { t } from '$lib/i18n';
  import { toParagraphs, WISH_LANG_NAME, wishPhotoUrl, type Wish } from '$lib/wishes';

  let {
    wish,
    photo,
    compact = false,
  }: {
    wish: Pick<Wish, 'id' | 'name' | 'role' | 'text' | 'lang' | 'en' | 'photo' | 'thumb'>;
    /** A photo to show instead (the admin page's new one). */
    photo?: string;
    /** The first lines only, and "Show more" to the page (the home page). */
    compact?: boolean;
  } = $props();

  /** English is the default wherever a translation exists; the reader can switch to the original. */
  const translated = $derived(!!wish.en?.trim() && wish.lang !== 'en');
  let original = $state(false);
  const shown = $derived(translated && !original ? wish.en : wish.text);
  const paragraphs = $derived(toParagraphs(shown));
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
    {#if translated}
      <button type="button" class="lang" onclick={() => (original = !original)} aria-pressed={original}>
        {original ? $t('wishes.inEnglish') : $t('wishes.inOriginal', { lang: WISH_LANG_NAME[wish.lang] ?? 'original' })}
      </button>
    {/if}
  </header>
  <div class="words" tabindex={compact ? undefined : 0} lang={translated && !original ? 'en' : wish.lang === 'other' ? undefined : wish.lang}>
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
  .lang {
    flex: none;
    align-self: flex-start;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--gold);
    background: transparent;
    color: var(--gold);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .lang:hover {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
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
    .who {
      flex-wrap: wrap;
    }
    .lang {
      font-size: 12px;
    }
    .words {
      max-height: 260px;
    }
  }
</style>

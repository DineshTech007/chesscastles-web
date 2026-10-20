<script lang="ts">
  /** One person's kind words (the /wishes page, and the admin page's preview): their words in paragraphs, then who they are. */
  import { toParagraphs, wishPhotoUrl, type Wish } from '$lib/wishes';

  let { wish, photo }: { wish: Pick<Wish, 'id' | 'name' | 'role' | 'text' | 'photo'>; /** A photo to show instead (the admin page's new one). */ photo?: string } = $props();

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

<article class="card wish">
  <span class="mark" aria-hidden="true">“</span>
  <div class="words">
    {#each paragraphs as p, i (i)}<p>{p}</p>{/each}
  </div>
  <footer class="who">
    {#if src}<img {src} alt={wish.name} width="64" height="64" loading="lazy" />{:else}<span class="initials" aria-hidden="true">{initials}</span>{/if}
    <span class="id">
      <strong>{wish.name || 'Name'}</strong>
      {#if wish.role}<span class="label">{wish.role}</span>{/if}
    </span>
  </footer>
</article>

<style>
  .wish {
    position: relative;
    padding: 32px 22px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .mark {
    position: absolute;
    top: 2px;
    left: 14px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 64px;
    line-height: 1;
    color: var(--gold);
    opacity: 0.35;
  }
  .words {
    position: relative;
    max-width: 68ch;
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
  .who {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-soft, var(--border));
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
  }
  .id strong {
    font-size: 16px;
  }
</style>

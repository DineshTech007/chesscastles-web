<script lang="ts">
  /** One blog post, in the chosen language, with share buttons and the next story. */
  import { page } from '$app/state';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import PostCover from '$lib/components/PostCover.svelte';
  import PostFigure from '$lib/components/PostFigure.svelte';
  import Reactions from '$lib/components/Reactions.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { contentLang } from '$lib/contentLang';
  import { POSTS, postBySlug, TAG_NAME, type Post } from '$lib/blog/posts';
  import { track } from '$lib/analytics';
  import { blogStats, countView, loadBlogStats, ZERO } from '$lib/blog/stats';

  const UI = {
    en: { back: 'All blogs', read: 'min read', views: 'views', share: 'Share this story', wa: 'Share on WhatsApp', copy: 'Copy link', copied: 'Copied ✓', next: 'Read next', missing: 'This story was not found.', cta: 'Try Chess Castles free' },
    hi: { back: 'सारी कहानियाँ', read: 'minute पढ़ना', views: 'बार पढ़ी गई', share: 'यह कहानी share कीजिए', wa: 'WhatsApp पर share करें', copy: 'Link copy करें', copied: 'Copy हो गया ✓', next: 'अगली कहानी', missing: 'यह कहानी नहीं मिली।', cta: 'Chess Castles free में आज़माइए' },
    mr: { back: 'सगळ्या गोष्टी', read: 'minute वाचन', views: 'वेळा वाचली', share: 'ही गोष्ट share करा', wa: 'WhatsApp वर share करा', copy: 'Link copy करा', copied: 'Copy झालं ✓', next: 'पुढची गोष्ट', missing: 'ही गोष्ट सापडली नाही.', cta: 'Chess Castles free मध्ये वापरून बघा' },
  } as const;
  const t = $derived(UI[$contentLang]);
  const post = $derived<Post | undefined>(postBySlug(page.params.slug ?? ''));
  const next = $derived(post ? POSTS[(POSTS.indexOf(post) + 1) % POSTS.length] : undefined);
  const url = $derived(post ? `https://www.chesscastles.com/blog/${post.slug}` : '');
  const shareText = $derived(post ? `${post.title[$contentLang]} ${url}` : '');
  $effect(() => {
    if (!post) return;
    void loadBlogStats();
    countView(post.slug);
  });
  const views = $derived(post ? ($blogStats[post.slug] ?? ZERO).views : 0);
  const dateOf = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  let copied = $state(false);
  async function copy() {
    await navigator.clipboard?.writeText(url).catch(() => {});
    copied = true;
    track('feature', 'blog_copy');
    setTimeout(() => (copied = false), 2000);
  }

  /** Paragraphs, "## " headings and "- " lists (consecutive list lines become one list). */
  type Block = { k: 'p' | 'h'; text: string } | { k: 'ul'; items: string[] } | { k: 'fig'; fig: 'board' | 'rice' | 'week'; fen?: string; caption?: string } | { k: 'img'; src: string; caption: string };
  /** A line's text with links: "[text](/path)" becomes a link to this site (nowhere else). */
  type Seg = { t: string; href?: string };
  const segs = (text: string): Seg[] => {
    const out: Seg[] = [];
    const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
    let i = 0;
    for (const m of text.matchAll(re)) {
      if (m.index! > i) out.push({ t: text.slice(i, m.index) });
      out.push({ t: m[1], href: m[2] });
      i = m.index! + m[0].length;
    }
    if (i < text.length) out.push({ t: text.slice(i) });
    return out;
  };
  const blocks = $derived.by<Block[]>(() => {
    const out: Block[] = [];
    for (const line of post?.body[$contentLang] ?? []) {
      const board = /^\[board:([^|\]]+)\|?([^\]]*)\]$/.exec(line);
      if (board) out.push({ k: 'fig', fig: 'board', fen: board[1].trim(), caption: board[2].trim() });
      else if (line === '[rice]') out.push({ k: 'fig', fig: 'rice' });
      else if (line === '[week]') out.push({ k: 'fig', fig: 'week' });
      else if (/^\[img:/.test(line)) {
        // A picture from this site: "[img:/journey/rating-curve.svg|caption]".
        const m = /^\[img:([^|\]]+)\|?([^\]]*)\]$/.exec(line);
        if (m) out.push({ k: 'img', src: m[1].trim(), caption: m[2].trim() });
      }
      else if (line.startsWith('## ')) out.push({ k: 'h', text: line.slice(3) });
      else if (line.startsWith('- ')) {
        const last = out[out.length - 1];
        if (last?.k === 'ul') last.items.push(line.slice(2));
        else out.push({ k: 'ul', items: [line.slice(2)] });
      } else out.push({ k: 'p', text: line });
    }
    return out;
  });
</script>

<svelte:head>
  <title>{post ? `${post.title[$contentLang]} · Blogs & Forum` : 'Blogs & Forum'} · Chess Castles</title>
  {#if post}<meta name="description" content={post.summary[$contentLang]} />{/if}
</svelte:head>

<div class="page" lang={$contentLang}>
  <div class="top">
    <a class="back" href="/blog"><Icon name="back" size={16} />{t.back}</a>
    <LangSwitch />
  </div>

  {#if !post}
    <p class="card pad">{t.missing}</p>
  {:else}
    <article>
      <PostCover piece={post.piece} hue={post.hue} size="hero" />
      <span class="tag">{TAG_NAME[post.tag][$contentLang]}</span>
      <h1 class="display">{post.title[$contentLang]}</h1>
      <p class="label meta">{dateOf(post.date)} · {post.read} {t.read} · {views} {t.views}</p>
      {#each blocks as b, i (i)}
        {#if b.k === 'h'}<h2 class="title">{b.text}</h2>
        {:else if b.k === 'fig'}<PostFigure kind={b.fig} fen={b.fen} caption={b.caption} lang={$contentLang} />
        {:else if b.k === 'img'}<figure class="pic"><img src={b.src} alt={b.caption} loading="lazy" />{#if b.caption}<figcaption class="label">{b.caption}</figcaption>{/if}</figure>
        {:else if b.k === 'ul'}<ul>{#each b.items as it, j (j)}<li>{#each segs(it) as sg, x (x)}{#if sg.href}<a href={sg.href}>{sg.t}</a>{:else}{sg.t}{/if}{/each}</li>{/each}</ul>
        {:else}<p>{#each segs(b.text) as sg, x (x)}{#if sg.href}<a href={sg.href}>{sg.t}</a>{:else}{sg.t}{/if}{/each}</p>{/if}
      {/each}
    </article>

    <Reactions slug={post.slug} lang={$contentLang} />

    <section class="card share" aria-label={t.share}>
      <strong>{t.share}</strong>
      <div class="btns">
        <a class="btn primary" href="https://wa.me/?text={encodeURIComponent(shareText)}" target="_blank" rel="noopener" onclick={() => track('feature', 'blog_whatsapp')}><Icon name="send" size={16} />{t.wa}</a>
        <button class="btn" onclick={copy}><Icon name="copy" size={16} />{copied ? t.copied : t.copy}</button>
        <a class="btn ghost" href="/">{t.cta}</a>
      </div>
    </section>

    {#if next}
      <a class="card next" href="/blog/{next.slug}">
        <PostCover piece={next.piece} hue={next.hue} />
        <div><span class="label">{t.next}</span><strong>{next.title[$contentLang]}</strong></div>
      </a>
    {/if}
  {/if}
</div>

<style>
  .pic {
    margin: 18px 0;
  }
  .pic img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 12px;
    border: 1px solid var(--border);
  }
  .pic figcaption {
    margin-top: 6px;
    text-align: center;
  }
  .page {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
    text-decoration: none;
    font-weight: 700;
  }
  article {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h1 {
    margin: 4px 0 0;
    font-size: 36px;
    line-height: 1.2;
  }
  h2 {
    margin: 10px 0 0;
    font-size: 22px;
  }
  p,
  li {
    margin: 0;
    font-size: 17.5px;
    line-height: 1.75;
  }
  ul {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .meta {
    margin: 0;
  }
  .tag {
    align-self: flex-start;
    margin-top: 8px;
    padding: 2px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 20%, transparent);
    color: var(--gold);
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .share {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .next {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 14px;
    align-items: center;
    padding: 0;
    overflow: hidden;
    color: var(--text);
    text-decoration: none;
  }
  .next :global(.cover) {
    height: 100%;
    min-height: 90px;
  }
  .next div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 14px 10px 0;
  }
  .pad {
    padding: 18px;
  }
  @media (max-width: 560px) {
    h1 {
      font-size: 28px;
    }
  }
</style>

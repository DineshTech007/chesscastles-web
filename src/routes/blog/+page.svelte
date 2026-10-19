<script lang="ts">
  /** Blog: stories and tips about chess in English, Hindi and Marathi (English by default). */
  import { goto } from '$app/navigation';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import PostCover from '$lib/components/PostCover.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { contentLang } from '$lib/contentLang';
  import { POSTS, TAG_NAME, type Tag } from '$lib/blog/posts';
  import { blogStats, loadBlogStats, ZERO } from '$lib/blog/stats';
  import { track } from '$lib/analytics';

  const UI = {
    en: { title: 'Blogs & Forum', sub: 'Stories, kids’ improvement tips and chess history, for players and parents.', surprise: 'Surprise me', all: 'All', read: 'min read', sortBy: 'Sort by', latest: 'Latest', views: 'Most viewed', popular: 'Most popular', loved: 'Most loved', views1: 'views', likes: 'likes', dislikes: 'dislikes', hearts: 'loves', new: 'More stories are added regularly.' },
    hi: { title: 'Blogs और Forum', sub: 'Players और parents के लिए कहानियाँ, बच्चों के सुधार के tips और chess का इतिहास।', surprise: 'कुछ नया पढ़ाओ', all: 'सब', read: 'minute पढ़ना', sortBy: 'क्रम', latest: 'सबसे नए', views: 'सबसे ज़्यादा पढ़े गए', popular: 'सबसे लोकप्रिय', loved: 'सबसे ज़्यादा पसंद', views1: 'बार पढ़ी गई', likes: 'पसंद', dislikes: 'नापसंद', hearts: 'दिल', new: 'नई कहानियाँ नियमित रूप से जुड़ती रहती हैं।' },
    mr: { title: 'Blogs आणि Forum', sub: 'Players आणि पालकांसाठी गोष्टी, मुलांच्या प्रगतीचे tips आणि chess चा इतिहास.', surprise: 'काहीतरी नवं वाचवा', all: 'सगळे', read: 'minute वाचन', sortBy: 'क्रम', latest: 'सर्वात नवीन', views: 'सर्वाधिक वाचलेल्या', popular: 'सर्वाधिक लोकप्रिय', loved: 'सर्वाधिक आवडत्या', views1: 'वेळा वाचली', likes: 'आवडली', dislikes: 'आवडली नाही', hearts: 'हृदय', new: 'नव्या गोष्टी नियमितपणे जोडल्या जातात.' },
  } as const;
  const t = $derived(UI[$contentLang]);
  let tag = $state<Tag | 'all'>('all');
  const tags = [...new Set(POSTS.map((p) => p.tag))];
  /** How the list is ordered: newest first, or by what readers did (counted for everyone, src/lib/blog/stats.ts). */
  type Sort = 'latest' | 'views' | 'popular' | 'loved';
  let sort = $state<Sort>('latest');
  const score: Record<Sort, (slug: string) => number> = {
    latest: () => 0,
    views: (s) => c(s).views,
    popular: (s) => c(s).likes + c(s).hearts - c(s).dislikes,
    loved: (s) => c(s).hearts,
  };
  const posts = $derived(
    POSTS.filter((p) => tag === 'all' || p.tag === tag).sort((a, b) => score[sort](b.slug) - score[sort](a.slug) || b.date.localeCompare(a.date)),
  );
  const first = $derived(posts[0]);
  const rest = $derived(posts.slice(1));
  const dateOf = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  $effect(() => void loadBlogStats());
  const c = (slug: string) => $blogStats[slug] ?? ZERO;
  function surprise() {
    track('feature', 'blog_surprise');
    const p = POSTS[Math.floor(Math.random() * POSTS.length)];
    void goto(`/blog/${p.slug}`);
  }
</script>

<svelte:head><title>Blogs & Forum · Chess Castles</title></svelte:head>

{#snippet counts(slug: string)}
  <span class="counts" aria-label="{c(slug).views} {t.views1}, {c(slug).likes} {t.likes}, {c(slug).dislikes} {t.dislikes}, {c(slug).hearts} {t.hearts}">
    <span title={t.views1}><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0" /></svg>{c(slug).views}</span>
    <span title={t.likes}><svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8c1.6 0 2.6 1.1 2.3 2.7L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7" /></svg>{c(slug).likes}</span>
    <span title={t.dislikes}><svg viewBox="0 0 24 24" style="transform: rotate(180deg)"><path d="M7 11v9H4v-9zM7 11l4-8c1.6 0 2.6 1.1 2.3 2.7L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7" /></svg>{c(slug).dislikes}</span>
    <span class="hrt" title={t.hearts}><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>{c(slug).hearts}</span>
  </span>
{/snippet}

<div class="page" lang={$contentLang}>
  <header class="head">
    <div>
      <h1 class="display">{t.title} <span class="new">NEW</span></h1>
      <p class="label">{t.sub}</p>
    </div>
    <div class="tools">
      <LangSwitch />
      <button class="btn" onclick={surprise}><Icon name="sparkle" size={16} />{t.surprise}</button>
    </div>
  </header>

  <div class="chips" role="group" aria-label="Topic">
    <button class="chip" aria-pressed={tag === 'all'} onclick={() => (tag = 'all')}>{t.all}</button>
    {#each tags as k (k)}<button class="chip" aria-pressed={tag === k} onclick={() => (tag = k)}>{TAG_NAME[k][$contentLang]}</button>{/each}
  </div>

  <div class="sortbar" role="group" aria-label={t.sortBy}>
    <span class="label">{t.sortBy}:</span>
    {#each ['latest', 'views', 'popular', 'loved'] as k (k)}
      <button class="chip" aria-pressed={sort === k} onclick={() => (sort = k as Sort)}>{t[k as 'latest' | 'views' | 'popular' | 'loved']}</button>
    {/each}
  </div>

  {#if first}
    <a class="card hero" href="/blog/{first.slug}">
      <PostCover piece={first.piece} hue={first.hue} size="hero" />
      <div class="hero-text">
        <span class="tag">{TAG_NAME[first.tag][$contentLang]}</span>
        <h2 class="display">{first.title[$contentLang]}</h2>
        <p>{first.summary[$contentLang]}</p>
        <span class="label">{dateOf(first.date)} · {first.read} {t.read}</span>
        {@render counts(first.slug)}
      </div>
    </a>
  {/if}

  <div class="grid">
    {#each rest as p (p.slug)}
      <a class="card post" href="/blog/{p.slug}">
        <PostCover piece={p.piece} hue={p.hue} />
        <div class="pt">
          <span class="tag">{TAG_NAME[p.tag][$contentLang]}</span>
          <h3 class="title">{p.title[$contentLang]}</h3>
          <p class="label">{p.summary[$contentLang]}</p>
          <span class="label meta">{dateOf(p.date)} · {p.read} {t.read}</span>
          {@render counts(p.slug)}
        </div>
      </a>
    {/each}
  </div>
  <p class="label foot">{t.new}</p>
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 40px;
  }
  .head p {
    margin: 4px 0 0;
  }
  .new {
    vertical-align: middle;
    margin-left: 8px;
    padding: 3px 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f7d27a, #edb040 55%, #c98a1b);
    color: #0b1426;
    font-size: 13px;
    letter-spacing: 0.1em;
    font-family: var(--font-body, inherit);
  }
  .tools,
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  a.card {
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    color: var(--text);
    text-decoration: none;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  a.card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    text-decoration: none;
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }
  .hero :global(.cover) {
    height: 100%;
    min-height: 220px;
    border-radius: 0;
  }
  .hero-text {
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: center;
  }
  .hero-text h2 {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
  }
  .hero-text p {
    margin: 0;
    color: var(--text-2);
    line-height: 1.55;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }
  .pt {
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pt h3 {
    margin: 0;
    font-size: 18px;
    line-height: 1.3;
  }
  .pt p {
    margin: 0;
  }
  .meta {
    margin-top: auto;
    font-size: 12.5px;
  }
  .tag {
    align-self: flex-start;
    padding: 2px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 20%, transparent);
    color: var(--gold);
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .sortbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .sortbar .label {
    margin: 0;
  }
  .counts {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
    margin-top: 2px;
  }
  .counts span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .counts svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .counts .hrt {
    color: #ef4d6a;
  }
  .foot {
    margin: 0;
    text-align: center;
  }
  @media (max-width: 700px) {
    .hero {
      grid-template-columns: 1fr;
    }
    .hero :global(.cover) {
      min-height: 150px;
    }
    h1 {
      font-size: 32px;
    }
  }
</style>

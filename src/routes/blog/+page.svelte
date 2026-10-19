<script lang="ts">
  /** Blog: stories and tips about chess in English, Hindi and Marathi (English by default). */
  import { goto } from '$app/navigation';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import PostCover from '$lib/components/PostCover.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { contentLang } from '$lib/contentLang';
  import { POSTS, TAG_NAME, type Tag } from '$lib/blog/posts';
  import { formatDate } from '$lib/format';
  import { track } from '$lib/analytics';

  const UI = {
    en: { title: 'Castle Chronicles', sub: 'Stories, kids’ improvement tips and chess history, for players and parents.', surprise: 'Surprise me', all: 'All', read: 'min read', new: 'More stories are added regularly.' },
    hi: { title: 'Castle Chronicles', sub: 'Players और parents के लिए कहानियाँ, बच्चों के सुधार के tips और chess का इतिहास।', surprise: 'कुछ नया पढ़ाओ', all: 'सब', read: 'minute पढ़ना', new: 'नई कहानियाँ नियमित रूप से जुड़ती रहती हैं।' },
    mr: { title: 'Castle Chronicles', sub: 'Players आणि पालकांसाठी गोष्टी, मुलांच्या प्रगतीचे tips आणि chess चा इतिहास.', surprise: 'काहीतरी नवं वाचवा', all: 'सगळे', read: 'minute वाचन', new: 'नव्या गोष्टी नियमितपणे जोडल्या जातात.' },
  } as const;
  const t = $derived(UI[$contentLang]);
  let tag = $state<Tag | 'all'>('all');
  const tags = [...new Set(POSTS.map((p) => p.tag))];
  const posts = $derived(POSTS.filter((p) => tag === 'all' || p.tag === tag).sort((a, b) => b.date.localeCompare(a.date)));
  const first = $derived(posts[0]);
  const rest = $derived(posts.slice(1));
  const dateOf = (iso: string) => formatDate(new Date(`${iso}T12:00:00`).getTime());
  function surprise() {
    track('feature', 'blog_surprise');
    const p = POSTS[Math.floor(Math.random() * POSTS.length)];
    void goto(`/blog/${p.slug}`);
  }
</script>

<svelte:head><title>Castle Chronicles · Chess Castles</title></svelte:head>

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

  {#if first}
    <a class="card hero" href="/blog/{first.slug}">
      <PostCover piece={first.piece} hue={first.hue} size="hero" />
      <div class="hero-text">
        <span class="tag">{TAG_NAME[first.tag][$contentLang]}</span>
        <h2 class="display">{first.title[$contentLang]}</h2>
        <p>{first.summary[$contentLang]}</p>
        <span class="label">{dateOf(first.date)} · {first.read} {t.read}</span>
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

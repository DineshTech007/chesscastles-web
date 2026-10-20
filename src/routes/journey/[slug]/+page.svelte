<script lang="ts">
  /** One post of Aarav's journey (see /journey). */
  import { page } from '$app/state';
  import journey from '$lib/journey/journey.json';
  import Aarav from '$lib/journey/Aarav.svelte';
  import Icon from '$lib/components/Icon.svelte';

  const post = $derived(journey.posts.find((p) => p.slug === page.params.slug));
  const i = $derived(journey.posts.findIndex((p) => p.slug === page.params.slug));
  const prev = $derived(i > 0 ? journey.posts[i - 1] : undefined);
  const next = $derived(i >= 0 && i < journey.posts.length - 1 ? journey.posts[i + 1] : undefined);
</script>

<svelte:head><title>{post ? post.title : 'Post'} · Aarav's journey · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/journey"><Icon name="back" size={16} />Aarav's journey</a>
  {#if post}
    <article class="card">
      <header>
        <Aarav size={64} />
        <div>
          <p class="label">{post.date} · sessions {post.sessions.join(', ')} · {post.games} games · {post.record}</p>
          <h1 class="display">{post.title}</h1>
        </div>
      </header>
      {#each post.body as para, k (k)}<p>{para}</p>{/each}
      <p class="label fine">Aarav is Chess Castles' practice account; the games, ratings, openings, lessons and mistakes above are its real record. The whole road: <a href="/journey/story">the case study</a>; the same road for you: <a href="/learn/roadmap">the roadmap</a>.</p>
    </article>
    <nav class="pn">
      {#if prev}<a class="btn" href="/journey/{prev.slug}"><Icon name="back" size={16} />{prev.milestone}</a>{:else}<span></span>{/if}
      {#if next}<a class="btn" href="/journey/{next.slug}">{next.milestone}<Icon name="chevron" size={16} /></a>{/if}
    </nav>
  {:else}
    <p class="card pad">That post isn't here. <a href="/journey">All posts</a></p>
  {/if}
</div>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  article {
    padding: 22px 24px;
  }
  header {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 12px;
  }
  header p {
    margin: 0;
  }
  h1 {
    margin: 4px 0 0;
    font-size: 28px;
  }
  article > p {
    margin: 0 0 12px;
    line-height: 1.6;
    font-size: 16.5px;
  }
  .fine {
    margin-top: 16px;
    font-size: 13.5px;
  }
  .pn {
    display: flex;
    justify-content: space-between;
  }
  .pad {
    padding: 16px;
  }
</style>

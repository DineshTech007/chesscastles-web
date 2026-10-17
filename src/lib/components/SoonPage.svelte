<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  let {
    title,
    intro,
    icon,
    coming,
    now = [],
  }: {
    title: string;
    intro: string;
    icon: IconName;
    /** What this section will hold on the website. */
    coming: string[];
    /** What the visitor can already do here, with links. */
    now?: { label: string; href: string }[];
  } = $props();
</script>

<svelte:head><title>{title} · Chess Castles</title></svelte:head>

<div class="page">
  <div class="hero panel">
    <span class="badge"><Icon name={icon} size={30} color="var(--accent)" /></span>
    <div>
      <h1 class="display">{title}</h1>
      <p class="intro">{intro}</p>
    </div>
  </div>
  <div class="cols">
    <section class="card">
      <h2 class="title">Coming to the website</h2>
      <ul>
        {#each coming as c (c)}<li><Icon name="check" size={18} color="var(--muted)" />{c}</li>{/each}
      </ul>
      <p class="label">These are in the Chess Castles Android app today.</p>
    </section>
    {#if now.length}
      <section class="card">
        <h2 class="title">On the website now</h2>
        <div class="links">
          {#each now as n (n.href)}
            <a class="btn" href={n.href}>{n.label}<Icon name="chevron" size={16} /></a>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .page {
    max-width: 960px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .hero {
    display: flex;
    gap: 18px;
    align-items: center;
  }
  .badge {
    width: 64px;
    height: 64px;
    flex: none;
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: var(--raised);
  }
  h1 {
    font-size: 42px;
  }
  .intro {
    margin: 6px 0 0;
    color: var(--text-2);
  }
  .cols {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }
  .cols .card {
    flex: 1 1 300px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card .title {
    font-size: 19px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    display: flex;
    gap: 10px;
    align-items: center;
    color: var(--text-2);
  }
  .label {
    margin: 0;
  }
  .links {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .links .btn {
    justify-content: space-between;
  }
</style>

<script lang="ts">
  /**
   * Aarav's journey: the record of a practice account going up the ratings on
   * Chess Castles (src/lib/journey/journey.json, built by
   * scripts/e2e/tester-journey.mjs after every session): real games, real
   * numbers, real study, written as the record it is.
   */
  import journey from '$lib/journey/journey.json';
  import Aarav from '$lib/journey/Aarav.svelte';
  import Icon from '$lib/components/Icon.svelte';

  const { hero, curve, posts, target, reached } = journey;
  const W = 640;
  const H = 180;
  const ratings = curve.map((c) => c.rating);
  const lo = Math.min(1450, ...ratings) - 20;
  const hi = Math.max(target, ...ratings) + 20;
  const x = (i: number) => 28 + (i * (W - 40)) / Math.max(1, curve.length - 1);
  const y = (r: number) => H - 24 - ((r - lo) * (H - 44)) / (hi - lo);
  const path = curve.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(c.rating).toFixed(1)}`).join(' ');
  const ticks = [1500, 1750, 2000, 2250, 2500].filter((t) => t >= lo && t <= hi);
  const latest = [...posts].reverse();
</script>

<svelte:head>
  <title>Aarav's journey · Chess Castles</title>
  <meta name="description" content="A beginner's road up the ratings, told from real games on Chess Castles: what he studied, the moves that lost, and what worked." />
</svelte:head>

<div class="page">
  <header class="card hero">
    <Aarav size={150} />
    <div class="h-text">
      <p class="eyebrow label">Aarav's journey</p>
      <h1 class="display">From 1500 to {reached ? target : `${target}, one session at a time`}</h1>
      <p class="lead">
        {hero.name} is Chess Castles' practice account: it follows the <a href="/learn/roadmap">roadmap</a> session after session, and these posts are its record. Every game, rating change, opening, lesson, puzzle and mistake here was played and studied on Chess Castles; its playing strength was turned up one notch after each session of study. The whole road, with the study plan to copy, is in <a href="/journey/story">the case study</a>.
      </p>
      <p class="stats">
        <span><strong class="num">{hero.now}</strong> <span class="label">CC Rating now</span></span>
        <span><strong class="num">{hero.sessions}</strong> <span class="label">sessions</span></span>
        <span><strong class="num">{hero.games}</strong> <span class="label">rapid games</span></span>
        <span class="label">{hero.record}</span>
      </p>
    </div>
  </header>

  <section class="card chart" aria-label="Rating by session">
    <h2 class="title">CC Rating, session by session</h2>
    <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Rating curve from {curve[0]?.rating ?? 1500} to {hero.now}">
      {#each ticks as t (t)}
        <line x1="28" x2={W - 12} y1={y(t)} y2={y(t)} stroke="var(--border)" stroke-dasharray="3 4" />
        <text x="4" y={y(t) + 4} font-size="11" fill="var(--muted)">{t}</text>
      {/each}
      <line x1="28" x2={W - 12} y1={y(target)} y2={y(target)} stroke="var(--accent)" stroke-dasharray="5 4" />
      <path d={path} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" />
      {#each curve as c, i (c.session)}
        <circle cx={x(i)} cy={y(c.rating)} r="3.5" fill="var(--accent)"><title>Session {c.session} · {c.date}: {c.rating}</title></circle>
      {/each}
    </svg>
    <p class="label">Updated {journey.updated}. The dashed gold line is the target, {target}.</p>
  </section>

  <section class="posts" aria-label="Posts">
    {#if !posts.length}
      <p class="card label pad">The first post comes at 1600.</p>
    {/if}
    {#each latest as p (p.slug)}
      <a class="card post" href="/journey/{p.slug}">
        <span class="m num">{p.milestone}</span>
        <span class="p-text">
          <span class="title">{p.title}</span>
          <span class="label">{p.date} · {p.games} games · {p.record}</span>
          <span class="excerpt">{p.body[0]}</span>
        </span>
        <Icon name="chevron" size={16} color="var(--muted)" />
      </a>
    {/each}
  </section>
</div>

<style>
  .page {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .hero {
    display: flex;
    gap: 22px;
    align-items: center;
    padding: 22px;
    flex-wrap: wrap;
  }
  .h-text {
    flex: 1 1 320px;
    min-width: 0;
  }
  .eyebrow {
    margin: 0;
    color: var(--accent);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 12px;
  }
  h1 {
    margin: 4px 0 8px;
    font-size: 32px;
  }
  .lead {
    margin: 0 0 10px;
    line-height: 1.5;
  }
  .stats {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    align-items: baseline;
  }
  .stats strong {
    font-size: 22px;
  }
  .chart {
    padding: 16px 18px;
  }
  .chart h2 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  .chart p {
    margin: 6px 0 0;
  }
  .posts {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .post {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 14px 16px;
    color: var(--text);
    text-decoration: none;
  }
  .m {
    flex: none;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #0b1426;
    font-weight: 900;
    font-size: 17px;
  }
  .p-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .excerpt {
    color: var(--text-2);
    font-size: 14px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pad {
    padding: 16px;
  }
</style>

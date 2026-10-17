<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import RatingChart from '$lib/components/RatingChart.svelte';
  import { displayName, fideHistory, fideSearch, type FidePlayer, type RatingPoint } from '$lib/api';
  import { myFideId, myPhoto, photoSrc } from '$lib/stores/me';

  const id = page.params.id!;
  let player = $state<FidePlayer | undefined>();
  let history = $state<RatingPoint[] | undefined>();
  let error = $state('');

  onMount(async () => {
    // The history is extra: a player without one (new or unrated) still gets their page.
    const hist = fideHistory(id).catch(() => [] as RatingPoint[]);
    try {
      const found = await fideSearch(id);
      player = found.find((p) => p.fideId === id) ?? found[0];
      if (!player) error = `FIDE has no player with ID ${id}.`;
    } catch {
      error = "FIDE couldn't be reached right now. Try again in a moment.";
    }
    history = await hist;
  });

  const change = $derived.by(() => {
    if (!history || history.length < 2) return undefined;
    const last = history[history.length - 1];
    const year = history.find((p) => p.month >= `${Number(last.month.slice(0, 4)) - 1}${last.month.slice(4)}`);
    if (!last.standard || !year?.standard) return undefined;
    return last.standard - year.standard;
  });
  const peak = $derived(history?.reduce((m, p) => Math.max(m, p.standard ?? 0), 0) ?? 0);
</script>

<svelte:head><title>{player ? displayName(player.name) : 'Player'} · Ratings · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/ratings"><Icon name="back" size={16} />Ratings</a>
  {#if error}
    <div class="card">{error}</div>
  {:else if !player || !history}
    <div class="card skel"></div>
  {:else}
    <header class="hero card">
      <!-- Your own photo on your own FIDE page; initials for everyone else (no photos from FIDE). -->
      {#if $myPhoto && $myFideId === player.fideId}
        <img class="avatar photo" src={photoSrc($myPhoto)} alt="" />
      {:else}
        <span class="avatar display">{displayName(player.name).split(' ').map((s) => s[0]).slice(0, 2).join('')}</span>
      {/if}
      <div class="who">
        <h1 class="display name">{#if player.title}<span class="title-tag">{player.title}</span>{/if}{displayName(player.name)}</h1>
        <p class="label">{[player.federation, player.birthYear ? `born ${player.birthYear}` : '', `FIDE ID ${player.fideId}`].filter(Boolean).join(' · ')}</p>
      </div>
      <a class="btn ghost" href="https://ratings.fide.com/profile/{player.fideId}" target="_blank" rel="noopener">FIDE profile <Icon name="external" size={16} /></a>
    </header>

    <div class="tiles">
      <div class="card tile"><span class="label">Standard</span><strong class="display num">{player.standard ?? '—'}</strong>
        {#if change !== undefined}<span class="delta" class:up={change > 0} class:down={change < 0}>{change > 0 ? '+' : ''}{change} in 12 months</span>{/if}</div>
      <div class="card tile"><span class="label">Rapid</span><strong class="display num">{player.rapid ?? '—'}</strong></div>
      <div class="card tile"><span class="label">Blitz</span><strong class="display num">{player.blitz ?? '—'}</strong></div>
      <div class="card tile"><span class="label">Peak standard</span><strong class="display num">{peak || '—'}</strong></div>
    </div>

    <section class="card">
      <h2 class="title">Rating history</h2>
      {#if history.length > 1}
        <RatingChart points={history} />
      {:else}
        <p class="label">FIDE isn't sharing this player's rating history with Chess Castles right now (FIDE limits it for players without a standard rating). <a href="https://ratings.fide.com/profile/{player.fideId}/chart" target="_blank" rel="noopener">See the graph on FIDE's site</a>.</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 980px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
    align-self: flex-start;
  }
  .skel {
    height: 360px;
  }
  .hero {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #5a3a1c;
    color: #eef3ff;
    font-size: 26px;
    flex: none;
  }
  .avatar.photo {
    width: 88px;
    height: 110px;
    border-radius: 12px;
    object-fit: cover;
    background: var(--raised);
  }
  .who {
    flex: 1;
    min-width: 220px;
  }
  .name {
    font-size: 36px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .title-tag {
    font-family: var(--font-title);
    font-size: 15px;
    font-weight: 700;
    color: #0a1226;
    background: var(--gold);
    border-radius: 6px;
    padding: 2px 7px;
    letter-spacing: 0;
  }
  .who .label {
    margin: 4px 0 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 12px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tile strong {
    font-size: 40px;
  }
  .delta {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }
  .delta.up {
    color: var(--win);
  }
  .delta.down {
    color: var(--loss);
  }
  section .title {
    font-size: 19px;
    margin-bottom: 8px;
  }
</style>

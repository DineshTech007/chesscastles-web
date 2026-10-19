<script lang="ts">
  /** One Chess Castles player in a list: photo (friends only) or initials, name, country, status and ratings. */
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { fedName } from '$lib/fideFeds';
  import { initialsOf, playerPhoto, type Player } from '$lib/social';

  let { p, note = '', lichess = '' }: { p: Player; note?: string; /** Their Lichess ratings, e.g. "Blitz 1850 · Rapid 1902". */ lichess?: string } = $props();
  const photo = $derived(playerPhoto(p));
</script>

<a class="pc" href="/players/{encodeURIComponent(p.uid)}">
  <span class="av">
    {#if photo}<img src={photo} alt="" />{:else}{initialsOf(p.name)}{/if}
    {#if p.online}<span class="dot" title="Online now"></span>{/if}
    {#if p.playing}<span class="live" title="Playing now">LIVE</span>{/if}
  </span>
  <span class="text">
    <span class="name"><span><TitleBadge title={p.title} size={12} />{p.name}</span>{#if p.plan && p.member !== false}<PlanBadge plan={p.plan} />{/if}{#if p.country}<img class="flag" src="/flags/{p.country}.svg" alt={fedName(p.country)} title={fedName(p.country)} width="18" height="12" />{/if}</span>
    {#if p.status}<span class="label status">“{p.status}”</span>{/if}
    <span class="label">{[p.kfide && p.kfideGames ? `CC Rating ${p.kfide}` : 'CC Rating: not rated yet', p.fideRating ? `FIDE ${p.fideRating}` : ''].filter(Boolean).join(' · ')}</span>
    {#if lichess}<span class="label lich">Lichess {lichess}</span>{/if}
    {#if note}<span class="label">{note}</span>{/if}
  </span>
</a>

<style>
  .live {
    position: absolute;
    left: 50%;
    bottom: -6px;
    transform: translateX(-50%);
    padding: 0 4px;
    border-radius: 4px;
    background: var(--loss);
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  .pc {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    text-decoration: none;
    min-width: 0;
  }
  .pc:hover {
    outline: 1px solid var(--brand);
    text-decoration: none;
  }
  .av {
    position: relative;
    width: 46px;
    height: 46px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #5a3a1c;
    color: #eef3ff;
    font-weight: 700;
  }
  .av img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  .dot {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--win);
    border: 2px solid var(--card);
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .flag {
    border-radius: 2px;
  }
  .status {
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

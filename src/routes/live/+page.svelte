<script lang="ts">
  /**
   * Live on Chess Castles: every game being played on the site right now (against FIDE-level opponents, the
   * computer, or another player online), newest first, refreshed every 15 seconds. Watch opens the game live.
   * Signed-in visitors only, as watching a game is.
   */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { playingNow, type PlayingGame } from '$lib/social';
  import { photoSrc } from '$lib/stores/me';
  import { t } from '$lib/i18n';

  let games = $state<PlayingGame[]>([]);
  let loaded = $state(false);
  let error = $state('');

  async function load() {
    if ($session.status !== 'in') return;
    try {
      games = (await playingNow()).games;
      error = '';
    } catch (e) {
      error = (e as Error).message;
    }
    loaded = true;
  }
  onMount(() => {
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  });
  $effect(() => {
    if ($session.status === 'in') void load();
  });

  const playing = $derived(games.filter((g) => !g.over));
  const ended = $derived(games.filter((g) => g.over));
  const tc = (g: PlayingGame) => (g.minutes || g.increment ? `${g.minutes}+${g.increment}` : 'No clock');
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const watchHref = (g: PlayingGame) => (g.lichess ? `/watch/live/${g.lichess}` : `/watch/friend/${encodeURIComponent(g.uid)}`);
</script>

<svelte:head><title>Live on Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/watch"><Icon name="back" size={16} />Watch</a>
  <h1 class="display h"><span class="dot"></span>{$t('nav.live')}</h1>
  <p class="label lead">Games being played on Chess Castles right now: against FIDE-level opponents, the computer, or another player. Tap Watch to follow one live.</p>

  {#if $session.status === 'out'}
    <div class="card empty">
      <p>Sign in to see and watch the games being played on Chess Castles.</p>
      <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
    </div>
  {:else if !loaded}
    <p class="label">Looking for games…</p>
  {:else if error}
    <div class="card empty"><p>{error}</p><button class="btn" onclick={load}>Try again</button></div>
  {:else if !games.length}
    <div class="card empty">
      <p><strong>No games right now.</strong> Start one and it appears here.</p>
      <a class="btn primary" href="/play">Play</a>
    </div>
  {:else}
    <p class="count"><strong class="num">{playing.length}</strong> {playing.length === 1 ? 'game' : 'games'} being played</p>
    <ul class="list">
      {#each [...playing, ...ended] as g (g.uid)}
        <li class="card game" class:over={g.over}>
          <span class="av">{#if g.photo}<img src={photoSrc(g.photo)} alt="" />{:else}{initials(g.name)}{/if}</span>
          <span class="who">
            <span class="names">
              {#if g.title}<span class="ttl">{g.title}</span>{/if}<strong>{g.name}</strong>
              {#if g.country}<img class="flag" src="/flags/{g.country}.svg" alt={g.country} width="18" height="12" />{/if}
              {#if g.rating}<span class="rt num">{g.rating}</span>{/if}
              <span class="vs">vs</span>
              <strong>{g.opponent || 'Opponent'}</strong>{#if g.opponentRating}<span class="rt num">{g.opponentRating}</span>{/if}
            </span>
            <span class="label meta">
              <span class="side {g.color}"></span>{g.color === 'white' ? 'White' : 'Black'} · {tc(g)} · {g.moves ? `move ${Math.ceil(g.moves / 2)}` : 'starting'}
              {#if g.over}· <span class="ended">finished {g.result ?? ''}</span>{/if}
            </span>
          </span>
          <a class="btn {g.over ? '' : 'primary'} watch" href={watchHref(g)}>{#if !g.over}<span class="pulse"></span>{/if}{g.over ? 'See' : 'Watch'}</a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page {
    max-width: 760px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
    font-weight: 700;
    font-size: 14px;
  }
  .h {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 10px 0 6px;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #e5534b;
    box-shadow: 0 0 0 0 rgba(229, 83, 75, 0.6);
    animation: live 1.6s infinite;
  }
  @keyframes live {
    70% {
      box-shadow: 0 0 0 10px rgba(229, 83, 75, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(229, 83, 75, 0);
    }
  }
  .lead {
    margin: 0 0 18px;
    max-width: 60ch;
  }
  .count {
    margin: 0 0 10px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .game {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
  }
  .game.over {
    opacity: 0.7;
  }
  .av {
    flex: none;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--raised);
    border: 1px solid var(--border);
    font-weight: 800;
    color: var(--accent);
  }
  .av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .names {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }
  .ttl {
    font-size: 11px;
    font-weight: 800;
    color: #0b1426;
    background: var(--gold);
    border-radius: 4px;
    padding: 0 4px;
  }
  .flag {
    border-radius: 2px;
  }
  .rt {
    font-size: 13px;
    color: var(--text-2);
  }
  .vs {
    color: var(--muted);
    font-size: 13px;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .side {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid var(--border);
  }
  .side.white {
    background: #f4f1ea;
  }
  .side.black {
    background: #1a1a1a;
  }
  .ended {
    color: var(--text-2);
  }
  .watch {
    flex: none;
    gap: 6px;
  }
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e5534b;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 18px;
  }
  .empty p {
    margin: 0;
  }
</style>

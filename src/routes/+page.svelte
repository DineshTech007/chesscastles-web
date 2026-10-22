<script lang="ts">
  /**
   * Home (redesigned 2026-10-21 with the owner: "a playing portal, not a test lab"; phones first). In the order a
   * player reaches for things: a game in one tap, today's puzzle and lesson, their ratings, friends online, the top
   * game on Chess Castles now, their last games, Guru's look at their games, then the rest of the site as icons.
   * Everything else is one tap away on More. Visitors see the landing (Landing.svelte).
   */
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import SocialLinks from '$lib/components/SocialLinks.svelte';
  import MadeInIndia from '$lib/components/MadeInIndia.svelte';
  import MyInsightsCard from '$lib/components/MyInsightsCard.svelte';
  import LiveOnCC from '$lib/components/LiveOnCC.svelte';
  import OnlineNow from '$lib/components/OnlineNow.svelte';
  import CoachWork from '$lib/components/CoachWork.svelte';
  import FriendRequests from '$lib/components/FriendRequests.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Landing from '$lib/components/home/Landing.svelte';
  import PlayCard from '$lib/components/home/PlayCard.svelte';
  import PuzzleLobby from '$lib/components/home/PuzzleLobby.svelte';
  import TodayRow from '$lib/components/home/TodayRow.svelte';
  import RatingTiles from '$lib/components/home/RatingTiles.svelte';
  import ExploreIcons from '$lib/components/home/ExploreIcons.svelte';
  import { t } from '$lib/i18n';
  import { session } from '$lib/auth';
  import { myCountry, myName, myTitle, shownGames } from '$lib/stores/me';
  import { KIND_LABEL, opponentOf, outcome } from '$lib/stores/myGames';
  import { formatDate } from '$lib/format';
  import { fedName } from '$lib/fideFeds';
  import { streak, study } from '$lib/study/progress';

  /** Visitors see the landing; a browser that was signed in before skips it while the sign-in loads. */
  const wasIn = typeof localStorage !== 'undefined' && localStorage.getItem('cc.wasIn') === '1';
  const showLanding = $derived($session.status === 'out' || ($session.status === 'loading' && !wasIn));
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'home.morning' : hour < 17 ? 'home.afternoon' : 'home.evening';
  const recent = $derived($shownGames.slice(0, 4));
  const days = $derived(streak($study, Date.now()));
</script>

<svelte:head><title>Chess Castles · Learn chess free in Marathi, Hindi & English</title></svelte:head>

<div class="home">
  {#if showLanding}
    <Landing />
  {:else}
    <MadeInIndia compact />
    <header class="hello">
      <h1 class="display">
        {$t(greetingKey)}{#if $session.status === 'in' && $myName},&nbsp;<TitleBadge title={$myTitle} size={22} />{$myName}{/if}
      </h1>
      <span class="hello-side">
        {#if days > 0}<a class="streak" href="/learn" title={$t('home.streak.short', { n: days })}><Icon name="flame" size={16} />{days}</a>{/if}
        {#if $myCountry}<img class="flag" src="/flags/{$myCountry}.svg" alt={fedName($myCountry)} title={fedName($myCountry)} width="27" height="18" />{/if}
      </span>
    </header>

    <FriendRequests inline />
    <CoachWork />

    <div class="cols">
      <div class="col main-col">
        <div class="o1"><PlayCard /></div>
        <!-- The Puzzle Lobby (owner, 2026-10-22): races and battles to join in a tap. -->
        <div class="o1"><PuzzleLobby /></div>
        <div class="o2"><TodayRow /></div>
        {#if $session.status === 'in'}<div class="o5"><LiveOnCC /></div>{/if}
        <div class="o7"><MyInsightsCard /></div>
      </div>
      <div class="col side-col">
        <div class="o3"><RatingTiles /></div>
        {#if $session.status === 'in'}<div class="o4"><OnlineNow /></div>{/if}
        <section class="o6 games" aria-labelledby="games-h">
          <h2 id="games-h" class="sec-h">{$t('home.yourgames')} {#if recent.length}<a href="/games">{$t('home.seeall')}</a>{/if}</h2>
          <div class="card list">
            {#each recent as g (g.id)}
              {@const o = outcome(g)}
              <a class="game" href="/analysis?game={g.id}">
                <span class="res {o}">{o === 'won' ? 'W' : o === 'lost' ? 'L' : o === 'draw' ? '½' : '–'}</span>
                <span class="g-text">
                  <span class="g-title">vs {opponentOf(g)}</span>
                  <span class="label">{KIND_LABEL[g.kind]}{g.timeControl ? ` · ${g.timeControl}` : ''} · {formatDate(g.playedAt)}</span>
                </span>
                <Icon name="chevron" size={16} color="var(--muted)" />
              </a>
            {:else}
              <p class="label empty">{$t('home.nogames')}</p>
            {/each}
          </div>
        </section>
      </div>
    </div>

    <ExploreIcons />

    <footer class="foot">
      <SocialLinks />
    </footer>
  {/if}
</div>

<style>
  .home {
    max-width: 1140px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .hello {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: -12px;
  }
  .hello h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.1;
    min-width: 0;
  }
  .hello-side {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 16%, transparent);
    color: var(--gold);
    font-weight: 800;
    text-decoration: none;
  }
  .flag {
    border-radius: 3px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-width: 0;
  }
  .col > div,
  .col > section {
    min-width: 0;
  }
  /* Phones and tablets: one column, in the order a player reaches for things. */
  @media (max-width: 1023px) {
    .cols {
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    .col {
      display: contents;
    }
    .o1 {
      order: 1;
    }
    .o2 {
      order: 2;
    }
    .o3 {
      order: 3;
    }
    .o4 {
      order: 4;
    }
    .o5 {
      order: 5;
    }
    .o6 {
      order: 6;
    }
    .o7 {
      order: 7;
    }
  }
  .games {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .list {
    display: flex;
    flex-direction: column;
    padding: 6px;
  }
  .empty {
    margin: 8px;
  }
  .game {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 8px;
    border-radius: var(--r-control);
    color: var(--text);
    text-decoration: none;
  }
  .game + .game {
    border-top: 1px solid var(--border-soft);
  }
  .game:hover {
    background: var(--raised);
    text-decoration: none;
  }
  .res {
    width: 36px;
    height: 36px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    font-family: var(--font-title);
    font-weight: 800;
    color: #fff;
    background: var(--muted);
  }
  .res.won {
    background: var(--win);
  }
  .res.lost {
    background: var(--loss);
  }
  .res.draw {
    background: var(--draw);
  }
  .g-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .g-title {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-top: 6px;
  }
  @media (max-width: 767px) {
    .home {
      gap: 20px;
    }
    .hello h1 {
      font-size: 26px;
    }
  }
</style>

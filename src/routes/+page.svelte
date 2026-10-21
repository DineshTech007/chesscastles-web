<script lang="ts">
  import MadeInIndia from '$lib/components/MadeInIndia.svelte';
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import SocialLinks from '$lib/components/SocialLinks.svelte';
  import { myTitle } from '$lib/stores/me';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import HeroLanding from '$lib/components/landing/HeroLanding.svelte';
  import KindWordsStrip from '$lib/components/KindWordsStrip.svelte';
  import MyInsightsCard from '$lib/components/MyInsightsCard.svelte';
  import LiveOnCC from '$lib/components/LiveOnCC.svelte';
  import OnlineNow from '$lib/components/OnlineNow.svelte';
  import { HERO_FEATURES } from '$lib/heroFeatures';
  import { t, type Key } from '$lib/i18n';
  import { PLAN_INFO, PLANS_ON, currentPlan } from '$lib/plans';
  import { myName } from '$lib/stores/me';
  import { onMount } from 'svelte';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import GameHistory from '$lib/components/GameHistory.svelte';
  import LeaderboardCard from '$lib/components/LeaderboardCard.svelte';
  import CoachWork from '$lib/components/CoachWork.svelte';
  import { fenOf, keyOf } from '$lib/chess/position';
  import { dailyPuzzle, topBroadcasts, type Broadcast, type DailyPuzzle } from '$lib/lichess';
  import { KIND_LABEL, myGames, opponentOf, outcome } from '$lib/stores/myGames';
  import { shownGames } from '$lib/stores/me';
  import { formatDate } from '$lib/format';
  import { session } from '$lib/auth';
  import { myCountry } from '$lib/stores/me';
  import RatingStrip from '$lib/components/RatingStrip.svelte';
  import ExploreGrid from '$lib/components/ExploreGrid.svelte';
  import FriendRequests from '$lib/components/FriendRequests.svelte';
  import FriendProgress from '$lib/components/FriendProgress.svelte';
  import { friendsCache } from '$lib/social';
  import { fedName } from '$lib/fideFeds';
  import { dayOf, streak, study } from '$lib/study/progress';
  import { loadPlan, nextStep, topicOn, TOPICS, hasPlan } from '$lib/study/plan';

  let puzzle = $state<DailyPuzzle | undefined>();
  let puzzleError = $state(false);
  let live = $state<Broadcast[] | undefined>();
  let liveError = $state(false);

  onMount(() => {
    dailyPuzzle().then((p) => (puzzle = p), () => (puzzleError = true));
    topBroadcasts().then((b) => (live = [...b.live, ...b.soon].slice(0, 4)), () => (liveError = true));
  });

  const recent = $derived($shownGames.slice(0, 3));
  const myStreak = $derived(streak($study, Date.now()));
  const studiedToday = $derived($study.some((a) => dayOf(a.at) === dayOf(Date.now())));
  let todayPlan = $state<{ label: string; color: string; href: string; title: string } | undefined>();
  onMount(() => {
    if (!hasPlan()) return;
    const t = topicOn(loadPlan(), new Date());
    if (t === 'rest') return;
    const step = nextStep(t);
    todayPlan = { label: TOPICS[t].label, color: TOPICS[t].color, href: step.href, title: step.title };
  });
  /** Visitors see the landing; a browser that was signed in before skips it while the sign-in loads. */
  const wasIn = typeof localStorage !== 'undefined' && localStorage.getItem('cc.wasIn') === '1';
  const showLanding = $derived($session.status === 'out' || ($session.status === 'loading' && !wasIn));
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'home.morning' : hour < 17 ? 'home.afternoon' : 'home.evening';
</script>

<svelte:head><title>Chess Castles · Learn chess free in Marathi, Hindi & English</title></svelte:head>

<div class="home">
  {#if showLanding}
    <HeroLanding closing={false} />
    <KindWordsStrip />
  {:else}
  <header class="hello">
    <div>
      <h1 class="display">
        {$t(greetingKey)}{#if $session.status === 'in'},&nbsp;<TitleBadge title={$myTitle} size={26} />{$myName}{/if}
        {#if PLANS_ON && $session.status === 'in'}<a class="h-plan" href="/plans" title="{PLAN_INFO[$currentPlan].name} member"><PlanBadge plan={$currentPlan} size={34} /></a>{/if}
        {#if $myCountry}<img class="h-flag" src="/flags/{$myCountry}.svg" alt={fedName($myCountry)} title={fedName($myCountry)} width="30" height="20" />{/if}
      </h1>
      <MadeInIndia />
      <p class="sub"><strong>{$t('home.learn')}</strong>{$t('home.learn2')}<strong>{$t('home.play')}</strong>{$t('home.play2')}<strong>{$t('home.conquer')}</strong>{$t('home.conquer2')}</p>
    </div>
    {#if ($session.status === 'in' && $session.profile) || $shownGames.length}<RatingStrip />{/if}
  </header>
  {/if}

  {#if !showLanding}<FriendRequests inline />{/if}

  {#if !studiedToday && (myStreak > 0 || todayPlan)}
    <a class="nudge card" href={todayPlan?.href ?? '/puzzles'}>
      <Icon name="flame" size={22} color="var(--gold)" />
      <span>
        {#if myStreak > 0}<strong>{$t('home.streak', { n: myStreak })}</strong> {$t('home.notyet')}{:else}<strong>{$t('home.todayplan')}</strong>{/if}
        {#if todayPlan} {$t('home.todayis', { label: todayPlan.label, title: todayPlan.title })}{:else} {$t('home.onepuzzle')}{/if}
      </span>
      <span class="btn primary">{$t('home.start')}</span>
    </a>
  {/if}

  {#if $session.status === 'in'}
    <!-- The player's own games, analysed by Guru, and the top game on Chess Castles now (or today), moving. -->
    <div class="duo">
      <MyInsightsCard />
      <LiveOnCC />
    </div>
    <!-- Friends online (here or on Lichess) and the players here now, to add as friends. -->
    <OnlineNow />
  {/if}

  {#if !showLanding}
    <section class="only-strip" aria-labelledby="only-h">
      <h2 id="only-h" class="label only-h"><Icon name="sparkle" size={14} color="var(--accent)" /> {$t('shell.signature')}</h2>
      <div class="only-row">
        {#each HERO_FEATURES as f (f.id)}
          <a class="only-tile card" href={f.href}>
            <span class="only-ic"><Icon name={f.icon} size={22} color="var(--on-action)" /></span>
            <strong>{$t(`hero.${f.id}.short` as Key)}</strong>
            <span class="label">{$t(`hero.${f.id}.cta` as Key)}</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  {#if !showLanding}<ExploreGrid />{/if}

  <CoachWork />

  <div class="row">
    <section class="card recent" aria-labelledby="recent-h">
      <div class="card-head">
        <h2 id="recent-h" class="title">{$t('home.yourgames')}</h2>
        <a href="/games">{$t('home.seeall')}</a>
      </div>
      {#if recent.length}
        {#each recent as g (g.id)}
          {@const o = outcome(g)}
          <a class="game" href="/analysis?game={g.id}">
            <span class="res {o}">{o === 'won' ? 'W' : o === 'lost' ? 'L' : o === 'draw' ? 'D' : '–'}</span>
            <span class="g-text">
              <span class="g-title">vs {opponentOf(g)}</span>
              <span class="label">{KIND_LABEL[g.kind]}{g.timeControl ? ` · ${g.timeControl}` : ''} · {formatDate(g.playedAt)}</span>
            </span>
          </a>
        {/each}
      {:else}
        <p class="label">{$t('home.nogames')}</p>
        <a class="btn primary" href="/play">{$t('home.firstgame')}</a>
      {/if}
    </section>
  </div>

  <div class="row">
    <section class="card puzzle" aria-labelledby="puzzle-h">
      <div class="card-head">
        <h2 id="puzzle-h" class="title">{$t('home.puzzle')}</h2>
        {#if puzzle}<span class="label">{$t('home.rating', { n: puzzle.rating })}</span>{/if}
      </div>
      {#if puzzle}
        <div class="mini">
          <Board
            fen={fenOf(puzzle.start)}
            orientation={puzzle.start.turn}
            lastMove={puzzle.lastMove?.map(keyOf)}
            viewOnly
            coordinates={false}
            label="Puzzle position"
          />
        </div>
        <div class="card-foot">
          <span class="label">{puzzle.start.turn === 'white' ? $t('home.white') : $t('home.black')}</span>
          <a class="btn primary" href="/puzzles">{$t('home.solve')}</a>
        </div>
      {:else if puzzleError}
        <p class="label">{$t('home.puzzleerr')}</p>
      {:else}
        <div class="mini skeleton"></div>
      {/if}
    </section>

    <section class="card live-card" aria-labelledby="live-h">
      <div class="card-head">
        <h2 id="live-h" class="title">{$t('home.live')}</h2>
        <span class="pill live"><span class="live-dot"></span>{$t('home.livebc')}</span>
      </div>
      {#if live}
        {#each live as b (b.id)}
          <a class="event" href="/watch/{b.id}">
            {#if b.image}<img src={b.image} alt="" loading="lazy" />{:else}<span class="img-ph"></span>{/if}
            <span class="g-text">
              <span class="g-title">{b.name}</span>
              <span class="label">{b.round}{b.location ? ` · ${b.location}` : ''}</span>
            </span>
            <Icon name="chevron" size={16} color="var(--muted)" />
          </a>
        {/each}
        <a href="/watch">{$t('home.allevents')}</a>
      {:else if liveError}
        <p class="label">{$t('home.liveerr')}</p>
      {:else}
        {#each [0, 1, 2] as i (i)}<div class="event skeleton-line"></div>{/each}
      {/if}
    </section>

    <LeaderboardCard />
  </div>

  {#if !showLanding && $friendsCache.length}<FriendProgress friends={$friendsCache} limit={5} title="Friends this week" />{/if}

  {#if $shownGames.length}
    <GameHistory limit={8} title={$t('home.recent')} />
  {/if}

  <SocialLinks />
</div>

<style>
  .duo {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    align-items: start;
  }
  @media (max-width: 900px) {
    .duo {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .only-strip {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .only-h {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 12px;
  }
  .only-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .only-tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px;
    color: var(--text);
    text-decoration: none;
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
    background:
      radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%),
      var(--card);
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .only-tile:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
  }
  .only-ic {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    margin-bottom: 4px;
    background: linear-gradient(135deg, #f7d27a, #edb040 50%, #c98a1b);
  }
  .only-tile strong {
    font-size: 15px;
  }
  .only-tile .label {
    font-size: 12.5px;
    color: var(--accent);
    font-weight: 700;
  }
  @media (max-width: 900px) {
    .only-row {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
  }
  .h-plan {
    display: inline-flex;
    vertical-align: middle;
    margin: 0 4px;
  }
  .sub strong {
    color: var(--accent);
    font-weight: 800;
  }
  .h-flag {
    display: inline-block;
    vertical-align: middle;
    margin-left: 6px;
    border-radius: 3px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .home {
    max-width: 1140px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .hello {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  h1 {
    font-size: 46px;
  }
  .sub {
    margin: 6px 0 0;
    color: var(--text-2);
    font-size: 16.5px;
  }
  .nudge {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-color: var(--gold);
    color: var(--text);
    text-decoration: none;
  }
  .nudge span:not(.btn) {
    flex: 1;
  }
  .nudge:hover {
    text-decoration: none;
  }
  .row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  .recent {
    flex: 1 1 300px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .card-head .title {
    font-size: 19px;
  }
  .game,
  .event {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    margin: 0 -8px;
    border-radius: var(--r-control);
    color: var(--text);
    text-decoration: none;
  }
  .game:hover,
  .event:hover {
    background: var(--raised);
    text-decoration: none;
  }
  .res {
    width: 38px;
    height: 38px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    font-family: var(--font-title);
    font-weight: 700;
    border: 1px solid currentColor;
  }
  .res.won {
    color: var(--win);
  }
  .res.lost {
    color: var(--loss);
  }
  .res.draw {
    color: var(--accent);
  }
  .res.unfinished {
    color: var(--muted);
  }
  .g-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .g-title {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .puzzle {
    flex: 1 1 300px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mini {
    width: min(100%, 300px);
    align-self: center;
  }
  .skeleton,
  .skeleton-line {
    background: linear-gradient(90deg, var(--raised), var(--card), var(--raised));
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
    border-radius: 8px;
  }
  .skeleton {
    aspect-ratio: 1;
  }
  .skeleton-line {
    height: 54px;
  }
  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .live-card {
    flex: 2 1 420px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--live);
  }
  .event img,
  .img-ph {
    width: 88px;
    height: 44px;
    object-fit: cover;
    border-radius: 8px;
    flex: none;
    background: var(--raised);
  }
  @media (max-width: 767px) {
    h1 {
      font-size: 36px;
    }
  }
</style>

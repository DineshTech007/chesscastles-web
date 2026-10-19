<script lang="ts">
  import '../fonts.css';
  import '../app.css';
  import { navigating, page } from '$app/state';
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { myGames } from '$lib/stores/myGames';
  import { study, weekOf, weekPoints } from '$lib/study/progress';
  import { allProgress } from '$lib/books/books';
  import { watchSession } from '$lib/auth';
  import { setSound, soundOn } from '$lib/sound';
  import { reportStudy } from '$lib/study/reminders';
  import { myProfile, refreshBadge, saveProfile } from '$lib/social';
  import { session } from '$lib/auth';
  import { kfide, kfideAll, myCountry, movePhotoOutOfFirebase, myFideId, myInitials, myPhoto, myRatingSet, myTitle, photoSrc, setAccountPhoto, setMyCountry, setMyName } from '$lib/stores/me';
  import { fedName } from '$lib/fideFeds';
  import { goto } from '$app/navigation';
  import { gameEnded } from '$lib/stores/gameEnded';
  import { loadResume, resumeHref, type ResumeState } from '$lib/game/resume';
  import { lichessToken, signOut, startSignIn } from '$lib/auth';
  import { KFIDE_SPEEDS } from '$lib/kfide';
  import { syncGames } from '$lib/stores/gameSync';
  import { get } from 'svelte/store';
  import { afterNavigate } from '$app/navigation';
  import LimitModal from '$lib/components/LimitModal.svelte';
  import SignInModal from '$lib/components/SignInModal.svelte';
  import BoardThemeModal from '$lib/components/BoardThemeModal.svelte';
  import { boardThemeOpen } from '$lib/boardTheme';
  import { flush, pageView, setSignedIn } from '$lib/analytics';
  import { keepReferral, loadPlanSettings, planSettings, refreshMyPlan, sendReferral } from '$lib/plans';

  let { children } = $props();
  let theme = $state<'dark' | 'light'>('dark');
  let width = $state(1280);

  /**
   * A live Lichess game when Chess Castles opens at its home page (after a lost
   * connection or a closed browser): straight back to it, since a real opponent
   * is waiting. A game against Chess Castles' opponents is never forced on the
   * player: the bar above the page offers it (pages opened from a link, such
   * as Learn, open as asked).
   */
  let resumeChecked = false;
  async function backToGame(signedIn: boolean) {
    if (resumeChecked) return;
    resumeChecked = true;
    const here = page.url.pathname;
    if (here !== '/' || page.url.searchParams.has('resume')) return;
    const token = signedIn ? lichessToken()?.token : undefined;
    if (token) {
      try {
        const res = await fetch('https://lichess.org/api/account/playing', { headers: { Authorization: `Bearer ${token}` } });
        const g = res.ok ? (await res.json()).nowPlaying?.find((x: { variant?: { key?: string }; speed?: string }) => x.speed !== 'correspondence') : undefined;
        if (g?.gameId) return void goto(`/play/online/${g.gameId}?c=${g.color}`);
      } catch {
        /* offline: nothing to resume from Lichess */
      }
    }
  }

  /** Whether the player came to this page from another page of the site (so Back can return there). */
  let cameInside = $state(false);
  afterNavigate(({ from }) => {
    if (from) cameInside = true;
  });
  /** The game page's Back: the previous page of the site, or Play when the game was opened directly. */
  function leaveGame() {
    if (cameInside) history.back();
    else void goto('/play');
  }

  /** Two accounts were mixed in this browser: signed out, to sign in again. */
  let mixedAccounts = $state(false);

  /** A game left in progress inside the site: a bar to return to it. */
  let pending = $state<ResumeState | undefined>();
  $effect(() => {
    void page.url.pathname;
    pending = loadResume();
  });
  const onGamePage = $derived(!!pending && page.url.pathname === pending.route.split('?')[0]);

  // Analytics: the page's route ("/players/[uid]", never the address with names in it).
  afterNavigate(() => pageView(page.route.id ?? page.url.pathname));

  /** The site banner from the admin page, hidden for the session once closed. */
  let bannerClosed = $state('');
  const banner = $derived($planSettings.banner);

  onMount(() => {
    // The app is up: the first screen from app.html goes.
    document.getElementById('boot')?.remove();
    myGames.load();
    keepReferral(page.url);
    void loadPlanSettings();
    try {
      bannerClosed = sessionStorage.getItem('cc.bannerClosed') ?? '';
    } catch {
      /* blocked */
    }
    const onHide = () => document.visibilityState === 'hidden' && flush(true);
    document.addEventListener('visibilitychange', onHide);
    const onLeave = () => flush(true);
    addEventListener('pagehide', onLeave);
    study.load();
    const stop = watchSession();
    const unResume = session.subscribe((s) => {
      if (s.status !== 'loading') void backToGame(s.status === 'in');
    });
    // The human-like engine (46 MB) downloads only where it plays: the Play
    // page and its games (not on every page: phones and their data plans).
    // Studying today switches off today's reminders.
    // Study points this week and book chapters read go to the leaderboards (signed in, a few seconds after a change).
    let lastBoards = '';
    let boardsTimer: ReturnType<typeof setTimeout> | undefined;
    const syncBoards = () => {
      clearTimeout(boardsTimer);
      boardsTimer = setTimeout(() => {
        if (get(session).status !== 'in') return;
        const now = Date.now();
        const studyWeek = { week: weekOf(now), points: weekPoints(get(study), now) };
        const booksRead = Object.values(allProgress()).reduce((n, b) => n + (b.read?.length ?? 0), 0);
        const key = JSON.stringify([studyWeek, booksRead]);
        if (key === lastBoards || (!studyWeek.points && !booksRead)) return;
        lastBoards = key;
        void saveProfile({ studyWeek, booksRead }).catch(() => (lastBoards = ''));
      }, 3000);
    };
    const unStudy = study.subscribe((list) => {
      void reportStudy(list);
      syncBoards();
    });
    // Signed in: keep the friends badge fresh, and share the CC Rating with friends.
    let badgeTimer: ReturnType<typeof setInterval> | undefined;
    const unSession = session.subscribe((s) => {
      // One account at a time: a Lichess login that is not the signed-in account's (two people on one browser) signs out cleanly.
      // (A browser that lost the saved Lichess login keeps the account: only a different account signs out.)
      const t = s.status === 'in' ? lichessToken() : undefined;
      // (A Google account may have connected a Lichess login of any name for online play.)
      if (s.status === 'in' && t && s.uid.startsWith('lichess:') && t.username.toLowerCase() !== s.uid.replace(/^lichess:/, '')) {
        mixedAccounts = true;
        void signOut();
        return;
      }
      // New games are marked with the account that plays them (CC Rating is per account).
      myGames.setOwner(s.status === 'in' ? s.uid : undefined);
      clearInterval(badgeTimer);
      setSignedIn(s.status === 'in');
      try {
        if (s.status === 'in') localStorage.setItem('cc.wasIn', '1');
        else if (s.status === 'out') localStorage.removeItem('cc.wasIn');
      } catch {
        /* blocked */
      }
      if (s.status !== 'loading') void refreshMyPlan();
      if (s.status !== 'in') return;
      // An invite link opened before signing in: the friend who invited gets their reward.
      void sendReferral(s.username).then(refreshMyPlan);
      void refreshBadge();
      badgeTimer = setInterval(refreshBadge, 60_000);
      // My games on every device (games from the account come in, this browser's go up), on its own.
      void syncGames(s.uid);
      myProfile()
        .then((p) => {
          if (p.country) setMyCountry(p.country);
          setMyName(s.uid, p.name);
          // The owner's rating changes first: the CC Ratings below already count from them.
          myRatingSet.set(p.ratingSet ?? {});
          myTitle.set(p.title);
          setAccountPhoto(s.uid, p.photo);
          void movePhotoOutOfFirebase(s.uid, !!p.photo).catch(() => {});
          myFideId.set(p.fideId ?? '');
          syncBoards();
          const k = get(kfide);
          const all = get(kfideAll);
          const kfideTc = Object.fromEntries(KFIDE_SPEEDS.filter((s) => all[s].games).map((s) => [s, { rating: all[s].rating, games: all[s].games }]));
          if (k.games && (p.kfide !== k.rating || p.kfideGames !== k.games || JSON.stringify(p.kfideTc ?? {}) !== JSON.stringify(kfideTc)))
            return saveProfile({ kfide: k.rating, kfideGames: k.games, kfideTc });
        })
        .catch(() => {});
    });
    theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    return () => {
      stop();
      unStudy();
      unSession();
      unResume();
      clearInterval(badgeTimer);
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('pagehide', onLeave);
    };
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('k24.theme', theme);
    } catch {
      /* private mode */
    }
  }

  // The full menu stays on every page (the board adapts instead); it shrinks
  // to icons only when the screen is too narrow for both.
  const phone = $derived(width < 768);
  /** During a game on a phone: no site header or tab bar, so the board and the controls fit on one screen. */
  // Phones: a game in progress gets the whole screen (no bottom bar) until it ends.
  const focusGame = $derived(phone && !$gameEnded && /^\/play\/(fide|computer|online\/|tournament\/game)/.test(page.url.pathname));
  const collapsed = $derived(width < 960);

  const tabs = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/play', label: 'Play', icon: 'knight' },
    { href: '/puzzles', label: 'Puzzles', icon: 'puzzle' },
    { href: '/analysis', label: 'Analyse', icon: 'analyse' },
    { href: '/more', label: 'More', icon: 'menu' },
  ] as const;
  const tabOn = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<svelte:window bind:innerWidth={width} />

{#if navigating.to}<div class="nav-progress" role="progressbar" aria-label="Opening the page"></div>{/if}
<div class="shell">
  {#if !phone}
    <Sidebar {collapsed} />
  {/if}
  <div class="main">
    {#if focusGame}
      <div class="focus-top">
        <button class="focus-back" onclick={leaveGame} aria-label="Leave the game page"><Icon name="back" size={18} />Back</button>
        <span class="focus-name">CHESS <span class="gold">CASTLES</span></span>
        <span class="focus-actions">
          <button class="icon-btn" onclick={() => setSound(!$soundOn)} aria-label={$soundOn ? 'Turn move sounds off' : 'Turn move sounds on'}><Icon name={$soundOn ? 'speaker' : 'mute'} size={18} /></button>
          <button class="icon-btn" onclick={() => ($boardThemeOpen = true)} aria-label="Board colour" title="Board colour"><Icon name="palette" size={18} /></button>
        </span>
      </div>
    {:else}
    <header class="top">
      {#if phone}
        <a class="phone-brand" href="/" aria-label="Chess Castles: Learn, Play, Conquer (home)">
          <img class="logo-dark" src="/brand/chesscastles-crest-dark.svg" alt="" height="36" />
          <img class="logo-light" src="/brand/chesscastles-crest-light.svg" alt="" height="36" />
          <span class="pb-text">
            <span class="pb-name">CHESS <span class="pb-c2">CASTLES</span></span>
            <span class="pb-slogan">LEARN · PLAY · CONQUER</span>
          </span>
        </a>
      {/if}
      <div class="grow"></div>
      <button class="icon-btn" onclick={() => setSound(!$soundOn)} aria-label={$soundOn ? 'Turn move sounds off' : 'Turn move sounds on'} title={$soundOn ? 'Move sounds on' : 'Move sounds off'}>
        <Icon name={$soundOn ? 'speaker' : 'mute'} size={20} />
      </button>
      <button class="icon-btn" onclick={toggleTheme} aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
      </button>
      <button class="icon-btn" onclick={() => ($boardThemeOpen = true)} aria-label="Board colour" title="Board colour">
        <Icon name="palette" size={20} />
      </button>
      <a class="top-me" href="/profile" title="Your profile" aria-label="Your profile">
        <span class="top-av">
          {#if $myPhoto}<img src={photoSrc($myPhoto)} alt="" />{:else if $session.status === 'in'}{$myInitials}{:else}<Icon name="users" size={18} />{/if}
        </span>
        {#if $myCountry}<img class="top-flag" src="/flags/{$myCountry}.svg" alt={fedName($myCountry)} title={fedName($myCountry)} width="18" height="12" />{/if}
      </a>
    </header>
    {/if}
    {#if mixedAccounts}
      <div class="resume-bar warn" role="alert">
        <span>Two different accounts were signed in on this browser, so Chess Castles signed you out to keep them apart. Please sign in again.</span>
        <button class="btn primary" onclick={() => ((mixedAccounts = false), startSignIn())}>Sign in</button>
      </div>
    {/if}
    {#if banner.on && banner.text && bannerClosed !== banner.text}
      <div class="resume-bar site-banner" role="status">
        {#if banner.link}<a href={banner.link}>{banner.text}</a>{:else}<span>{banner.text}</span>{/if}
        <button
          class="icon-btn"
          aria-label="Close"
          onclick={() => {
            bannerClosed = banner.text;
            try {
              sessionStorage.setItem('cc.bannerClosed', banner.text);
            } catch {
              /* blocked */
            }
          }}><Icon name="close" size={16} /></button>
      </div>
    {/if}
    {#if pending && !onGamePage}
      <a class="resume-bar" href={resumeHref(pending)}>
        <span class="pulse"></span>
        <span>Your game against <strong>{pending.opponent}</strong> is still on.</span>
        <span class="go">Return to the game →</span>
      </a>
    {/if}
    <main id="content" class:focus={focusGame}>
      {@render children()}
    </main>
  </div>
</div>

<LimitModal />
<SignInModal />
<BoardThemeModal bind:open={$boardThemeOpen} />

{#if phone && !focusGame}
  <nav class="tabs" aria-label="Main">
    {#each tabs as t (t.href)}
      {@const on = tabOn(t.href)}
      <a href={t.href} aria-current={on ? 'page' : undefined} class:on title={t.href === '/more' ? 'More: all pages, profile and settings' : undefined}>
        {#if t.href === '/more'}<span class="sr-only">All pages, profile and settings: </span>{/if}
        <span class="tab-icon"><Icon name={t.icon} color={on ? 'var(--accent)' : 'var(--muted)'} /></span>
        {t.label}
      </a>
    {/each}
  </nav>
{/if}

<style>
  /* Shows only if opening the page takes more than a moment. */
  .nav-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 1000;
    overflow: hidden;
    opacity: 0;
    animation: nav-show 0s 0.15s forwards;
  }
  .nav-progress::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 40%;
    background: var(--accent);
    animation: nav-slide 1s ease-in-out infinite;
  }
  @keyframes nav-show {
    to {
      opacity: 1;
    }
  }
  @keyframes nav-slide {
    from {
      left: -40%;
    }
    to {
      left: 100%;
    }
  }
  .site-banner {
    justify-content: space-between;
    font-weight: 600;
  }
  .site-banner a {
    flex: 1;
    color: var(--text);
  }
  .site-banner .icon-btn {
    flex: none;
  }
  .resume-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 24px 0;
    padding: 10px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--gold) 16%, var(--card));
    border: 1px solid var(--gold);
    color: var(--text);
    text-decoration: none;
    font-size: 14.5px;
  }
  .resume-bar span:nth-child(2) {
    flex: 1;
  }
  .resume-bar .go {
    font-weight: 800;
    color: var(--gold);
    white-space: nowrap;
  }
  .resume-bar .pulse {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 50%;
    background: var(--gold);
    animation: rb 1.4s ease-in-out infinite;
  }
  @keyframes rb {
    50% {
      opacity: 0.3;
    }
  }
  @media (max-width: 767px) {
    .resume-bar {
      margin: 8px 16px 0;
    }
  }
  .top-me {
    position: relative;
    display: inline-flex;
    flex: none;
    text-decoration: none;
  }
  .top-av {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: var(--raised);
    border: 2px solid var(--gold);
    color: var(--text);
    font-weight: 800;
    font-size: 14px;
  }
  .top-av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .top-flag {
    position: absolute;
    right: -4px;
    bottom: -2px;
    border-radius: 2px;
    box-shadow: 0 0 0 2px var(--bg, #0b1020);
  }
  .shell {
    display: flex;
    min-height: 100vh;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px 0;
  }
  .grow {
    flex: 1;
  }
  .phone-brand img {
    height: 36px;
    width: auto;
    display: block;
  }
  .pb-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pb-name {
    font-family: Cinzel, Georgia, serif;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.03em;
    line-height: 1;
    color: var(--text);
    white-space: nowrap;
  }
  .pb-c2 {
    color: var(--gold);
  }
  .pb-slogan {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    line-height: 1;
    color: var(--muted);
    white-space: nowrap;
  }
  .logo-light {
    display: none !important;
  }
  :global(:root[data-theme='light']) .logo-light {
    display: block !important;
  }
  :global(:root[data-theme='light']) .logo-dark {
    display: none !important;
  }
  .phone-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--text);
    text-decoration: none;
  }
  main {
    flex: 1;
    padding: 8px 24px 48px;
  }
  @media (max-width: 767px) {
    .top {
      padding: 10px 16px 0;
    }
    main {
      padding: 8px 16px 96px;
    }
  }
  .focus-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px 0;
  }
  .focus-back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 40px;
    padding: 0 10px 0 4px;
    border: 0;
    background: none;
    color: var(--text-2);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .focus-name {
    flex: 1;
    text-align: center;
    font-family: 'Cinzel', serif;
    font-weight: 800;
    font-size: 14px;
    letter-spacing: 0.04em;
  }
  .focus-actions {
    display: flex;
    gap: 2px;
  }
  .focus-name .gold {
    color: var(--gold);
  }
  main.focus {
    padding: 4px 10px 24px;
  }
  .tabs {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    background: var(--rail);
    border-top: 1px solid var(--border-soft);
    padding: 6px 4px calc(10px + env(safe-area-inset-bottom));
  }
  .tabs a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 4px 0;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
  }
  .tab-icon {
    width: 52px;
    height: 30px;
    border-radius: 15px;
    display: grid;
    place-items: center;
  }
  .tabs a.on {
    color: var(--text);
  }
  .tabs a.on .tab-icon {
    background: var(--raised);
  }
</style>

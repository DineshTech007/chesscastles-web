<script lang="ts">
  import { betaOn } from '$lib/beta';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import SocialLinks from './SocialLinks.svelte';
  import { page } from '$app/state';
  import Icon, { type IconName } from './Icon.svelte';
  import { session, signOut, startSignIn } from '$lib/auth';
  import { kfide, myInitials, myName, myPhoto, myTitle, photoSrc } from '$lib/stores/me';
  import TitleBadge from './TitleBadge.svelte';
  import { SPEED_LABEL } from '$lib/kfide';
  import { socialBadge } from '$lib/social';
  import { PLAN_INFO, PLANS_ON, currentPlan } from '$lib/plans';
  import { HERO_FEATURES } from '$lib/heroFeatures';
  import { NAV_GROUPS, navKey } from '$lib/nav';
  import { t, type Key } from '$lib/i18n';
  import { adminMe } from '$lib/admin';
  import { installOpen, installWay } from '$lib/install';
  import { checkClassroom, classroomShown } from '$lib/classroom/visible';

  /** Admins see a link to the admin page (asked once per sign-in). */
  let isAdmin = $state(false);
  $effect(() => {
    if ($session.status !== 'in') return void (isAdmin = false);
    adminMe().then(
      () => (isAdmin = true),
      () => (isAdmin = false),
    );
  });

  let { collapsed = false }: { collapsed?: boolean } = $props();
  // CastlesClass: admins, coaches, and students once a coach enrols them (src/lib/classroom/visible.ts).
  $effect(() => checkClassroom($session.status === 'in' ? $session.uid : undefined));
  const classroom = { href: '/castleclass', label: 'CastlesClass', icon: 'coach' as IconName, match: ['/castleclass'] };

  type Item = { href: string; label: string; icon: IconName; match: string[]; not?: string[]; badge?: string; key?: Key };
  /** Home, then the five features only Chess Castles has (in gold), then the everyday pages (src/lib/nav.ts). */
  const home: Item = { href: '/', label: 'Home', icon: 'home', match: ['/'], key: 'shell.home' };
  const only: Item[] = HERO_FEATURES.map((f) => ({ href: f.href, label: f.short, icon: f.icon, match: f.match, key: `hero.${f.id}.short` as Key }));
  const groups: Item[][] = NAV_GROUPS.map((g) => g.filter((i) => i.menu !== false).map((i) => ({ ...i, key: navKey(i.href) })));
  const name = (i: Item, tr: (k: Key) => string) => (i.key ? tr(i.key) : i.label);

  const isOn = (item: Item) =>
    !item.not?.some((n) => page.url.pathname.startsWith(n)) &&
    item.match.some((m) => (m === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(m)));
</script>

<nav class="rail" class:collapsed aria-label="Main">
  <a class="brand" href="/" title="Chess Castles: Learn, Play, Conquer (home)" aria-label={collapsed ? `${betaOn() ? 'Beta: ' : ''}Chess Castles home` : undefined}>
    <img class="crest logo-dark" src="/brand/chesscastles-crest-dark.svg" alt="" width="40" height="45" />
    <img class="crest logo-light" src="/brand/chesscastles-crest-light.svg" alt="" width="40" height="45" />
    {#if betaOn()}<span class="beta" title="Beta: everything is free until 30 November 2026">BETA</span>{/if}
    {#if !collapsed}
      <span class="brand-text">
        <span class="name">CHESS <span class="c2">CASTLES</span></span>
        <span class="slogan">LEARN · PLAY · CONQUER</span>
      </span>
    {/if}
  </a>

  <div class="nav">
    {@render link(home)}
    <div class="only" class:collapsed aria-label="Signature features" role="group">
      {#if !collapsed}<span class="only-h"><Icon name="sparkle" size={13} color="var(--accent)" />{$t('shell.signature')}</span>{/if}
      {#each only as item (item.href)}
        {@const on = isOn(item)}
        <a class="item gold" class:on href={item.href} aria-current={on ? 'page' : undefined} title={collapsed ? name(item, $t) : undefined}>
          <span class="gchip"><Icon name={item.icon} size={16} color="#0b1426" /></span>
          {#if !collapsed}<span>{name(item, $t)}</span>{/if}
        </a>
      {/each}
    </div>
    <!-- Castle Cups (2026-10-22): our own tournaments every evening, lit up like Puzzle Racer. -->
    <a class="item rushnav cupnav" class:on={page.url.pathname.startsWith('/cups')} href="/cups" title={collapsed ? `Castle Cups (${$t('nav.new')})` : $t('nav.cups.b')}>
      <span class="rchip">🏆</span>
      {#if !collapsed}<span>Castle Cups</span><span class="newtag hot">{$t('nav.new')}</span>{:else}<span class="rdot" aria-hidden="true"></span>{/if}
    </a>
    <!-- Puzzle Racer (2026-10-22) and Puzzle Rush: new and a must-try (owner), lit up in the menu. -->
    <a class="item rushnav racenav" class:on={page.url.pathname.startsWith('/puzzles/racer')} href="/puzzles/racer" title={collapsed ? `Puzzle Racer (${$t('nav.new')})` : 'Race other players through the same puzzles'}>
      <span class="rchip">🏎️</span>
      {#if !collapsed}<span>Puzzle Racer</span><span class="newtag hot">{$t('nav.new')}</span>{:else}<span class="rdot" aria-hidden="true"></span>{/if}
    </a>
    <a class="item rushnav" class:on={page.url.pathname.startsWith('/puzzles/rush')} href="/puzzles/rush" title={collapsed ? $t('home.rush.h') : $t('home.rush.sub')}>
      <span class="rchip"><Icon name="flame" size={16} color="#fff" /></span>
      {#if !collapsed}<span>{$t('home.rush.h')}</span>{/if}
    </a>
    {#if $classroomShown}{@render link(classroom)}{/if}
    {#each groups as group, gi (gi)}
      {#if gi}<hr class="sep" />{/if}
      {#each group as item (item.href)}
        {@render link(item)}
      {/each}
    {/each}
  </div>
  {#snippet link(item: Item)}
        {@const on = isOn(item)}
        <a class="item" class:on href={item.href} aria-current={on ? 'page' : undefined} title={collapsed ? name(item, $t) : undefined}>
          <Icon name={item.icon} color={on ? 'var(--accent)' : 'var(--muted)'} />
          {#if !collapsed}<span>{name(item, $t)}</span>{/if}
          {#if item.badge && !collapsed}<span class="newtag">{$t('nav.new')}</span>{/if}
          {#if item.href === '/friends' && $socialBadge}<span class="nbadge">{$socialBadge}</span>{/if}
        </a>
  {/snippet}
  <div class="account">
    {#if $session.status === 'in'}
      <a class="me" href="/profile" title="Your profile">
        <span class="avatar">{#if $myPhoto}<img src={photoSrc($myPhoto)} alt="" />{:else}{$myInitials}{/if}</span>
        {#if !collapsed}
          <span class="me-text">
            <span class="me-name"><TitleBadge title={$myTitle} size={11} />{$myName} <PlanBadge plan={$currentPlan} /></span>
            <span class="label me-sub">
              CC Rating {$kfide.rating}{$kfide.provisional ? ' (new)' : ''} · {SPEED_LABEL[$kfide.speed]}
            </span>
          </span>
        {/if}
      </a>
      {#if !collapsed}
        <div class="acct-links">
          {#if PLANS_ON}<a class="plan-chip" href="/plans" title="Your plan">{PLAN_INFO[$currentPlan].name} plan</a>{/if}
          <a class="link" href="/settings">{$t('shell.settings')}</a>
          {#if isAdmin}<a class="link" href="/admin">Admin</a>{/if}
          <button class="link" onclick={() => signOut()}>{$t('shell.signout')}</button>
        </div>
      {/if}
    {:else if $session.status === 'out'}
      {#if !collapsed}
        <a class="me guest" href="/profile" title="Your profile">
          <span class="avatar">{#if $myPhoto}<img src={photoSrc($myPhoto)} alt="" />{:else}<Icon name="users" size={18} color="#fff" />{/if}</span>
          <span class="me-text"><span class="me-name">{$t('shell.profile')}</span><span class="label me-sub">CC Rating {$kfide.rating}{$kfide.provisional ? ' (new)' : ''} · {SPEED_LABEL[$kfide.speed]}</span></span>
        </a>
      {/if}
      <button class="btn signin" class:icon-only={collapsed} onclick={() => startSignIn()} title="Sign in">
        <Icon name="users" size={18} />{#if !collapsed}{$t('shell.signin')}{/if}
      </button>
    {/if}
    {#if !collapsed}
      <nav class="foot" aria-label="Help and policies">{#if PLANS_ON}<a href="/plans">Plans</a>{/if}{#if $installWay !== 'none' && $installWay !== 'installed'}<button class="install" onclick={() => installOpen.set(true)}>{$t('shell.install')}</button>{/if}<a href="/settings">{$t('shell.settings')}</a><a href="/parents">{$t('shell.parents')}</a><a href="/feedback">{$t('shell.feedback')}</a><a href="/help">{$t('shell.help')}</a><a href="/contact">{$t('shell.contact')}</a><a href="/legal/terms">{$t('shell.terms')}</a><a href="/legal/privacy">{$t('shell.privacy')}</a><a href="/legal/fair-play">{$t('shell.fairplay')}</a><a href="/legal/refunds">{$t('shell.refunds')}</a><SocialLinks compact /></nav>
    {/if}
  </div>
</nav>

<style>
  .acct-links {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
    flex-wrap: wrap;
  }
  .plan-chip {
    font-size: 12px;
    font-weight: 800;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid var(--gold);
    color: var(--text);
    text-decoration: none;
  }
  .rail {
    position: sticky;
    top: 0;
    height: 100vh;
    width: 236px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 18px 14px;
    background: var(--rail);
    border-right: 1px solid var(--border-soft);
    overflow: hidden;
  }
  /* The links scroll on their own only on very short screens, without a visible scrollbar. */
  .nav {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .nav::-webkit-scrollbar {
    display: none;
  }
  .only {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 6px 0;
    padding: 6px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 13%, transparent), color-mix(in srgb, var(--accent) 3%, transparent));
  }
  .only.collapsed {
    padding: 4px;
    align-items: center;
  }
  .only-h {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px 4px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .item.gold {
    color: var(--text);
    font-weight: 700;
  }
  .item.gold:hover,
  .item.gold.on {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  .gchip {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    flex: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #f7d27a, #edb040 50%, #c98a1b);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  /* Puzzle Rush: a warm glow that breathes, a shine passing over, a flickering flame and a bobbing NEW. */
  .item.rushnav {
    position: relative;
    overflow: hidden;
    margin: 4px 0;
    color: var(--text);
    font-weight: 700;
    border: 1px solid color-mix(in srgb, #f97316 60%, transparent);
    background: linear-gradient(135deg, color-mix(in srgb, #f97316 20%, transparent), color-mix(in srgb, var(--gold) 12%, transparent));
    animation: rushglow 2.4s ease-in-out infinite;
  }
  .item.rushnav::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.22) 45%, transparent 60%);
    transform: translateX(-100%);
    animation: rushshine 3.6s ease-in-out infinite;
    pointer-events: none;
  }
  .item.cupnav {
    background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 24%, transparent), color-mix(in srgb, #ef4444 12%, transparent));
  }
  .cupnav .rchip {
    background: linear-gradient(135deg, #fde68a, var(--gold) 55%, #d97706);
  }
  .item.racenav {
    border-color: color-mix(in srgb, #38bdf8 60%, transparent);
    background: linear-gradient(135deg, color-mix(in srgb, #38bdf8 20%, transparent), color-mix(in srgb, #a855f7 14%, transparent));
  }
  .racenav .rchip {
    background: linear-gradient(135deg, #38bdf8, #6366f1 55%, #a855f7);
    font-size: 15px;
  }
  .item.rushnav:hover,
  .item.rushnav.on {
    background: linear-gradient(135deg, color-mix(in srgb, #f97316 32%, transparent), color-mix(in srgb, var(--gold) 20%, transparent));
  }
  .rchip {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    flex: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #fbbf24, #f97316 55%, #ef4444);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
    animation: rushflame 1.4s ease-in-out infinite;
  }
  .newtag.hot {
    background: linear-gradient(135deg, #fb7185, #f43f5e);
    color: #fff;
    animation: rushbob 1.2s ease-in-out infinite;
  }
  .rdot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #f43f5e;
    box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7);
    animation: rushping 1.6s ease-out infinite;
  }
  @keyframes rushglow {
    50% {
      box-shadow: 0 0 14px color-mix(in srgb, #f97316 45%, transparent);
    }
  }
  @keyframes rushshine {
    55%,
    100% {
      transform: translateX(100%);
    }
  }
  @keyframes rushflame {
    25% {
      transform: rotate(-6deg) scale(1.06);
    }
    75% {
      transform: rotate(5deg) scale(0.97);
    }
  }
  @keyframes rushbob {
    50% {
      transform: translateY(-2px) scale(1.06);
    }
  }
  @keyframes rushping {
    80%,
    100% {
      box-shadow: 0 0 0 7px rgba(244, 63, 94, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .item.rushnav,
    .item.rushnav::after,
    .rchip,
    .newtag.hot,
    .rdot {
      animation: none;
    }
  }
  .sep {
    border: 0;
    border-top: 1px solid var(--border-soft);
    margin: 6px 10px;
  }
  .rail.collapsed {
    width: 72px;
    padding: 18px 10px;
    align-items: center;
  }
  .crest {
    height: 45px;
    width: auto;
    flex: none;
    display: block;
  }
  /* The name on one line, the slogan under it. */
  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .name {
    font-family: Cinzel, Georgia, serif;
    font-weight: 800;
    font-size: 16px;
    letter-spacing: 0.03em;
    line-height: 1;
    color: var(--text);
    white-space: nowrap;
  }
  /* BETA on the crest's foot (the name fills the rail's width). */
  .beta {
    position: absolute;
    left: 1px;
    top: 33px;
    padding: 1px 4px 0;
    border-radius: 4px;
    background: var(--gold);
    color: #0b1426;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.06em;
    line-height: 1.3;
    pointer-events: none;
  }
  .c2 {
    color: var(--gold);
  }
  .slogan {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.13em;
    line-height: 1;
    color: var(--muted);
    white-space: nowrap;
  }
  /* The logo for the theme: gold on navy, or navy on light. */
  .logo-light {
    display: none !important;
  }
  :global(:root[data-theme='light']) .logo-light {
    display: block !important;
  }
  :global(:root[data-theme='light']) .logo-dark {
    display: none !important;
  }
  .brand {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 6px 16px;
    color: var(--text);
    text-decoration: none;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
    min-height: 40px;
    padding: 0 12px;
    border-radius: var(--r-control);
    color: var(--text-2);
    font-weight: 600;
    font-size: 15px;
    text-decoration: none;
    transition: background 0.15s;
  }
  .collapsed .item {
    width: 48px;
    padding: 0;
    justify-content: center;
  }
  .item:hover {
    background: var(--raised);
    color: var(--text);
  }
  .item.on {
    background: var(--raised);
    color: var(--text);
  }
  @media (max-height: 760px) {
    .item {
      min-height: 31px !important;
      font-size: 14px !important;
    }
    .guest {
      display: none !important;
    }
  }
  @media (max-height: 820px) {
    .rail {
      padding-top: 12px;
      padding-bottom: 12px;
    }
    .brand {
      padding-bottom: 8px;
    }
    .item {
      min-height: 34px;
      font-size: 14.5px;
    }
    .sep {
      margin: 4px 10px;
    }
  }
  .account {
    flex: none;
    border-top: 1px solid var(--border-soft);
    margin-top: 6px;
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    padding: 2px 4px 0;
  }
  .foot a,
  .foot .install {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
  }
  .foot a {
    color: var(--muted);
    font-size: 12px;
    text-decoration: none;
  }
  .foot .install {
    border: 0;
    padding: 0;
    background: none;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
    cursor: pointer;
  }
  .foot a:hover {
    color: var(--text);
    text-decoration: underline;
  }
  .newtag {
    margin-left: auto;
    padding: 1px 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f7d27a, #edb040 55%, #c98a1b);
    color: #0b1426;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .nbadge {
    margin-left: auto;
    min-width: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--loss);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
  .me {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: inherit;
    text-decoration: none;
    border-radius: var(--r-control);
  }
  .me:hover .me-name {
    text-decoration: underline;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  .avatar {
    overflow: hidden;
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--action);
    color: var(--on-action);
    font-family: var(--font-title);
    font-weight: 700;
    font-size: 14px;
  }
  .me-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .me-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .me-sub {
    font-size: 12px;
  }
  .link {
    align-self: flex-start;
    background: none;
    border: 0;
    padding: 0 0 0 46px;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
  }
  .link:hover {
    color: var(--text);
  }
  .signin {
    font-size: 14.5px;
    min-height: 40px;
  }
  .signin.icon-only {
    width: 48px;
    padding: 0;
  }
</style>

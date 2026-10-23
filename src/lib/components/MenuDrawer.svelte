<script lang="ts">
  /**
   * The phone's menu (owner, 2026-10-23: "give the sidebar drawer on the left with all the options to access every
   * page; the More page is too detailed: keep it short and clear"): a drawer from the left with every page, grouped,
   * names only (no descriptions), and the account at the top. It opens from the menu button in the header and from the
   * last tab, and closes on a tap outside, on a page change and on Escape.
   */
  import { page } from '$app/state';
  import { tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { menuOpen } from '$lib/menu';
  import Icon, { type IconName } from './Icon.svelte';
  import SocialLinks from './SocialLinks.svelte';
  import TitleBadge from './TitleBadge.svelte';
  import { session, signOut, startSignIn } from '$lib/auth';
  import { myInitials, myName, myPhoto, myTitle, photoSrc } from '$lib/stores/me';
  import { HERO_FEATURES } from '$lib/heroFeatures';
  import { NAV_GROUPS, navKey } from '$lib/nav';
  import { t, type Key } from '$lib/i18n';
  import { adminMe } from '$lib/admin';
  import { installOpen, installWay } from '$lib/install';
  import { checkClassroom, classroomShown } from '$lib/classroom/visible';
  import { PLANS_ON } from '$lib/plans';
  import Avatar from '$lib/economy/Avatar.svelte';
  import { levelOf, rankOf } from '$lib/economy/core';
  import { wallet } from '$lib/economy/wallet';
  import { boardThemeOpen } from '$lib/boardTheme';

  type Link = { href: string; name: string; icon: IconName; tag?: string; hot?: boolean };
  let isAdmin = $state(false);
  $effect(() => {
    if (!$menuOpen || $session.status !== 'in') return;
    adminMe().then(
      () => (isAdmin = true),
      () => (isAdmin = false),
    );
  });
  $effect(() => checkClassroom($session.status === 'in' ? $session.uid : undefined));

  const lvl = $derived(levelOf($wallet.xp));
  const shown = (i: { menu?: false }) => i.menu !== false;
  const nav = (href: string) => $t(navKey(href));

  /** The places to play, first: the Shop is lit (players were not using it). */
  const play = $derived<Link[]>([
    { href: '/shop', name: $t('eco.nav.shop'), icon: 'sparkle', tag: $t('nav.new'), hot: true },
    { href: '/play', name: nav('/play'), icon: 'knight' },
    { href: '/cups', name: 'Castle Cups', icon: 'trophy', tag: $t('nav.new') },
    { href: '/puzzles/racer', name: 'Puzzle Racer', icon: 'puzzle', tag: $t('nav.new') },
    { href: '/puzzles/rush', name: $t('home.rush.h'), icon: 'flame' },
    { href: '/rewards', name: $t('eco.nav.rewards'), icon: 'star' },
  ]);
  /** Every other page of the site, by name (the shared list in src/lib/nav.ts; the signature features first). */
  const learn = $derived<Link[]>([
    ...HERO_FEATURES.map((f) => ({ href: f.href, name: $t(`hero.${f.id}.short` as Key), icon: f.icon })),
    { href: '/puzzles', name: nav('/puzzles'), icon: 'puzzle' },
    { href: '/learn', name: nav('/learn'), icon: 'learn' },
    { href: '/analysis', name: nav('/analysis'), icon: 'analyse' },
    { href: '/vision', name: nav('/vision'), icon: 'eye' },
    { href: '/books', name: nav('/books'), icon: 'book' },
  ]);
  const taken = new Set(['/puzzles', '/learn', '/analysis', '/vision', '/books', '/play', '/cups', '/awards']);
  const explore = $derived<Link[]>([
    ...($classroomShown ? [{ href: '/castleclass', name: 'CastlesClass', icon: 'coach' as IconName }] : []),
    ...NAV_GROUPS.flat()
      .filter((i) => shown(i) && !taken.has(i.href))
      .map((i) => ({ href: i.href, name: nav(i.href), icon: i.icon })),
  ]);
  const me = $derived<Link[]>([
    { href: '/profile', name: $t('shell.profile'), icon: 'users' },
    { href: '/games', name: nav('/games'), icon: 'history' },
    { href: '/friends', name: nav('/friends'), icon: 'users' },
    { href: '/awards', name: nav('/awards'), icon: 'trophy' },
    { href: '/settings', name: $t('shell.settings'), icon: 'settings' },
    ...(PLANS_ON ? [{ href: '/plans', name: 'Plans', icon: 'crown' as IconName }] : []),
  ]);
  const rules = $derived<Link[]>([
    { href: '/help', name: $t('shell.help'), icon: 'bulb' },
    { href: '/parents', name: $t('shell.parents'), icon: 'shield' },
    { href: '/feedback', name: $t('shell.feedback'), icon: 'send' },
    { href: '/contact', name: $t('shell.contact'), icon: 'send' },
    { href: '/legal/terms', name: $t('shell.terms'), icon: 'book' },
    { href: '/legal/privacy', name: $t('shell.privacy'), icon: 'book' },
    { href: '/legal/fair-play', name: $t('shell.fairplay'), icon: 'flag' },
    { href: '/legal/refunds', name: $t('shell.refunds'), icon: 'book' },
    { href: '/about', name: $t('menu.about'), icon: 'book' },
  ]);

  const isOn = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname === href || page.url.pathname.startsWith(href + '/'));
  const close = () => menuOpen.set(false);
  // Closes when the page changes while it is open (not on a navigation that was already under way when it opened).
  let openedOn = '';
  $effect(() => {
    if (!$menuOpen) return void (openedOn = '');
    if (!openedOn) openedOn = page.url.pathname;
    else if (page.url.pathname !== openedOn) close();
  });

  let panel: HTMLElement | undefined = $state();
  $effect(() => {
    if (typeof document === 'undefined') return;
    if (!$menuOpen) return;
    // The page behind does not scroll while the menu is open; focus moves into it.
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void tick().then(() => panel?.querySelector<HTMLElement>('a, button')?.focus());
    return () => (document.body.style.overflow = was);
  });
</script>

<svelte:window onkeydown={(e) => $menuOpen && e.key === 'Escape' && close()} />

{#snippet row(l: Link)}
  <a class="row" class:on={isOn(l.href)} class:hot={l.hot} href={l.href} aria-current={isOn(l.href) ? 'page' : undefined}>
    <span class="ic"><Icon name={l.icon} size={20} color={l.hot ? '#0b1426' : 'var(--accent)'} /></span>
    <span class="nm">{l.name}</span>
    {#if l.tag}<span class="tag">{l.tag}</span>{/if}
  </a>
{/snippet}

{#if $menuOpen}
  <div class="scrim" role="presentation" onclick={close} transition:fade={{ duration: 160 }}></div>
  <aside class="drawer" bind:this={panel} role="dialog" aria-modal="true" aria-label={$t('menu.open')} transition:fly={{ x: -360, duration: 220, opacity: 1 }}>
    <header class="top">
      {#if $session.status === 'in'}
        <a class="who" href="/profile">
          <Avatar src={$myPhoto ? photoSrc($myPhoto) : ''} text={$myInitials} size={44} frame={$wallet.equipped.frame ?? ''} level={lvl} border="2px solid var(--gold)" />
          <span class="wt"><strong><TitleBadge title={$myTitle} size={11} />{$myName}</strong><span class="sub">{$t('menu.level', { n: lvl })} · {rankOf(lvl)}</span></span>
        </a>
      {:else}
        <button class="btn primary signin" onclick={() => (close(), startSignIn())}>{$t('shell.signin')}</button>
      {/if}
      <button class="x" onclick={close} aria-label={$t('menu.close')}><Icon name="close" size={20} /></button>
    </header>

    <a class="row home" class:on={page.url.pathname === '/'} href="/"><span class="ic"><Icon name="home" size={20} color="var(--accent)" /></span><span class="nm">{$t('shell.home')}</span></a>

    <h3>{$t('menu.play')}</h3>
    {#each play as l (l.href)}{@render row(l)}{/each}
    <h3>{$t('menu.learn')}</h3>
    {#each learn as l (l.href)}{@render row(l)}{/each}
    {#if explore.length}
      <h3>{$t('menu.explore')}</h3>
      {#each explore as l (l.href)}{@render row(l)}{/each}
    {/if}
    <h3>{$t('menu.me')}</h3>
    {#each me as l (l.href)}{@render row(l)}{/each}
    <button class="row btn-row" onclick={() => (close(), boardThemeOpen.set(true))}><span class="ic"><Icon name="palette" size={20} color="var(--accent)" /></span><span class="nm">Board and pieces</span></button>
    {#if $installWay !== 'none' && $installWay !== 'installed'}
      <button class="row btn-row" onclick={() => (close(), installOpen.set(true))}><span class="ic"><Icon name="phone" size={20} color="var(--accent)" /></span><span class="nm">{$t('shell.install')}</span></button>
    {/if}
    {#if isAdmin}{@render row({ href: '/admin', name: 'Admin', icon: 'chart' })}{/if}

    <details class="rules">
      <summary>{$t('menu.rules')}</summary>
      {#each rules as l (l.href)}{@render row(l)}{/each}
    </details>

    <footer>
      {#if $session.status === 'in'}<button class="link" onclick={() => (close(), signOut())}>{$t('shell.signout')}</button>{/if}
      <SocialLinks compact />
    </footer>
  </aside>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 970;
    background: rgba(4, 8, 18, 0.62);
  }
  .drawer {
    position: fixed;
    z-index: 971;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(86vw, 330px);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: calc(10px + env(safe-area-inset-top)) 10px calc(16px + env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--card);
    border-right: 1px solid var(--border);
    box-shadow: 14px 0 40px rgba(0, 0, 0, 0.45);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 2px 10px;
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
  }
  .wt {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .wt strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
  }
  .sub {
    font-size: 12.5px;
    color: var(--muted);
    font-weight: 700;
  }
  .signin {
    flex: 1;
  }
  .x {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 12px;
    background: var(--raised);
    color: var(--text);
    cursor: pointer;
  }
  h3 {
    margin: 12px 8px 4px;
    font: 800 11.5px var(--font-body);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 46px;
    padding: 0 10px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 15.5px;
    font-weight: 700;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    width: 100%;
  }
  .row:active {
    background: var(--raised);
  }
  .row.on {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .ic {
    flex: none;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
  }
  .row.hot {
    background: linear-gradient(90deg, #f7d27a, #edb040);
    color: #0b1426;
    margin: 2px 0 4px;
  }
  .row.hot .ic {
    background: rgba(255, 255, 255, 0.4);
  }
  .nm {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag {
    flex: none;
    padding: 1px 7px;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font: 800 10.5px var(--font-body);
  }
  .rules {
    margin-top: 8px;
    border-top: 1px solid var(--border);
    padding-top: 6px;
  }
  .rules summary {
    list-style: none;
    padding: 10px 8px;
    font-weight: 800;
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
  .rules summary::-webkit-details-marker {
    display: none;
  }
  .rules summary::after {
    content: ' ▾';
  }
  footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 8px 0;
  }
  .link {
    align-self: flex-start;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }
</style>

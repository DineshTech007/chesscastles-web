<script lang="ts">
  import { myName } from '$lib/stores/me';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { PLANS_ON } from '$lib/plans';
  import { session, signOut, startSignIn } from '$lib/auth';
  import { adminMe } from '$lib/admin';
  import { HERO_FEATURES } from '$lib/heroFeatures';
  import { NAV_ITEMS, navBlurbKey, navKey } from '$lib/nav';
  import { t, type Key } from '$lib/i18n';
  import { installOpen, installWay } from '$lib/install';
  import { boardThemeOpen } from '$lib/boardTheme';
  import SocialLinks from '$lib/components/SocialLinks.svelte';
  import { checkClassroom, classroomShown } from '$lib/classroom/visible';

  let isAdmin = $state(false);
  // CastleClass: admins, coaches, and students once a coach enrols them (src/lib/classroom/visible.ts).
  $effect(() => checkClassroom($session.status === 'in' ? $session.uid : undefined));
  $effect(() => {
    if ($session.status === 'in')
      adminMe().then(
        () => (isAdmin = true),
        () => {},
      );
  });

  /** Account and policy pages; everything else comes from the shared menu list (src/lib/nav.ts). */
  const links = $derived<{ href: string; label: string; icon: IconName }[]>([
    { href: '/profile', label: $t('more.profile'), icon: 'users' },
    ...(PLANS_ON ? [{ href: '/plans', label: 'Plans: Free, Premium, Elite', icon: 'crown' as IconName }] : []),
    // Puzzle Rush: new and a must-try (owner, 2026-10-22), near the top.
    { href: '/puzzles/rush', label: `${$t('nav.new')} · ${$t('home.rush.h')}: ${$t('home.rush.sub')}`, icon: 'flame' as IconName },
    ...($classroomShown ? [{ href: '/castleclass', label: 'CastleClass: live classes with your coach', icon: 'coach' as IconName }] : []),
    { href: '/students', label: $t('more.students'), icon: 'coach' },
    ...NAV_ITEMS.map((n) => ({ href: n.href, label: `${n.badge ? `${$t('nav.new')} · ` : ''}${$t(navKey(n.href))}: ${$t(navBlurbKey(n.href))}`, icon: n.icon })),
    { href: '/parents', label: $t('more.parents'), icon: 'shield' },
    { href: '/feedback', label: $t('more.feedback'), icon: 'send' },
    { href: '/help', label: $t('more.help'), icon: 'bulb' },
    { href: '/legal/terms', label: $t('more.terms'), icon: 'book' },
    { href: '/legal/privacy', label: $t('more.privacy'), icon: 'book' },
    { href: '/legal/fair-play', label: $t('more.fair'), icon: 'flag' },
    { href: '/legal/refunds', label: $t('more.refunds'), icon: 'book' },
    { href: '/about', label: $t('more.about'), icon: 'book' },
  ]);
</script>

<svelte:head><title>More · Chess Castles</title></svelte:head>

<h1 class="display h">{$t('more.h')}</h1>
<div class="acct card">
  {#if $session.status === 'in'}
    <span><strong>{$myName}</strong><span class="label"> · {$t('more.signedin')}</span></span>
    <button class="btn" onclick={() => signOut()}>{$t('shell.signout')}</button>
  {:else if $session.status === 'out'}
    <span class="label">{$t('more.signprompt')}</span>
    <button class="btn primary" onclick={() => startSignIn()}>{$t('shell.signin')}</button>
  {/if}
</div>
<nav class="list" aria-label="Settings">
  <a href="/settings"><Icon name="settings" color="var(--accent)" /><span><strong>{$t('more.settings')}</strong></span><Icon name="chevron" color="var(--muted)" /></a>
  <button class="row-btn" onclick={() => boardThemeOpen.set(true)}><Icon name="palette" color="var(--accent)" /><span>{$t('more.board')}</span><Icon name="chevron" color="var(--muted)" /></button>
</nav>
<nav class="list only" aria-label="Signature features">
  <span class="only-h"><Icon name="sparkle" size={14} color="var(--accent)" />{$t('shell.signature')}</span>
  {#each HERO_FEATURES as f (f.id)}
    <a href={f.href}><span class="gchip"><Icon name={f.icon} size={16} color="#0b1426" /></span><span><strong>{$t(`hero.${f.id}.short` as Key)}</strong></span><Icon name="chevron" color="var(--muted)" /></a>
  {/each}
</nav>
<nav class="list" aria-label="More">
  {#if $installWay !== 'none' && $installWay !== 'installed'}
    <button class="row-btn" onclick={() => installOpen.set(true)}><Icon name="phone" color="var(--accent)" /><span>{$t('more.install')}</span><Icon name="chevron" color="var(--muted)" /></button>
  {/if}
  {#each links as l (l.href)}
    <a href={l.href}><Icon name={l.icon} color="var(--accent)" /><span>{l.label}</span><Icon name="chevron" color="var(--muted)" /></a>
  {/each}
  {#if isAdmin}<a href="/admin"><Icon name="chart" color="var(--accent)" /><span>Admin</span><Icon name="chevron" color="var(--muted)" /></a>{/if}
</nav>
<SocialLinks />

<style>
  .h {
    font-size: 38px;
    margin: 8px 0 16px;
  }
  .acct {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .only {
    margin-bottom: 14px;
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, var(--card)), var(--card));
  }
  .only-h {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px 4px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .gchip {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #f7d27a, #edb040 50%, #c98a1b);
  }
  .list {
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-card);
    overflow: hidden;
  }
  a,
  .row-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 0 16px;
    color: var(--text);
    font-weight: 600;
    text-decoration: none;
    border-bottom: 1px solid var(--border-soft);
  }
  .row-btn {
    width: 100%;
    border-top: 0;
    border-left: 0;
    border-right: 0;
    background: none;
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  a:last-child {
    border-bottom: 0;
  }
  a span,
  .row-btn span {
    flex: 1;
  }
</style>

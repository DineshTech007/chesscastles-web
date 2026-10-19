<script lang="ts">
  import { myName } from '$lib/stores/me';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { PLANS_ON } from '$lib/plans';
  import { session, signOut, startSignIn } from '$lib/auth';
  import { adminMe } from '$lib/admin';
  import { HERO_FEATURES } from '$lib/heroFeatures';
  import { installOpen, installWay } from '$lib/install';

  let isAdmin = $state(false);
  $effect(() => {
    if ($session.status === 'in')
      adminMe().then(
        () => (isAdmin = true),
        () => {},
      );
  });

  const links: { href: string; label: string; icon: IconName }[] = [
    { href: '/profile', label: 'Profile, photo and CC Rating', icon: 'users' },
    { href: '/settings', label: 'Settings: premoves, auto-queen, sound, board colour', icon: 'settings' },
    ...(PLANS_ON ? [{ href: '/plans', label: 'Plans: Free, Premium, Elite', icon: 'crown' as IconName }] : []),
    { href: '/students', label: 'My students (coach tools)', icon: 'coach' },
    { href: '/friends', label: 'Friends and messages', icon: 'users' },
    { href: '/games', label: 'My games', icon: 'history' },
    { href: '/watch', label: 'Watch', icon: 'watch' },
    { href: '/vision', label: 'Vision Gym: blindfold training', icon: 'eye' },
    { href: '/learn', label: 'Learn', icon: 'learn' },
    { href: '/books', label: 'Books: read and listen to chess classics', icon: 'book' },
    { href: '/leaderboard', label: 'Leaderboard', icon: 'star' },
    { href: '/ratings', label: 'Ratings', icon: 'trophy' },
    { href: '/community', label: 'Community: tournaments and coaches', icon: 'globe' },
    { href: '/parents', label: 'For parents: safety, prices, getting started', icon: 'shield' },
    { href: '/feedback', label: 'Send feedback', icon: 'send' },
    { href: '/help', label: 'Help & support', icon: 'bulb' },
    { href: '/legal/terms', label: 'Terms of use', icon: 'book' },
    { href: '/legal/privacy', label: 'Privacy policy', icon: 'book' },
    { href: '/legal/fair-play', label: 'Fair play policy', icon: 'flag' },
    { href: '/legal/refunds', label: 'Cancellation and refund policy', icon: 'book' },
    { href: '/about', label: 'About and licences', icon: 'book' },
  ];
</script>

<svelte:head><title>More · Chess Castles</title></svelte:head>

<h1 class="display h">More</h1>
<div class="acct card">
  {#if $session.status === 'in'}
    <span><strong>{$myName}</strong><span class="label"> · signed in</span></span>
    <button class="btn" onclick={() => signOut()}>Sign out</button>
  {:else if $session.status === 'out'}
    <span class="label">Sign in to keep your progress with your Chess Castles account.</span>
    <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
  {/if}
</div>
<nav class="list only" aria-label="Signature features">
  <span class="only-h"><Icon name="sparkle" size={14} color="var(--accent)" />Signature features</span>
  {#each HERO_FEATURES as f (f.id)}
    <a href={f.href}><span class="gchip"><Icon name={f.icon} size={16} color="#0b1426" /></span><span><strong>{f.short}</strong></span><Icon name="chevron" color="var(--muted)" /></a>
  {/each}
</nav>
<nav class="list" aria-label="More">
  {#if $installWay !== 'none' && $installWay !== 'installed'}
    <button class="row-btn" onclick={() => installOpen.set(true)}><Icon name="phone" color="var(--accent)" /><span>Install the Chess Castles app (free, always up to date)</span><Icon name="chevron" color="var(--muted)" /></button>
  {/if}
  {#each links as l (l.href)}
    <a href={l.href}><Icon name={l.icon} color="var(--accent)" /><span>{l.label}</span><Icon name="chevron" color="var(--muted)" /></a>
  {/each}
  {#if isAdmin}<a href="/admin"><Icon name="chart" color="var(--accent)" /><span>Admin</span><Icon name="chevron" color="var(--muted)" /></a>{/if}
</nav>

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

<script lang="ts">
  /**
   * The home page's "Explore": the main places of the site as icons, like an app's home screen (a name each, no
   * descriptions). Everything else is on the More page.
   */
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { t, type Key } from '$lib/i18n';
  import { socialBadge } from '$lib/social';

  const ITEMS: { href: string; key: Key; icon: IconName }[] = [
    { href: '/learn', key: 'nav.learn', icon: 'learn' },
    { href: '/learn/masters', key: 'home.ex.masters', icon: 'crown' },
    { href: '/learn/openings', key: 'home.ex.openings', icon: 'tree' },
    { href: '/play/tournament', key: 'home.ex.tournaments', icon: 'trophy' },
    { href: '/friends', key: 'home.ex.friends', icon: 'users' },
    { href: '/leaderboard', key: 'nav.leaderboard', icon: 'star' },
    { href: '/games', key: 'nav.games', icon: 'history' },
    { href: '/more', key: 'tab.more', icon: 'menu' },
  ];
</script>

<section class="explore" aria-labelledby="ex-h">
  <h2 id="ex-h" class="sec-h">{$t('home.explore.h')}</h2>
  <div class="grid">
    {#each ITEMS as it (it.href)}
      <a href={it.href}>
        <span class="ic">
          <Icon name={it.icon} size={22} />
          {#if it.href === '/friends' && $socialBadge}<span class="badge">{$socialBadge}</span>{/if}
        </span>
        <span class="lb">{#if it.href === '/more'}<span class="sr-only">All pages: </span>{/if}{$t(it.key)}</span>
      </a>
    {/each}
  </div>
</section>

<style>
  .explore {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px 6px;
  }
  .grid a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--text);
    text-decoration: none;
    text-align: center;
  }
  .ic {
    position: relative;
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 17px;
    border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--border));
    background:
      radial-gradient(100% 100% at 30% 0%, color-mix(in srgb, var(--gold) 22%, transparent), transparent 70%),
      var(--card);
    color: var(--gold);
    transition: transform 0.12s, border-color 0.15s;
  }
  .grid a:hover .ic {
    border-color: var(--gold);
    transform: translateY(-2px);
  }
  .lb {
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-2);
  }
  .badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 10px;
    background: var(--loss);
    color: #fff;
    font-size: 11.5px;
    font-weight: 800;
    line-height: 20px;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
  }
</style>

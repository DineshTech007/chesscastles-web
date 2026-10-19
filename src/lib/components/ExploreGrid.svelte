<script lang="ts">
  /** Home page: everything outside the five signature features, in its own block (the same list as the menu, src/lib/nav.ts). */
  import { NAV_ITEMS } from '$lib/nav';
  import { socialBadge } from '$lib/social';
  import Icon from './Icon.svelte';
</script>

<section class="explore" aria-labelledby="explore-h">
  <h2 id="explore-h" class="label eh"><Icon name="globe" size={14} color="var(--accent)" /> More to explore, all free</h2>
  <div class="grid">
    {#each NAV_ITEMS as n (n.href)}
      <a class="tile card" href={n.href}>
        <span class="ic"><Icon name={n.icon} size={20} color="var(--accent)" /></span>
        <span class="tt">
          <strong>{n.label}{#if n.badge}<span class="newtag">{n.badge}</span>{/if}{#if n.href === '/friends' && $socialBadge}<span class="nbadge">{$socialBadge}</span>{/if}</strong>
          <span class="label">{n.blurb}</span>
        </span>
      </a>
    {/each}
  </div>
</section>

<style>
  .explore {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .eh {
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
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px;
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    color: var(--text);
    text-decoration: none;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .tile:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    text-decoration: none;
  }
  .ic {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .tt {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .tt strong {
    font-size: 15px;
  }
  .tt .label {
    font-size: 12.5px;
    line-height: 1.3;
  }
  .newtag {
    margin-left: 8px;
    padding: 1px 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f7d27a, #edb040 55%, #c98a1b);
    color: #0b1426;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    vertical-align: middle;
  }
  .nbadge {
    margin-left: 6px;
    min-width: 18px;
    padding: 0 6px;
    border-radius: 9px;
    background: var(--loss);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
  }
</style>

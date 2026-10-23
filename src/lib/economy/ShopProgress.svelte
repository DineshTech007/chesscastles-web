<script lang="ts">
  /**
   * The home page's Castle Shop progress (owner, 2026-10-23): how much of the Shop the player has collected, the next
   * thing to save for and how far off it is, and the invite link (3 gems for each friend or parent who joins). Only the
   * player's own numbers: nobody sees another player's gold or gems except admins.
   */
  import { t } from '$lib/i18n';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import ItemArt from './ItemArt.svelte';
  import InviteGems from './InviteGems.svelte';
  import { ITEMS, owns, priceOf } from './core';
  import { today, wallet } from './wallet';
  import { fmt } from './ui';
  import { myPhoto, photoSrc, myName } from '$lib/stores/me';

  // Items collected (the Shop's own count: Streak Shields are not collected), and the next goal.
  const collectable = ITEMS.filter((i) => i.slot !== 'shield');
  const have = $derived(collectable.filter((i) => owns($wallet, i.id)).length);
  const pct = $derived(Math.round((have / collectable.length) * 100));
  const day = today();
  /** The cheapest thing still to buy in gold, else in gems (Royal items are won, never bought). */
  const goal = $derived.by(() => {
    const left = collectable.filter((i) => !owns($wallet, i.id) && i.rarity !== 'royal');
    const priced = left.flatMap((i) => {
      const p = priceOf(i, day);
      return p ? [{ item: i, p }] : [];
    });
    const by = (c: 'gold' | 'gems') => priced.filter((x) => x.p.currency === c).sort((a, b) => a.p.amount - b.p.amount)[0];
    return by('gold') ?? by('gems');
  });
  const have$ = $derived(goal ? (goal.p.currency === 'gold' ? $wallet.gold : $wallet.gems) : 0);
  const missing = $derived(goal ? Math.max(0, goal.p.amount - have$) : 0);
  const reach = $derived(goal ? Math.min(100, Math.round((have$ / goal.p.amount) * 100)) : 100);
</script>

<section class="tb" aria-labelledby="tb-h">
  <a class="shop" href="/shop">
    <div class="s-h"><h2 id="tb-h" class="title">{$t('eco.shopp.h')}</h2><span class="s-own">{$t('eco.shopp.own', { n: have, total: collectable.length })}</span></div>
    <span class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><span style="width: {pct}%"></span></span>
    {#if goal}
      <div class="goal">
        <span class="g-art"><ItemArt id={goal.item.id} photo={$myPhoto ? photoSrc($myPhoto) : '/avatars/knight.webp'} name={$myName || 'Your Name'} /></span>
        <span class="g-text">
          <span class="g-k">{$t('eco.shopp.next', { name: goal.item.name })}</span>
          <span class="bar small" aria-hidden="true"><span style="width: {reach}%"></span></span>
          <span class="g-n">
            {#if missing === 0}{$t('eco.shopp.now')}{:else}{#if goal.p.currency === 'gold'}<Coin size={13} />{:else}<Gem size={12} />{/if}{$t('eco.shopp.go', { n: fmt.format(missing) })}{/if}
          </span>
        </span>
      </div>
    {:else}
      <p class="all">{$t('eco.shopp.all')}</p>
    {/if}
  </a>
  <InviteGems />
</section>

<style>
  .tb {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--border));
    background:
      radial-gradient(80% 60% at 0% 0%, rgba(237, 176, 64, 0.13), transparent 60%),
      radial-gradient(70% 60% at 100% 100%, rgba(143, 230, 245, 0.1), transparent 60%),
      var(--card);
  }
  .shop {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--raised) 70%, transparent);
    color: var(--text);
    text-decoration: none;
  }
  .shop:hover {
    border-color: var(--gold);
    text-decoration: none;
  }
  .s-h {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  h2 {
    margin: 0;
    font-size: 17px;
  }
  .s-own {
    font-size: 13px;
    color: var(--muted);
    font-weight: 700;
  }
  .bar {
    display: block;
    height: 9px;
    border-radius: 999px;
    background: var(--bg);
    overflow: hidden;
  }
  .bar.small {
    height: 6px;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f7d27a, #edb040);
    transition: width 0.6s ease;
  }
  .goal {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .g-art {
    flex: none;
    width: 64px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }
  .g-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .g-k {
    font-weight: 800;
    font-size: 14px;
  }
  .g-n {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--text-2);
    font-weight: 700;
  }
  .all {
    margin: 0;
    font-weight: 700;
  }
</style>

<script lang="ts">
  /**
   * The home page's "Richest castles" (owner, 2026-10-23: "a leaderboard of gems and coins on the home page, along
   * with the progress of the Castle Shop"): the top five by gold earned (all time) or gems held, the player's own
   * place, and how much of the Shop they have collected with the next thing to save for.
   */
  import { t } from '$lib/i18n';
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import { loadBoard, type Row } from '$lib/leaderboards';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import ItemArt from './ItemArt.svelte';
  import { ITEMS, owns, priceOf } from './core';
  import { today, wallet } from './wallet';
  import { fmt } from './ui';
  import { myPhoto, photoSrc, myName } from '$lib/stores/me';

  let kind = $state<'gold' | 'gems'>('gold');
  let rows = $state<Row[] | undefined>();
  $effect(() => {
    const k = kind;
    rows = undefined;
    loadBoard(k).then(
      (r) => {
        if (kind === k) rows = r;
      },
      () => (rows = []),
    );
  });
  const top = $derived((rows ?? []).slice(0, 5));
  const myIndex = $derived((rows ?? []).findIndex((r) => r.me));
  const medal = ['🥇', '🥈', '🥉', '4', '5'];

  // The Shop's progress: items collected (the Shop's own count: Streak Shields are not collected), and the next goal.
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
  const missing = $derived(goal ? Math.max(0, goal.p.amount - (goal.p.currency === 'gold' ? $wallet.gold : $wallet.gems)) : 0);
  const reach = $derived(goal ? Math.min(100, Math.round(((goal.p.currency === 'gold' ? $wallet.gold : $wallet.gems) / goal.p.amount) * 100)) : 100);
</script>

<section class="tb" aria-labelledby="tb-h">
  <div class="head">
    <h2 id="tb-h" class="title">{$t('eco.board.h')}</h2>
    <div class="tabs" role="tablist" aria-label={$t('eco.board.h')}>
      <button role="tab" aria-selected={kind === 'gold'} class:on={kind === 'gold'} onclick={() => (kind = 'gold')}><Coin size={15} />{$t('eco.board.gold')}</button>
      <button role="tab" aria-selected={kind === 'gems'} class:on={kind === 'gems'} onclick={() => (kind = 'gems')}><Gem size={14} />{$t('eco.board.gems')}</button>
    </div>
  </div>

  {#if !rows}
    {#each [0, 1, 2, 3, 4] as i (i)}<div class="line skel"></div>{/each}
  {:else if !rows.length}
    <p class="empty">{$t('eco.board.empty')}</p>
  {:else}
    <ol>
      {#each top as r, i (r.key)}
        <li class:me={r.me}>
          <span class="m">{medal[i]}</span>
          {#if r.uid}<a class="n" href="/players/{encodeURIComponent(r.uid)}"><TitleBadge title={r.ccTitle} size={11} />{r.name}</a>{:else}<span class="n">{r.name}</span>{/if}
          <strong class="v num">{#if kind === 'gold'}<Coin size={14} />{:else}<Gem size={13} />{/if}{fmt.format(r.value)}</strong>
        </li>
      {/each}
    </ol>
    <p class="mine">
      {#if myIndex >= 0}{$t('eco.board.rank', { n: myIndex + 1 })}{:else}{$t('eco.board.unranked')}{/if}
    </p>
  {/if}
  <a class="more" href="/leaderboard#{kind}">{$t('eco.board.full')} →</a>

  <a class="shop" href="/shop">
    <div class="s-h"><strong>{$t('eco.shopp.h')}</strong><span class="s-own">{$t('eco.shopp.own', { n: have, total: collectable.length })}</span></div>
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
</section>

<style>
  .tb {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 18px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--border));
    background:
      radial-gradient(80% 60% at 0% 0%, rgba(237, 176, 64, 0.13), transparent 60%),
      radial-gradient(70% 60% at 100% 100%, rgba(143, 230, 245, 0.1), transparent 60%),
      var(--card);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  h2 {
    margin: 0;
    font-size: 19px;
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--muted);
    border-radius: 999px;
    padding: 5px 11px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--action);
    color: var(--on-action);
    border-color: transparent;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px;
    border-radius: 10px;
  }
  li.me {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
  }
  .m {
    width: 24px;
    text-align: center;
    font-weight: 800;
    color: var(--muted);
  }
  .n {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
    font-weight: 700;
    text-decoration: none;
  }
  .v {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
  }
  .line.skel {
    height: 30px;
    border-radius: 10px;
    background: var(--raised);
    opacity: 0.6;
  }
  .empty,
  .mine {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .more {
    font-size: 13px;
    font-weight: 700;
    align-self: flex-start;
  }
  .shop {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
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

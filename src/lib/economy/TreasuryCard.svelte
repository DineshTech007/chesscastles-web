<script lang="ts">
  /**
   * The home page's Treasury card: level and XP, the streak, today's reward (a tap to claim), today's quests, and a
   * look at today's Shop deal. What to do next, and what it pays, in one place.
   */
  import { t } from '$lib/i18n';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import ItemArt from './ItemArt.svelte';
  import QuestList from './QuestList.svelte';
  import { ITEM, canClaim, dealsFor, levelOf, liveStreak, priceOf, rankOf, xpFor } from './core';
  import { today, wallet } from './wallet';
  import { dailyOpen, fmt } from './ui';
  import { myPhoto, photoSrc, myName } from '$lib/stores/me';

  const day = today();
  const level = $derived(levelOf($wallet.xp));
  const pct = $derived(Math.min(100, ((($wallet.xp - xpFor(level)) / (xpFor(level + 1) - xpFor(level))) * 100) || 0));
  const can = $derived(canClaim($wallet, day));
  const streak = $derived(can ? liveStreak($wallet, day) : $wallet.login.streak);
  const deal = ITEM[dealsFor(day)[0]];
  const dealPrice = priceOf(deal, day);
</script>

<section class="tc" aria-labelledby="tc-h">
  <div class="head">
    <div class="lv" aria-hidden="true"><span>{level}</span></div>
    <div class="who">
      <h2 id="tc-h" class="title">{$t('eco.home.h')}</h2>
      <span class="rank">{$t('eco.level', { n: level })} · {rankOf(level)}</span>
      <span class="xp"><span style="width: {pct}%"></span></span>
    </div>
    <a class="streak" class:off={!streak} href="/rewards" title={$t('eco.best', { n: $wallet.login.best })}>
      <span class="fl" aria-hidden="true">🔥</span><span class="sn">{streak}</span>
    </a>
  </div>

  {#if can}
    <button class="claim" onclick={() => dailyOpen.set(true)}>
      <span class="gift" aria-hidden="true">🎁</span>
      <span class="ct"><strong>{$t('eco.daily.ready')}</strong><span>{$t('eco.daily.tap')}</span></span>
      <span class="go" aria-hidden="true">→</span>
    </button>
  {/if}

  <div class="q">
    <div class="q-h"><h3>{$t('eco.quests.h')}</h3><a href="/rewards">{$t('home.seeall')}</a></div>
    <QuestList compact />
  </div>

  <a class="deal" href="/shop">
    <span class="d-art"><ItemArt id={deal.id} photo={$myPhoto ? photoSrc($myPhoto) : '/avatars/knight.webp'} name={$myName || 'Your Name'} /></span>
    <span class="d-text">
      <span class="d-k">🔥 {$t('eco.shop.deals')} · −25%</span>
      <strong>{deal.name}</strong>
      {#if dealPrice}<span class="d-p">{#if dealPrice.currency === 'gold'}<Coin size={15} />{:else}<Gem size={14} />{/if}{fmt.format(dealPrice.amount)} <s>{fmt.format(dealPrice.was ?? 0)}</s></span>{/if}
    </span>
    <span class="d-go">{$t('eco.home.shop')} →</span>
  </a>
</section>

<style>
  .tc {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--gold) 35%, var(--border));
    background:
      radial-gradient(90% 60% at 100% 0%, rgba(124, 92, 240, 0.16), transparent 60%),
      radial-gradient(70% 60% at 0% 0%, rgba(237, 176, 64, 0.14), transparent 60%),
      var(--card);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .lv {
    width: 52px;
    height: 60px;
    flex: none;
    display: grid;
    place-items: center;
    clip-path: polygon(50% 0, 100% 14%, 100% 58%, 50% 100%, 0 58%, 0 14%);
    background: linear-gradient(180deg, #f7d27a, #c98a1b);
  }
  .lv span {
    width: 44px;
    height: 52px;
    display: grid;
    place-items: center;
    clip-path: polygon(50% 0, 100% 14%, 100% 58%, 50% 100%, 0 58%, 0 14%);
    background: linear-gradient(180deg, #2b4da8, #142559);
    color: #fff;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 24px;
    padding-bottom: 4px;
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .who h2 {
    font-size: 21px;
  }
  .rank {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  .xp {
    height: 8px;
    border-radius: 999px;
    background: var(--bg);
    overflow: hidden;
    margin-top: 3px;
  }
  .xp span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f7d27a, #edb040);
  }
  .streak {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 60px;
    flex: none;
    border-radius: 16px;
    background: linear-gradient(180deg, color-mix(in srgb, #f97316 30%, var(--raised)), var(--raised));
    border: 1px solid color-mix(in srgb, #f97316 45%, var(--border));
    text-decoration: none;
    color: var(--text);
  }
  .streak:hover {
    text-decoration: none;
  }
  .streak.off {
    filter: grayscale(1);
    opacity: 0.7;
  }
  .fl {
    font-size: 22px;
    line-height: 1;
  }
  .sn {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 20px;
    line-height: 1.1;
  }
  .claim {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid var(--gold);
    background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 26%, var(--raised)), var(--raised));
    color: var(--text);
    text-align: left;
    cursor: pointer;
    animation: glow 2.2s ease-in-out infinite;
  }
  @keyframes glow {
    50% {
      box-shadow: 0 0 22px color-mix(in srgb, var(--gold) 45%, transparent);
    }
  }
  .gift {
    font-size: 30px;
  }
  .ct {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 13.5px;
    color: var(--text-2);
  }
  .ct strong {
    color: var(--text);
    font-size: 16px;
  }
  .go {
    font-size: 20px;
    font-weight: 800;
    color: var(--gold);
  }
  .q-h {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .q-h h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
  }
  .q-h a {
    font-size: 13px;
    font-weight: 700;
    color: var(--gold);
  }
  .deal {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    text-decoration: none;
  }
  .deal:hover {
    border-color: var(--gold);
    text-decoration: none;
  }
  .d-art {
    width: 64px;
    flex: none;
    border-radius: 12px;
    overflow: hidden;
  }
  .d-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .d-k {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #f87171;
  }
  .d-text strong {
    font-family: var(--font-title);
    font-size: 16.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .d-p {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 800;
    font-size: 14px;
  }
  .d-p s {
    color: var(--muted);
    font-weight: 600;
    font-size: 12px;
  }
  .d-go {
    font-size: 13px;
    font-weight: 800;
    color: var(--gold);
    white-space: nowrap;
  }
  @container (max-width: 360px) {
    .d-go {
      display: none;
    }
  }
</style>

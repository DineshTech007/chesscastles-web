<script lang="ts">
  /**
   * The Treasury in the top corner (owner, 2026-10-23: "gems and gold in the corner, for every user"): gold and gems
   * (counting up when they change), the level, and a gift that glows while today's reward waits. A tap opens Rewards.
   */
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import { canClaim, levelOf } from './core';
  import { today, wallet, walletMode } from './wallet';
  import { dailyOpen } from './ui';
  import { t } from '$lib/i18n';

  let { compact = false }: { compact?: boolean } = $props();
  const gold = tweened(0, { duration: 900, easing: cubicOut });
  const gems = tweened(0, { duration: 900, easing: cubicOut });
  /** "+15" under the chip each time it grows (owner, 2026-10-23: a reward should be seen being added to the total). */
  let deltas = $state<{ id: number; gold: number; gems: number }[]>([]);
  let deltaId = 0;
  let last: { gold: number; gems: number } | undefined;
  let bumpGold = $state(false);
  let bumpGems = $state(false);
  let first = true;
  $effect(() => {
    const w = $wallet;
    if (first) {
      gold.set(w.gold, { duration: 0 });
      gems.set(w.gems, { duration: 0 });
      first = false;
      last = { gold: w.gold, gems: w.gems };
      return;
    }
    // Shown only for a gain on the same account's treasury (not the swap from a visitor's to the account's at sign-in).
    const dg = last ? w.gold - last.gold : 0;
    const dm = last ? w.gems - last.gems : 0;
    last = { gold: w.gold, gems: w.gems };
    if ($walletMode !== 'loading' && (dg > 0 || dm > 0) && dg < 100_000) {
      const id = ++deltaId;
      deltas = [...deltas, { id, gold: Math.max(0, dg), gems: Math.max(0, dm) }].slice(-4);
      setTimeout(() => (deltas = deltas.filter((d) => d.id !== id)), 2000);
    }
    if (w.gold > $gold) flash('gold');
    if (w.gems > $gems) flash('gems');
    gold.set(w.gold);
    gems.set(w.gems);
  });
  function flash(which: 'gold' | 'gems') {
    if (which === 'gold') {
      bumpGold = false;
      requestAnimationFrame(() => (bumpGold = true));
    } else {
      bumpGems = false;
      requestAnimationFrame(() => (bumpGems = true));
    }
  }
  const fmt = new Intl.NumberFormat('en-IN');
  const short = (n: number) => (n >= 100_000 ? `${Math.floor(n / 1000)}k` : n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt.format(n));
  const show = (n: number) => (compact ? short(Math.round(n)) : fmt.format(Math.round(n)));
  const claimable = $derived($walletMode !== 'loading' && canClaim($wallet, today()));
  const level = $derived(levelOf($wallet.xp));
</script>

<div class="wallet" class:compact data-wallet>
  <span class="deltas" aria-hidden="true">
    {#each deltas as d (d.id)}
      <span class="d">{#if d.gold}<span class="dg">+{fmt.format(d.gold)} 🪙</span>{/if}{#if d.gems}<span class="dm">+{fmt.format(d.gems)} 💎</span>{/if}</span>
    {/each}
  </span>
  {#if claimable && !compact}
    <button class="gift" onclick={() => dailyOpen.set(true)} title={$t('eco.daily.ready')} aria-label={$t('eco.daily.ready')}>
      <span class="gift-ico" aria-hidden="true">🎁</span>
      <span class="dot" aria-hidden="true"></span>
    </button>
  {/if}
  <a class="pill" href="/rewards" onclick={(e) => compact && claimable && (e.preventDefault(), dailyOpen.set(true))} title="{$t('eco.wallet')} · {$t('eco.level', { n: level })}" aria-label="{$t('eco.wallet')}: {fmt.format($wallet.gold)} {$t('eco.gold')}, {fmt.format($wallet.gems)} {$t('eco.gems')}">
    {#if !compact}<span class="lvl" aria-hidden="true">{level}</span>{/if}
    <span class="amt" class:bump={bumpGold} data-coin-target onanimationend={() => (bumpGold = false)}>
      <Coin size={compact ? 18 : 20} />
      <span class="num">{show($gold)}</span>
    </span>
    <span class="sep" aria-hidden="true"></span>
    <span class="amt gems" class:bump={bumpGems} data-gem-target onanimationend={() => (bumpGems = false)}>
      <Gem size={compact ? 17 : 19} />
      <span class="num">{show($gems)}</span>
    </span>
    {#if !compact}<span class="plus" aria-hidden="true">+</span>{/if}
    {#if compact && claimable}<span class="dot pdot" aria-hidden="true"></span>{/if}
  </a>
</div>

<style>
  .deltas {
    position: absolute;
    top: calc(100% + 2px);
    right: 0;
    z-index: 901;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    pointer-events: none;
  }
  .d {
    display: inline-flex;
    gap: 8px;
    padding: 2px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--card) 92%, #000);
    border: 1px solid color-mix(in srgb, var(--gold) 55%, var(--border));
    font: 800 14px var(--font-title);
    font-variant-numeric: tabular-nums;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    animation: drop 1.9s ease-out forwards;
  }
  .dg {
    color: #ffd76a;
  }
  .dm {
    color: #8fe6f5;
  }
  :global(:root[data-theme='light']) .dg {
    color: #8a5a12;
  }
  :global(:root[data-theme='light']) .dm {
    color: #0e6b85;
  }
  @keyframes drop {
    0% {
      opacity: 0;
      transform: translateY(-10px) scale(0.8);
    }
    14% {
      opacity: 1;
      transform: translateY(0) scale(1.12);
    }
    24% {
      transform: scale(1);
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(14px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .d {
      animation: none;
    }
  }
  .wallet {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }
  .pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 6px 0 6px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--gold) 38%, var(--border));
    background: linear-gradient(180deg, color-mix(in srgb, var(--raised) 85%, #000), var(--card));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 4px 14px rgba(0, 0, 0, 0.22);
    color: var(--text);
    text-decoration: none;
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 16px;
    transition:
      border-color 0.15s,
      transform 0.1s;
  }
  :global(:root[data-theme='light']) .pill {
    background: linear-gradient(180deg, #ffffff, #f7f1e4);
    box-shadow:
      inset 0 1px 0 #fff,
      0 4px 14px rgba(13, 24, 48, 0.1);
  }
  .pill:hover {
    border-color: var(--gold);
    text-decoration: none;
  }
  .pill:active {
    transform: translateY(1px);
  }
  .lvl {
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border-radius: 9px 9px 13px 13px;
    background: linear-gradient(180deg, #2b4da8, #182d6b);
    border: 1.5px solid #edb040;
    color: #fff;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .amt {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 2px;
  }
  .num {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    min-width: 2ch;
  }
  .amt .num {
    color: #ffd76a;
  }
  .amt.gems .num {
    color: #8fe6f5;
  }
  :global(:root[data-theme='light']) .amt .num {
    color: #8a5a12;
  }
  :global(:root[data-theme='light']) .amt.gems .num {
    color: #0e6b85;
  }
  .sep {
    width: 1px;
    height: 20px;
    background: var(--border);
  }
  .plus {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(180deg, #4ade80, #16a34a);
    color: #05230f;
    font-size: 18px;
    line-height: 1;
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
  }
  .bump {
    animation: bump 0.55s cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  @keyframes bump {
    40% {
      transform: scale(1.22);
    }
  }
  .gift {
    position: relative;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--gold) 55%, var(--border));
    background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--gold) 30%, transparent), var(--card) 70%);
    cursor: pointer;
    animation: giftglow 2s ease-in-out infinite;
  }
  .gift-ico {
    font-size: 22px;
    line-height: 1;
    animation: wiggle 2.6s ease-in-out infinite;
  }
  .dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 0 2px var(--bg);
  }
  @keyframes giftglow {
    50% {
      box-shadow: 0 0 18px color-mix(in srgb, var(--gold) 55%, transparent);
    }
  }
  @keyframes wiggle {
    0%,
    70%,
    100% {
      transform: rotate(0);
    }
    76% {
      transform: rotate(-12deg);
    }
    84% {
      transform: rotate(10deg);
    }
    92% {
      transform: rotate(-6deg);
    }
  }
  .pdot {
    top: -2px;
    right: -2px;
    width: 11px;
    height: 11px;
    animation: giftglow 1.6s ease-in-out infinite;
  }
  .compact .pill {
    height: 38px;
    gap: 5px;
    padding: 0 10px 0 7px;
    font-size: 14.5px;
  }
  .compact .gift {
    width: 38px;
    height: 38px;
    border-radius: 12px;
  }
  .compact .gift-ico {
    font-size: 19px;
  }
  .compact .sep {
    height: 16px;
  }
</style>

<script lang="ts">
  /**
   * The Castle Shop, lit up on Home (owner, 2026-10-23: "people are not using the Shop, highlight it"): a short banner with
   * what the player has, a few things to win, and one big button. Short on a phone.
   */
  import { t } from '$lib/i18n';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import ItemArt from './ItemArt.svelte';
  import { wallet } from './wallet';
  import { fmt } from './ui';

  const SHOW = ['hoard', 'aurora', 'g-sheru', 'bsiege'];
</script>

<a class="banner" href="/shop">
  <span class="arts" aria-hidden="true">
    {#each SHOW as id, i (id)}<span class="a" style="--i: {i}"><ItemArt {id} name="Champion" /></span>{/each}
  </span>
  <span class="txt">
    <strong class="display">{$t('eco.banner.h')}</strong>
    <span class="mine"><Coin size={16} /> <b class="num">{fmt.format($wallet.gold)}</b> <Gem size={15} /> <b class="num">{fmt.format($wallet.gems)}</b></span>
    <span class="cta">{$t('eco.banner.cta')} →</span>
  </span>
</a>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border-radius: 20px;
    border: 2px solid var(--gold);
    background:
      radial-gradient(70% 120% at 100% 0%, rgba(139, 92, 246, 0.3), transparent 60%),
      radial-gradient(60% 100% at 0% 100%, rgba(237, 176, 64, 0.25), transparent 60%),
      var(--card);
    color: var(--text);
    text-decoration: none;
    box-shadow: 0 10px 28px rgba(237, 176, 64, 0.18);
    animation: glow 3.2s ease-in-out infinite;
  }
  .banner:hover {
    text-decoration: none;
  }
  @keyframes glow {
    50% {
      box-shadow: 0 10px 34px rgba(237, 176, 64, 0.38);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .banner {
      animation: none;
    }
  }
  .arts {
    flex: none;
    display: grid;
    grid-template-columns: repeat(2, 44px);
    gap: 6px;
  }
  .a {
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: flex-start;
  }
  strong {
    font-size: 21px;
    line-height: 1.1;
  }
  .mine {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 15px;
  }
  .cta {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 999px;
    background: linear-gradient(180deg, #f7d27a, #edb040);
    color: #0b1426;
    font-weight: 800;
    font-size: 14px;
  }
</style>

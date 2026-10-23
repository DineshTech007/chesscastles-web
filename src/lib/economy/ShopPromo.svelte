<script lang="ts">
  /** For visitors (the landing page): the Treasury in one card, with a few things from the Shop. */
  import ItemArt from './ItemArt.svelte';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import { t } from '$lib/i18n';

  const SHOW = ['hoard', 'aurora', 'crystal', 'bsiege'];
</script>

<a class="promo" href="/shop">
  <div class="txt">
    <span class="cur" aria-hidden="true"><Coin size={26} /><Gem size={24} /></span>
    <h2 class="display">{$t('eco.promo.h')}</h2>
    <p>{$t('eco.promo.b')}</p>
    <span class="btn primary">{$t('eco.promo.cta')} →</span>
  </div>
  <div class="arts" aria-hidden="true">
    {#each SHOW as id, i (id)}<span class="a" style="--i: {i}"><ItemArt {id} name="Champion" /></span>{/each}
  </div>
</a>

<style>
  .promo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 20px;
    align-items: center;
    padding: 22px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, #8b5cf6 50%, var(--border));
    background:
      radial-gradient(70% 90% at 100% 0%, rgba(139, 92, 246, 0.28), transparent 60%),
      radial-gradient(60% 80% at 0% 100%, rgba(237, 176, 64, 0.2), transparent 60%),
      var(--card);
    color: var(--text);
    text-decoration: none;
    overflow: hidden;
  }
  .promo:hover {
    text-decoration: none;
    border-color: #8b5cf6;
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .cur {
    display: flex;
    gap: 6px;
  }
  h2 {
    font-size: clamp(28px, 3.4vw, 38px);
  }
  p {
    margin: 0;
    color: var(--text-2);
  }
  .arts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .a {
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    transform: rotate(calc((var(--i) - 1.5) * 3deg)) translateY(calc(var(--i) * 3px - 4px));
    transition: transform 0.25s cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  .promo:hover .a {
    transform: rotate(0) translateY(-4px);
  }
  @media (max-width: 700px) {
    .promo {
      grid-template-columns: 1fr;
      padding: 18px;
    }
  }
</style>

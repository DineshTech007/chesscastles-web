<script lang="ts">
  /**
   * Puzzle Rush on the home page (owner, 2026-10-21: new features kids love are shown on Home): its rocket knight,
   * the challenge in a line, the best score once there is one (else "New"), and one button. Owner, 2026-10-22: the
   * news too: the first Rush legend (no name: it is the owner) and the two new titles, with their medals.
   */
  import { t } from '$lib/i18n';
  import { BADGES, rewards } from '$lib/puzzles/rewards';
  import Medal from '$lib/puzzles/Medal.svelte';

  const NEW_TITLES = ['rush40', 'rush50'].map((id) => BADGES.find((b) => b.id === id)!).filter(Boolean);
</script>

<a class="rush card" href="/puzzles/rush">
  <span class="shine" aria-hidden="true"></span>
  <img src="/puzzles/rush-hero.webp" alt="" width="96" height="96" />
  <span class="txt">
    <span class="top">
      <strong class="display">{$t('home.rush.h')}</strong>
      {#if $rewards.rushBest}<span class="best num">{$t('home.rush.best', { n: $rewards.rushBest })}</span>{:else}<span class="new">{$t('home.rush.new')}</span>{/if}
    </span>
    <span class="sub">{$t('home.rush.sub')}</span>
    <span class="news legend">👑 {$t('home.rush.legend')}</span>
    <span class="news levels">
      <span class="medals" aria-hidden="true">{#each NEW_TITLES as b (b.id)}<Medal badge={b} size={30} />{/each}</span>
      {$t('home.rush.levels')}
    </span>
    <span class="cta">{$t('home.rush.cta')} 🚀</span>
  </span>
</a>

<style>
  .rush {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 2px solid color-mix(in srgb, var(--gold) 70%, transparent);
    background:
      radial-gradient(70% 120% at 0% 50%, color-mix(in srgb, var(--gold) 26%, transparent), transparent 70%),
      linear-gradient(135deg, #16224a, #0f1733);
    color: #eef3ff;
    text-decoration: none;
  }
  .shine {
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.14) 45%, transparent 60%);
    transform: translateX(-100%);
    animation: shine 4.5s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes shine {
    60%,
    100% {
      transform: translateX(100%);
    }
  }
  img {
    flex: none;
    width: 96px;
    height: 96px;
    object-fit: contain;
    animation: float 3s ease-in-out infinite;
  }
  @keyframes float {
    50% {
      transform: translateY(-5px) rotate(-3deg);
    }
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  strong {
    font-size: 26px;
    line-height: 1;
    color: var(--gold);
  }
  .new,
  .best {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
  }
  .new {
    background: #f43f5e;
    color: #fff;
  }
  .best {
    background: rgba(255, 255, 255, 0.12);
  }
  .sub {
    font-size: 14px;
    color: #c9d3ee;
    line-height: 1.3;
  }
  .news {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
  }
  .legend {
    align-self: flex-start;
    padding: 2px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 22%, transparent);
    color: #f7d27a;
    animation: glow 2.6s ease-in-out infinite;
  }
  @keyframes glow {
    50% {
      box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 55%, transparent);
    }
  }
  .levels {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #dfe6fb;
  }
  .medals {
    display: inline-flex;
    gap: 2px;
  }
  .cta {
    align-self: flex-start;
    margin-top: 4px;
    padding: 7px 14px;
    border-radius: 12px;
    background: var(--gold);
    color: #1b1300;
    font-weight: 800;
    font-size: 15px;
  }
  @media (prefers-reduced-motion: reduce) {
    .shine,
    img,
    .legend {
      animation: none;
    }
  }
</style>

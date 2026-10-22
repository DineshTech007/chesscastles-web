<script lang="ts">
  /**
   * Puzzle Racer on the home page (owner's rule: a new feature kids love gets a Home promo, replacing the older one
   * rather than stacking): a little road with cars racing across, the challenge in a line, one button, and Puzzle
   * Battle (new too) as a line under it.
   */
  import Car from '$lib/racer/Car.svelte';
  import { racerStats } from '$lib/racer/stats';
  import { t } from '$lib/i18n';
</script>

<div class="racer card">
  <a class="main" href="/puzzles/racer">
    <span class="top">
      <strong class="display">Puzzle Racer</strong>
      {#if $racerStats.best}<span class="best num">{$t('racer.promo.best', { n: $racerStats.best })}</span>{:else}<span class="new">{$t('racer.new')}</span>{/if}
    </span>
    <span class="sub">{$t('racer.promo.sub')}</span>
    <span class="road" aria-hidden="true">
      {#each [0, 4, 1] as c, i (c)}
        <span class="drive" style="--d: {5 + i * 1.2}s; --delay: {-i * 1.7}s; top: {4 + i * 22}px"><Car car={c} size={46} moving /></span>
      {/each}
      <span class="finish"></span>
    </span>
    <span class="cta">{$t('racer.promo.cta')}</span>
  </a>
  <a class="rushline" href="/puzzles/racer"><span class="new small">{$t('racer.new')}</span> {$t('racer.promo.battle')}</a>
</div>

<style>
  .racer {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0;
    border: 2px solid color-mix(in srgb, #38bdf8 70%, transparent);
    background:
      radial-gradient(80% 120% at 0% 0%, color-mix(in srgb, #38bdf8 28%, transparent), transparent 70%),
      linear-gradient(135deg, #16224a, #0f1733);
    color: #eef3ff;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px 10px;
    color: inherit;
    text-decoration: none;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  strong {
    font-size: 26px;
    line-height: 1;
    color: #7dd3fc;
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
    animation: bob 1.2s ease-in-out infinite;
  }
  .best {
    background: rgba(255, 255, 255, 0.12);
  }
  @keyframes bob {
    50% {
      transform: translateY(-2px);
    }
  }
  .sub {
    font-size: 14px;
    color: #c9d3ee;
    line-height: 1.3;
  }
  .road {
    position: relative;
    height: 70px;
    border-radius: 10px;
    overflow: hidden;
    background:
      repeating-linear-gradient(180deg, transparent 0 21px, rgba(255, 255, 255, 0.2) 21px 23px),
      linear-gradient(180deg, #3a3f4b, #2c313b);
    border-top: 4px solid transparent;
    border-image: repeating-linear-gradient(90deg, #e53935 0 12px, #fafafa 12px 24px) 4;
  }
  .drive {
    position: absolute;
    left: -60px;
    animation: across var(--d) linear infinite;
    animation-delay: var(--delay);
  }
  @keyframes across {
    to {
      left: calc(100% + 10px);
    }
  }
  .finish {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 24px;
    width: 9px;
    background: repeating-conic-gradient(#fff 0 25%, #111 0 50%) 0 0 / 9px 9px;
    opacity: 0.85;
  }
  .cta {
    align-self: flex-start;
    margin-top: 2px;
    padding: 7px 16px;
    border-radius: 12px;
    background: linear-gradient(135deg, #38bdf8, #6366f1);
    color: #fff;
    font-weight: 800;
    font-size: 15px;
  }
  .new.small {
    font-size: 10px;
    padding: 1px 6px;
    margin-right: 4px;
  }
  .rushline {
    padding: 8px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.18);
    color: #f7d27a;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .drive,
    .new {
      animation: none;
    }
  }
</style>

<script lang="ts">
  /**
   * The three new Chess Gurus on the home page (owner, 2026-10-23: "show little picture of new guru on home page with
   * animation"): Sheru, Coach Anjali and Coach Arjun take turns talking (their talking loops), and a tap on one makes
   * them the child's Guru. With reduced motion, the portraits only.
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import { chooseAvatar, coachAvatar, guruItem, guruOpen, type AvatarId } from '$lib/coach/avatar';
  import { wallet } from '$lib/economy/wallet';
  import { t } from '$lib/i18n';

  const NEW: { id: AvatarId; name: string }[] = [
    { id: 'sheru', name: 'Sheru' },
    { id: 'anjali', name: 'Anjali' },
    { id: 'arjun', name: 'Arjun' },
  ];
  let talking = $state(0);
  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return (talking = -1);
    const timer = setInterval(() => (talking = (talking + 1) % NEW.length), 3200);
    return () => clearInterval(timer);
  });

  function pick(id: AvatarId) {
    // A Guru not unlocked yet: the Shop, on that Guru.
    if (!guruOpen(id, $wallet.owned, $coachAvatar)) return void goto(`/shop?tab=gurus&item=${guruItem(id)}`);
    chooseAvatar(id);
    void goto('/coach');
  }
</script>

<div class="gurus card">
  <span class="top">
    <strong class="display">{$t('gurus.promo.title')}</strong>
    <span class="new">{$t('gurus.new')}</span>
  </span>
  <span class="sub">{$t('gurus.promo.sub')}</span>
  <span class="faces">
    {#each NEW as g, i (g.id)}
      <button class="face" class:on={talking === i} onclick={() => pick(g.id)} aria-label={g.name}>
        <GuruAvatar id={g.id} size={72} talking={talking === i} />
        <span class="name">{g.name}</span>
      </button>
    {/each}
  </span>
  <span class="row">
    <span class="tap">{$t('gurus.promo.tap')}</span>
    <a class="cta" href="/coach?choose=1">{$t('gurus.promo.cta')}</a>
  </span>
</div>

<style>
  .gurus {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border: 2px solid color-mix(in srgb, #edb040 70%, transparent);
    background:
      radial-gradient(80% 120% at 100% 0%, color-mix(in srgb, #edb040 22%, transparent), transparent 70%),
      linear-gradient(135deg, #16224a, #0f1733);
    color: #eef3ff;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  strong {
    font-size: 24px;
    line-height: 1.1;
    color: #f5c96a;
  }
  .new {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    background: #f43f5e;
    color: #fff;
    animation: bob 1.2s ease-in-out infinite;
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
  .faces {
    display: flex;
    justify-content: space-around;
    gap: 8px;
    padding: 8px 0 2px;
  }
  .face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 4px;
    border: none;
    border-radius: 14px;
    background: none;
    color: inherit;
    cursor: pointer;
    transition: transform 0.25s ease;
  }
  .face.on {
    transform: translateY(-3px) scale(1.06);
  }
  .face:focus-visible {
    outline: 2px solid #f5c96a;
  }
  .name {
    font-weight: 800;
    font-size: 14px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .tap {
    font-size: 12.5px;
    color: #c9d3ee;
  }
  .cta {
    padding: 7px 16px;
    border-radius: 999px;
    background: #edb040;
    color: #1a1300;
    font-weight: 800;
    text-decoration: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .new {
      animation: none;
    }
    .face {
      transition: none;
    }
  }
</style>

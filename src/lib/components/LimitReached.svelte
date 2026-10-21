<script lang="ts">
  /** Shown in place of a page whose plan limit is reached (the limit popup explains more). */
  import PlanBadge from './PlanBadge.svelte';
  import Icon from './Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { FEATURE_INFO, GUEST_LIMITS, PLAN_INFO, PLANS_ON, currentPlan, launchOn, limitText, planSettings, type Feature } from '$lib/plans';

  let { feature, back, backLabel }: { feature: Feature; back: string; backLabel: string } = $props();
  const l = $derived($planSettings.config.limits[feature][$currentPlan]);
  /** A visitor's daily tries (GUEST_LIMITS), while plans are off: signing in, free, opens everything. */
  const guest = $derived(!PLANS_ON && $session.status !== 'in');
</script>

{#if guest}
<div class="card reached">
  <img class="art" src="/art/play-256.webp" alt="" width="110" height="116" />
  <h1 class="title">You’ve played today’s {GUEST_LIMITS[feature] ?? ''} free {FEATURE_INFO[feature].many}</h1>
  <p>Sign in free to keep playing: it takes a few seconds with Google or Lichess. Your games, ratings and puzzles stay in your account, on every device, and you can play your friends.</p>
  <div class="btns">
    <button class="btn primary" onclick={() => startSignIn()}>Sign in free</button>
    <a class="btn" href={back}>{backLabel}</a>
  </div>
</div>
{:else}
<div class="card reached">
  <PlanBadge plan="premium" size={56} />
  <h1 class="title">Limit reached for {FEATURE_INFO[feature].many}</h1>
  <p>{PLAN_INFO[$currentPlan].name}{$currentPlan === 'free' ? ' (free)' : ''} includes {limitText(l).toLowerCase()}. Limits reset at midnight, India time.</p>
  <div class="btns">
    {#if $session.status !== 'in'}
      <button class="btn primary" onclick={() => startSignIn()}>
        {launchOn($planSettings.launch) ? `Sign in: ${PLAN_INFO[$planSettings.launch.plan].name} free for ${$planSettings.launch.days} days` : 'Sign in'}
      </button>
    {/if}
    <a class="btn" class:primary={$session.status === 'in'} href="/plans"><Icon name="crown" size={16} />See plans</a>
    <a class="btn" href={back}>{backLabel}</a>
  </div>
</div>
{/if}

<style>
  .art {
    width: 110px;
    height: auto;
    filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.35));
  }
  .reached {
    max-width: 520px;
    margin: 48px auto;
    padding: 28px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }
  h1 {
    margin: 0;
    font-size: 22px;
  }
  p {
    margin: 0;
    color: var(--text-2);
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 6px;
  }
  .btn {
    gap: 6px;
  }
</style>

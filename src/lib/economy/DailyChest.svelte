<script lang="ts">
  /**
   * The daily reward: a 7-day calendar (every reward shown before it is won; a missed day pauses it, never resets it),
   * the streak, and its next milestone. Opens by itself once a day on a page that is not a game, or from the gift in
   * the corner.
   */
  import { fly, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import Coin from './Coin.svelte';
  import Gem from './Gem.svelte';
  import { LADDER, MILESTONES, canClaim, ladderDay, liveStreak } from './core';
  import { claimDailyReward, today, wallet } from './wallet';
  import { dailyOpen, fmt } from './ui';
  import { t } from '$lib/i18n';
  import Icon from '$lib/components/Icon.svelte';
  import { rewardSound } from '$lib/sound';

  let claimed = $state<{ gold: number; gems: number; streak: number } | undefined>();
  let busy = $state(false);
  const day = $derived(today());
  const can = $derived(canClaim($wallet, day));
  /** The calendar's day to show: today's (before claiming) or the one just claimed. */
  const at = $derived(can ? ladderDay($wallet) : (ladderDay($wallet) + LADDER.length - 1) % LADDER.length);
  const streakNow = $derived(can ? liveStreak($wallet, day) : $wallet.login.streak);
  const next = $derived(MILESTONES.find((m) => m.days > (can ? streakNow : $wallet.login.streak)));

  async function claim() {
    if (busy) return;
    busy = true;
    const r = await claimDailyReward();
    busy = false;
    if (r.ok) {
      rewardSound('chest');
      const g = r.grants.find((x) => x.why === 'login');
      claimed = { gold: g?.gold ?? 0, gems: g?.gems ?? 0, streak: $wallet.login.streak };
    }
  }
  function close() {
    dailyOpen.set(false);
    claimed = undefined;
  }
</script>

<svelte:window onkeydown={(e) => $dailyOpen && e.key === 'Escape' && close()} />

{#if $dailyOpen}
  <div class="scrim" role="presentation" onclick={close} transition:fly={{ duration: 150, opacity: 0 }}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="daily-h" transition:scale={{ start: 0.92, duration: 260, easing: backOut }}>
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <div class="glow" aria-hidden="true"></div>
    <div class="chest" class:open={!!claimed} aria-hidden="true">
      <span class="lid">🎁</span>
      {#if claimed}<span class="burst"></span>{/if}
    </div>
    <h2 id="daily-h" class="display">{claimed ? $t('eco.daily.got') : $t('eco.daily.h')}</h2>
    {#if claimed}
      <p class="got">
        {#if claimed.gold}<span class="g"><Coin size={26} />+{fmt.format(claimed.gold)}</span>{/if}
        {#if claimed.gems}<span class="m"><Gem size={24} />+{claimed.gems}</span>{/if}
      </p>
      <p class="sub">🔥 {$t('eco.streak', { n: claimed.streak })}{#if next} · {$t('eco.nextMilestone', { n: next.days, gems: next.gems })}{/if}</p>
    {:else}
      <p class="sub">{$t('eco.daily.sub')}</p>
    {/if}

    <ol class="cal" aria-label={$t('eco.daily.h')}>
      {#each LADDER as step, i (i)}
        {@const done = can ? i < at : i <= at}
        {@const now = i === at && can}
        <li class:done class:now class:big={i === LADDER.length - 1}>
          <span class="d">{$t('eco.daily.day', { n: i + 1 })}</span>
          <span class="r">
            {#if i === LADDER.length - 1}<span class="chestico" aria-hidden="true">👑</span>{/if}
            <span class="ga"><Coin size={i === LADDER.length - 1 ? 18 : 15} />{step.gold}</span>
            {#if step.gems}<span class="ma"><Gem size={14} />{step.gems}</span>{/if}
          </span>
          {#if done}<span class="tick" aria-label="✓"><Icon name="check" size={14} /></span>{/if}
        </li>
      {/each}
    </ol>

    {#if can}
      <button class="btn primary big block claim" onclick={claim} disabled={busy}>{$t('eco.daily.claim')}</button>
      {#if $wallet.login.last && streakNow === 0 && $wallet.login.streak > 1}<p class="note">{$t('eco.daily.restart')}</p>{/if}
      {#if $wallet.shields && streakNow > 0 && $wallet.login.last && $wallet.login.last !== day}<p class="note">🛡️ {$t('eco.shields', { n: $wallet.shields, max: 2 })}</p>{/if}
    {:else}
      <p class="note">{$t('eco.daily.claimed', { n: ((at + 1) % LADDER.length) + 1 })}</p>
      <div class="row">
        <a class="btn" href="/rewards" onclick={close}>{$t('eco.quests.h')}</a>
        <a class="btn primary" href="/shop" onclick={close}>{$t('eco.home.shop')}</a>
      </div>
    {/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 800;
    background: rgba(4, 8, 20, 0.66);
    backdrop-filter: blur(3px);
  }
  .dialog {
    position: fixed;
    z-index: 801;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: min(500px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    padding: 26px 22px 22px;
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--gold) 55%, var(--border));
    background: linear-gradient(180deg, #16244a, var(--card) 60%);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
    text-align: center;
    color: var(--text);
    overflow-x: hidden;
  }
  :global(:root[data-theme='light']) .dialog {
    background: linear-gradient(180deg, #fff6e0, #fff 60%);
  }
  .glow {
    position: absolute;
    left: 50%;
    top: -120px;
    width: 340px;
    height: 340px;
    margin-left: -170px;
    background: radial-gradient(circle, color-mix(in srgb, var(--gold) 40%, transparent), transparent 65%);
    pointer-events: none;
  }
  .x {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-2);
    display: grid;
    place-items: center;
    cursor: pointer;
    z-index: 2;
  }
  .chest {
    position: relative;
    width: 96px;
    height: 96px;
    margin: 0 auto 6px;
    display: grid;
    place-items: center;
  }
  .lid {
    font-size: 72px;
    line-height: 1;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
    animation: float 2.4s ease-in-out infinite;
  }
  .chest.open .lid {
    animation: openit 0.7s cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  .burst {
    position: absolute;
    inset: -60px;
    background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--gold) 55%, transparent) 0 8deg, transparent 8deg 22deg);
    -webkit-mask: radial-gradient(circle, #000 15%, transparent 60%);
    mask: radial-gradient(circle, #000 15%, transparent 60%);
    animation: spin 8s linear infinite;
    z-index: -1;
  }
  @keyframes float {
    50% {
      transform: translateY(-6px);
    }
  }
  @keyframes openit {
    0% {
      transform: scale(0.6) rotate(-12deg);
    }
    60% {
      transform: scale(1.25) rotate(6deg);
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  h2 {
    position: relative;
    font-size: 32px;
    margin: 4px 0 4px;
  }
  .sub {
    position: relative;
    margin: 0 auto 16px;
    max-width: 380px;
    color: var(--text-2);
    font-size: 14.5px;
  }
  .got {
    display: flex;
    justify-content: center;
    gap: 18px;
    margin: 6px 0 8px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 34px;
  }
  .got span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .g {
    color: #ffd76a;
  }
  .m {
    color: #8fe6f5;
  }
  :global(:root[data-theme='light']) .g {
    color: #8a5a12;
  }
  :global(:root[data-theme='light']) .m {
    color: #0e6b85;
  }
  .cal {
    position: relative;
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .cal li {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 4px 9px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--raised);
  }
  .cal li.big {
    grid-column: span 2;
    border-color: color-mix(in srgb, var(--gold) 70%, var(--border));
    background: radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--gold) 26%, transparent), var(--raised) 70%);
  }
  .cal li.now {
    border: 2px solid var(--gold);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--gold) 20%, transparent);
    animation: nowpulse 1.6s ease-in-out infinite;
  }
  @keyframes nowpulse {
    50% {
      box-shadow: 0 0 0 7px color-mix(in srgb, var(--gold) 12%, transparent);
    }
  }
  .cal li.done {
    opacity: 0.55;
  }
  .d {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .now .d {
    color: var(--gold);
  }
  .r {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-title);
    font-weight: 800;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .r span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .chestico {
    font-size: 18px;
  }
  .tick {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--win);
    color: #fff;
  }
  .claim {
    position: relative;
    font-size: 21px;
    box-shadow: 0 5px 0 #a87412;
  }
  .claim:active {
    transform: translateY(3px);
    box-shadow: 0 2px 0 #a87412;
  }
  .note {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 13.5px;
  }
  .row {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 14px;
  }
  .row .btn {
    flex: 1;
  }
</style>

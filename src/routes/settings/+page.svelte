<script lang="ts">
  /** Game, sound and appearance settings, plus quick links to membership and help (like chess.com's Settings menu). */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PlanBadge from '$lib/components/PlanBadge.svelte';
  import { session, signOut, startSignIn } from '$lib/auth';
  import { myName } from '$lib/stores/me';
  import { setSound, soundOn } from '$lib/sound';
  import { autoQueen, premovesOn } from '$lib/preferences';
  import { boardThemeOpen } from '$lib/boardTheme';
  import { currentPlan, PLAN_INFO } from '$lib/plans';

  let theme = $state<'dark' | 'light'>('dark');
  onMount(() => (theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('k24.theme', theme);
    } catch {
      /* private mode */
    }
  }
</script>

<svelte:head>
  <title>Settings · Chess Castles</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
  <h1 class="display h">Settings</h1>

  <section class="card block" aria-labelledby="game-h">
    <h2 id="game-h" class="title">Game preferences</h2>
    <label class="row">
      <span><strong>Auto-queen promotion</strong><span class="label sub">A pawn reaching the last rank becomes a queen at once. Turn this off to be asked which piece every time.</span></span>
      <input type="checkbox" checked={$autoQueen} onchange={(e) => autoQueen.set(e.currentTarget.checked)} />
    </label>
    <label class="row">
      <span><strong>Premoves</strong><span class="label sub">Queue your next move while the opponent is still thinking.</span></span>
      <input type="checkbox" checked={$premovesOn} onchange={(e) => premovesOn.set(e.currentTarget.checked)} />
    </label>
  </section>

  <section class="card block" aria-labelledby="look-h">
    <h2 id="look-h" class="title">Sound & appearance</h2>
    <label class="row">
      <span><strong>Move sounds</strong></span>
      <input type="checkbox" checked={$soundOn} onchange={(e) => setSound(e.currentTarget.checked)} />
    </label>
    <label class="row">
      <span><strong>Light UI</strong></span>
      <input type="checkbox" checked={theme === 'light'} onchange={toggleTheme} />
    </label>
    <button class="btn row-btn" onclick={() => ($boardThemeOpen = true)}><Icon name="palette" size={18} />Board colour<Icon name="chevron" size={16} color="var(--muted)" /></button>
  </section>

  <section class="card block" aria-labelledby="mem-h">
    <h2 id="mem-h" class="title">Membership</h2>
    <a class="btn row-btn" href="/plans"><PlanBadge plan={$currentPlan} size={18} />{PLAN_INFO[$currentPlan].name} plan · compare plans<Icon name="chevron" size={16} color="var(--muted)" /></a>
  </section>

  <section class="card block" aria-labelledby="help-h">
    <h2 id="help-h" class="title">Help & support</h2>
    <a class="btn row-btn" href="/help"><Icon name="bulb" size={18} />Help & support<Icon name="chevron" size={16} color="var(--muted)" /></a>
    <a class="btn row-btn" href="/feedback"><Icon name="send" size={18} />Send feedback<Icon name="chevron" size={16} color="var(--muted)" /></a>
    <a class="btn row-btn" href="/parents"><Icon name="shield" size={18} />For parents<Icon name="chevron" size={16} color="var(--muted)" /></a>
  </section>

  <section class="card block" aria-labelledby="acct-h">
    <h2 id="acct-h" class="title">Account</h2>
    {#if $session.status === 'in'}
      <a class="btn row-btn" href="/profile"><Icon name="users" size={18} />{$myName}: profile<Icon name="chevron" size={16} color="var(--muted)" /></a>
      <button class="btn" onclick={() => signOut()}>Sign out</button>
    {:else}
      <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
    {/if}
  </section>
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .h {
    margin: 0;
  }
  .block {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .title {
    margin: 0 0 2px;
    font-size: 16px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0;
    cursor: pointer;
  }
  .row span > strong {
    display: block;
  }
  .sub {
    display: block;
    margin-top: 2px;
  }
  input[type='checkbox'] {
    flex: none;
    width: 42px;
    height: 24px;
    accent-color: var(--accent);
  }
  .row-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: flex-start;
    width: 100%;
    text-align: left;
  }
  .row-btn :global(svg:last-child) {
    margin-left: auto;
  }
</style>

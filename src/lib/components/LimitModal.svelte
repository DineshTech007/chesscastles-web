<script lang="ts">
  /** Opens when a plan's limit is reached (see useFeature in $lib/plans): what the limit is, and how to get more. */
  import PlanBadge from './PlanBadge.svelte';
  import { goto } from '$app/navigation';
  import { startSignIn } from '$lib/auth';
  import Icon from './Icon.svelte';
  import { FEATURE_INFO, GATE_INFO, PLAN_INFO, launchOn, limitHit, limitText, planSettings, upgradeFor } from '$lib/plans';

  const hit = $derived($limitHit);
  const config = $derived($planSettings.config);
  const launch = $derived($planSettings.launch);
  const better = $derived(hit ? upgradeFor(hit, config) : undefined);
  const close = () => limitHit.set(undefined);

  const nextText = (day?: string) => {
    if (!day) return '';
    const d = new Date(day + 'T00:00:00');
    const tomorrow = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
    return day === tomorrow ? 'tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  };
  const title = $derived.by(() => {
    if (!hit) return '';
    if (hit.gate) return `${GATE_INFO[hit.gate]} comes with ${PLAN_INFO[config.gates[hit.gate]].name}`;
    const f = FEATURE_INFO[hit.feature!];
    const per = hit.per === 'day' ? 'today’s' : hit.per === 'week' ? 'this week’s' : hit.per === 'month' ? 'this month’s' : 'your';
    return `You’ve used ${per} ${hit.limit === 1 ? `free ${f.one}` : `${hit.limit} free ${f.many}`}`;
  });
</script>

<svelte:window onkeydown={(e) => hit && e.key === 'Escape' && close()} />

{#if hit}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="limit-h">
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <span class="piece"><PlanBadge plan={better ?? 'rook'} size={56} /></span>
    <h2 id="limit-h" class="title">{title}</h2>
    {#if hit.feature}
      <p>
        {PLAN_INFO[hit.plan].name}{hit.plan === 'pawn' ? ' (free)' : ''} includes {limitText(config.limits[hit.feature][hit.plan]).toLowerCase()}.
        {#if hit.next}The next one is free {nextText(hit.next)}.{/if}
        {#if better}{PLAN_INFO[better].name}: {limitText(config.limits[hit.feature][better]).toLowerCase()}.{/if}
      </p>
    {/if}

    {#if hit.signedOut}
      {#if launchOn(launch)}
        <p class="offer">
          <strong>Launch offer:</strong> sign in free with Lichess and get <strong>{PLAN_INFO[launch.plan].name} free for {launch.days} days</strong>: unlimited FIDE-rated players, Game Reviews, Insights and more.
        </p>
      {:else}
        <p>Sign in free with Lichess to keep your progress and see every plan.</p>
      {/if}
      <div class="btns">
        <button class="btn primary" onclick={() => (close(), startSignIn())}>Sign in with Lichess</button>
        <button class="btn" onclick={() => (close(), goto('/plans'))}>See plans</button>
      </div>
    {:else}
      <p class="label">Paid plans open soon. Invite friends to Chess Castles and get {PLAN_INFO.bishop.name} free for a week for each friend who joins.</p>
      <div class="btns">
        <button class="btn primary" onclick={() => (close(), goto('/plans'))}><Icon name="crown" size={16} />See plans</button>
        <button class="btn" onclick={close}>Not now</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 10, 20, 0.6);
    z-index: 90;
  }
  .dialog {
    position: fixed;
    z-index: 91;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(440px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 24px 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  .x {
    position: absolute;
    top: 10px;
    right: 10px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
    padding: 6px;
  }
  .piece {
    font-size: 46px;
    line-height: 1;
    color: var(--gold);
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  p {
    margin: 0;
    color: var(--text-2);
  }
  .offer {
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--gold) 12%, transparent);
    color: var(--text);
  }
  .btns {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 6px;
  }
  .btns .btn {
    gap: 6px;
  }
</style>

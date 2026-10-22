<script lang="ts">
  /**
   * "Your cup starts soon" (Castle Cups): from 5 minutes before a cup this browser joined until 10 minutes after
   * its start, a card on every page with the countdown and Go: a child must have the cup page open to be paired.
   * No server calls: the cups joined and their times are kept in this browser (joined.ts).
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { t } from '$lib/i18n';
  import { countdown } from './api';
  import { joinedCups, type Joined } from './joined';

  let now = $state(Date.now());
  let cups = $state<Joined[]>([]);
  let shut = $state<string[]>([]);
  onMount(() => {
    try {
      shut = JSON.parse(sessionStorage.getItem('cc.cupAlertsShut') ?? '[]');
    } catch {
      shut = [];
    }
    const read = () => {
      now = Date.now();
      cups = joinedCups(now);
    };
    read();
    const tick = setInterval(read, 1000);
    return () => clearInterval(tick);
  });
  const due = $derived(cups.find((c) => c.startAt - now <= 5 * 60_000 && now - c.startAt < 10 * 60_000 && !shut.includes(c.id) && page.url.pathname !== `/cups/${c.id}`));
  function close(id: string) {
    shut = [...shut, id];
    try {
      sessionStorage.setItem('cc.cupAlertsShut', JSON.stringify(shut));
    } catch {
      /* closed for this page only */
    }
  }
</script>

{#if due}
  <div class="alert" role="alertdialog" aria-label={due.name}>
    <span class="cup" aria-hidden="true">🏆</span>
    <div class="txt">
      <strong>{due.name}</strong>
      <span>{due.startAt > now ? $t('cups.alertSoon', { time: countdown(due.startAt - now) }) : $t('cups.alertNow')}</span>
    </div>
    <a class="btn primary" href="/cups/{due.id}" onclick={() => close(due.id)}>{$t('cups.go')}</a>
    <button class="x" onclick={() => close(due.id)} aria-label={$t('kidsclass.editor.close')}>✕</button>
  </div>
{/if}

<style>
  .alert {
    position: fixed;
    left: 50%;
    bottom: calc(76px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(440px, calc(100vw - 24px));
    padding: 10px 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 26%, var(--card)), var(--card));
    border: 1px solid var(--gold);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    animation: up 0.35s ease-out;
  }
  @keyframes up {
    from {
      transform: translate(-50%, 20px);
      opacity: 0;
    }
  }
  .cup {
    font-size: 30px;
  }
  .txt {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
  }
  .x {
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 16px;
    cursor: pointer;
  }
  @media (min-width: 900px) {
    .alert {
      bottom: 24px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .alert {
      animation: none;
    }
  }
</style>

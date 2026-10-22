<script lang="ts">
  /**
   * "Your cup starts soon" and, while it's on, "back to your board" (Castle Cups): from 5 minutes before a cup this
   * browser joined until the cup is over, a card on every other page with Go. A child must have the cup page open to
   * be paired, and one who wandered off or lost the page gets back to their board in one tap (owner, 2026-10-23).
   * The cups joined and their times are kept in this browser (joined.ts); only while one of them is on, the cups list
   * is asked every 30 s (cached by the server) to know its round and when it ends.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { t } from '$lib/i18n';
  import { countdown, todayCups, type CupSummary } from './api';
  import { forgetCup, joinedCups, type Joined } from './joined';

  let now = $state(Date.now());
  let cups = $state<Joined[]>([]);
  let shut = $state<string[]>([]);
  /** What the server says of the cups joined (status, round), while one is on. */
  let live = $state<Record<string, CupSummary>>({});
  let asked = 0;
  onMount(() => {
    try {
      shut = JSON.parse(sessionStorage.getItem('cc.cupAlertsShut') ?? '[]');
    } catch {
      shut = [];
    }
    const read = () => {
      now = Date.now();
      cups = joinedCups(now);
      // A cup of mine started (or is due within 3 hours: an admin may start one early) and isn't over: what is it
      // doing? Every 30 s once it's due, every minute before.
      const on = cups.some((c) => now >= c.startAt - 3 * 3600_000 && live[c.id]?.status !== 'over');
      const every = cups.some((c) => now >= c.startAt - 60_000 || live[c.id]?.status === 'running') ? 30_000 : 60_000;
      if (on && now - asked > every && document.visibilityState === 'visible') {
        asked = now;
        todayCups().then(
          (t) => {
            const next: Record<string, CupSummary> = {};
            for (const c of t.cups) next[c.id] = c;
            live = next;
            // Over, called off, or nobody came: nothing to go back to.
            for (const c of cups) if (next[c.id] && ['over', 'cancelled', 'skipped'].includes(next[c.id].status)) forgetCup(c.id);
          },
          () => {},
        );
      }
    };
    read();
    const tick = setInterval(read, 1000);
    return () => clearInterval(tick);
  });
  /** A cup of mine about to start, or being played, that I'm not looking at. */
  const due = $derived(
    cups.find((c) => {
      if (page.url.pathname === `/cups/${c.id}`) return false;
      const s = live[c.id];
      if (s?.status === 'running') return !shut.includes(`${c.id}:${s.round}`);
      if (s && s.status !== 'open') return false;
      // Before the start: 5 minutes ahead; just after it, until the server says it's running.
      return c.startAt - now <= 5 * 60_000 && now - c.startAt < 15 * 60_000 && !shut.includes(c.id);
    }),
  );
  const round = $derived(due ? live[due.id]?.status === 'running' ? live[due.id].round : 0 : 0);
  function close(id: string) {
    // Closed for this round only: the next round brings it back.
    shut = [...shut, round ? `${id}:${round}` : id];
    try {
      sessionStorage.setItem('cc.cupAlertsShut', JSON.stringify(shut));
    } catch {
      /* closed for this page only */
    }
  }
</script>

{#if due}
  <div class="alert" class:on={round > 0} role="alertdialog" aria-label={due.name}>
    <span class="cup" aria-hidden="true">🏆</span>
    <div class="txt">
      <strong>{due.name}</strong>
      <span>{round ? $t('cups.backToCup', { n: round }) : due.startAt > now ? $t('cups.alertSoon', { time: countdown(due.startAt - now) }) : $t('cups.alertNow')}</span>
    </div>
    <a class="btn primary" href="/cups/{due.id}">{round ? `▶ ${$t('cups.play')}` : $t('cups.go')}</a>
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
  .alert.on {
    background: linear-gradient(135deg, color-mix(in srgb, #ef4444 22%, var(--card)), var(--card));
    border-color: #ef4444;
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

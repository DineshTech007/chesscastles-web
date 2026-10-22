<script lang="ts">
  /**
   * CastlesClass popups on every page (owner, 2026-10-22): a student hears "your class has started" the moment the
   * coach starts it, with Join; a coach hears "time to teach" when a planned session comes (from five minutes
   * before), with Start. Only for players in CastlesClass (src/lib/classroom/visible.ts); a look every 40 seconds
   * while the page is in front, none inside a class. Each popup shows once (Later hides it).
   */
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { session } from '$lib/auth';
  import { checkClassroom, classroomShown } from './visible';
  import { classroomAccess, devPlayer, type ClassSummary } from './api';
  import { sounds } from '$lib/sound';

  type Alert = { key: string; kind: 'join' | 'teach'; id: string; name: string; who: string; title: string };
  let alert = $state<Alert | undefined>();
  const SEEN = 'cc.classAlerts';
  function seen(): Set<string> {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(SEEN) ?? '[]'));
    } catch {
      return new Set();
    }
  }
  function markSeen(key: string) {
    try {
      sessionStorage.setItem(SEEN, JSON.stringify([...seen(), key].slice(-50)));
    } catch {
      /* private mode */
    }
  }

  function pick(classes: ClassSummary[]): Alert | undefined {
    const now = Date.now();
    const done = seen();
    for (const c of classes) {
      // A student's class has started.
      if (!c.manage && c.live) {
        const key = `join:${c.id}:${c.live}`;
        if (!done.has(key)) return { key, kind: 'join', id: c.id, name: c.name, who: c.coachName, title: '' };
      }
      // My class is planned now and not started yet.
      if (c.mine && !c.live) {
        const s = c.sessions.find((x) => now >= x.at - 5 * 60_000 && now < x.at + x.minutes * 60_000);
        if (s) {
          const key = `teach:${c.id}:${s.at}`;
          if (!done.has(key)) return { key, kind: 'teach', id: c.id, name: c.name, who: '', title: s.title };
        }
      }
    }
    return undefined;
  }

  // Whether this player is in CastlesClass at all (phones have no side menu to ask it).
  const uid = $derived($session.status === 'in' ? $session.uid : devPlayer());
  $effect(() => checkClassroom(uid));

  let timer: ReturnType<typeof setTimeout> | undefined;
  async function look() {
    clearTimeout(timer);
    const inClass = /^\/castleclass\/[a-z0-9]{8}/.test(page.url.pathname);
    if (uid && $classroomShown && !inClass && document.visibilityState === 'visible' && !alert) {
      try {
        const r = await classroomAccess();
        const next = pick(r.classes);
        if (next && !alert) {
          alert = next;
          sounds.start();
        }
      } catch {
        /* offline: next time */
      }
    }
    timer = setTimeout(look, 40_000);
  }
  $effect(() => {
    if (uid && $classroomShown) void look();
    return () => clearTimeout(timer);
  });
  const onVisible = () => document.visibilityState === 'visible' && void look();
  $effect(() => {
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
  onDestroy(() => clearTimeout(timer));
  // Inside the class already: no popup about it.
  $effect(() => {
    if (alert && page.url.pathname.startsWith(`/castleclass/${alert.id}`)) close();
  });

  function close() {
    if (alert) markSeen(alert.key);
    alert = undefined;
  }
  function go() {
    const a = alert;
    close();
    if (a) void goto(`/castleclass/${a.id}`);
  }
</script>

{#if alert}
  <div class="ca" class:teach={alert.kind === 'teach'} role="alertdialog" aria-labelledby="ca-h">
    <span class="icon" aria-hidden="true">{alert.kind === 'join' ? '🔴' : '⏰'}</span>
    <div class="txt">
      <h2 id="ca-h">{alert.kind === 'join' ? 'Your class has started!' : 'Time to teach!'}</h2>
      <p>
        {#if alert.kind === 'join'}<b>{alert.name}</b> · {alert.who} is teaching now.{:else}<b>{alert.name}</b>{alert.title ? ` · ${alert.title}` : ''}: your session is now. Your students are waiting.{/if}
      </p>
    </div>
    <div class="btns">
      <button class="btn primary big" onclick={go}>{alert.kind === 'join' ? '🎓 Join the class' : '🚀 Start the class'}</button>
      <button class="btn ghost" onclick={close}>Later</button>
    </div>
  </div>
{/if}

<style>
  .ca {
    position: fixed;
    z-index: 98;
    left: 50%;
    bottom: calc(16px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    width: min(460px, calc(100vw - 24px));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 12px;
    padding: 14px 16px;
    border-radius: 18px;
    background: linear-gradient(135deg, #14532d, #0f1733);
    border: 2px solid #22c55e;
    color: #eef3ff;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    animation: up 0.35s ease-out;
  }
  .ca.teach {
    background: linear-gradient(135deg, #713f12, #0f1733);
    border-color: #f2c14e;
  }
  @keyframes up {
    from {
      transform: translate(-50%, 30px);
      opacity: 0;
    }
  }
  .icon {
    font-size: 34px;
    animation: pulse 1s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    to {
      transform: scale(1.15);
    }
  }
  .txt {
    flex: 1;
    min-width: 0;
  }
  h2 {
    margin: 0;
    font: 800 19px var(--font-title);
  }
  p {
    margin: 2px 0 0;
    font-size: 14px;
    color: #dfe6fb;
  }
  .btns {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .btns .primary {
    flex: 1;
  }
  @media (max-width: 767px) {
    .ca {
      bottom: calc(76px + env(safe-area-inset-bottom));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ca,
    .icon {
      animation: none;
    }
  }
</style>

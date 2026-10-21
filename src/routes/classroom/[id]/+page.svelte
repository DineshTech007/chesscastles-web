<script lang="ts">
  /**
   * A class's live room (Classroom, src/lib/classroom): the whole window, the coach's laptop view or a student's.
   * Signed-in members only; the room keeps the class, so reloading or a dropped connection comes back to it as it is.
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer } from '$lib/classroom/api';
  import { Live } from '$lib/classroom/live.svelte';
  import CoachView from '$lib/classroom/CoachView.svelte';
  import StudentView from '$lib/classroom/StudentView.svelte';
  import { took } from '$lib/classroom/tasks';
  import Fireworks from '$lib/components/Fireworks.svelte';

  const id = $derived(page.params.id ?? '');
  let live = $state<Live | undefined>();
  const signedIn = $derived($session.status === 'in' || !!devPlayer());

  $effect(() => {
    if (!signedIn || !id || live) return;
    live = new Live(id);
  });
  onDestroy(() => live?.close());
  // Local tests look at the class state.
  $effect(() => {
    if (import.meta.env.DEV && live) (window as unknown as { __cc: Live }).__cc = live;
  });

  function exit() {
    live?.close();
    void goto('/classroom');
  }

  // The coach's 👏: big on everyone's screen for a few seconds.
  let shownReaction = $state<{ emoji: string; text: string; name: string; at: number } | undefined>();
  $effect(() => {
    const r = live?.reaction;
    if (!r) return;
    shownReaction = r;
    const t = setTimeout(() => {
      if (shownReaction?.at === r.at) shownReaction = undefined;
    }, 3200);
    return () => clearTimeout(t);
  });
  const myRank = $derived(live?.ended ? live.ended.scores.findIndex((s) => s.uid === live!.me.uid) : -1);
  let copied = $state(false);
  function reportText() {
    const r = live!.ended!;
    const date = new Date(r.started || r.ended).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    const lines = [`♟ ${live!.info.name} · ${date}`, `Class time: ${took(r.ended - (r.started || r.ended))}`, '', `Present (${r.people.length}):`, ...r.people.map((p) => `• ${p.name} (${p.minutes} min)`)];
    if (r.scores.length) lines.push('', 'Leaderboard:', ...r.scores.slice(0, 10).map((s, i) => `${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} ${s.name}: ${s.points} pts, ${s.solved} solved`));
    if (r.tasks.length) lines.push('', 'Questions:', ...r.tasks.map((t, i) => `${i + 1}. ${t.title}${t.top[0] ? ` (best: ${t.top[0].name})` : ''}`));
    lines.push('', 'Chess Castles Classroom');
    return lines.join('\n');
  }
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText());
      copied = true;
      setTimeout(() => (copied = false), 2500);
    } catch {
      /* not allowed */
    }
  }
</script>

<svelte:head><title>{live?.info.name || 'Class'} · Chess Castles Classroom</title></svelte:head>

<div class="room">
  {#if !signedIn}
    <div class="center">
      {#if $session.status === 'loading'}<p>Loading…</p>{:else}
        <h1>Sign in to join your class</h1>
        <p class="muted">Use the same account your coach added to the class.</p>
        <button class="btn primary big" onclick={startSignIn}>Sign in</button>
        <a class="btn ghost" href="/">Home</a>
      {/if}
    </div>
  {:else if live?.ended}
    <div class="center report">
      <Fireworks rockets={4} />
      <h1>Class ended</h1>
      {#if live.coach}
        <p class="muted">{live.info.name} · {took(live.ended.ended - (live.ended.started || live.ended.ended))} · {live.ended.people.length} students</p>
        <pre>{reportText()}</pre>
        <div class="row">
          <button class="btn primary" onclick={copyReport}>{copied ? 'Copied ✓' : 'Copy for WhatsApp'}</button>
          <a class="btn" href="/classroom">Back to my classes</a>
        </div>
      {:else}
        <p>Well done today! 👏</p>
        {#if myRank >= 0}
          {@const s = live.ended.scores[myRank]}
          <p class="big">{['🥇', '🥈', '🥉'][myRank] ?? `#${myRank + 1}`} {s.points} points · {s.solved} solved</p>
        {/if}
        <a class="btn primary" href="/classroom">Back to my classes</a>
      {/if}
    </div>
  {:else if live?.closed}
    <div class="center">
      <h1>{live.closed === 'ended' ? 'Class ended' : live.closed === 'deleted' ? 'This class is not there any more' : live.closed === 'removed' ? 'You were taken off this class' : 'You are not in this class'}</h1>
      <p class="muted">{live.closed === 'refused' ? 'Ask your coach to add you, then open the class link again (signed in with that account).' : ''}</p>
      <a class="btn primary" href="/classroom">My classes</a>
    </div>
  {:else if !live || !live.me.uid}
    <div class="center">
      <p>{live?.status === 'reconnecting' ? 'Connecting to the class… (checking the connection)' : 'Joining the class…'}</p>
    </div>
  {:else if live.coach}
    <CoachView {live} onexit={exit} />
  {:else}
    <StudentView {live} onexit={exit} />
  {/if}

  {#if live?.notice}<div class="toast" role="status">{live.notice}</div>{/if}
  {#if live?.error}
    <div class="toast err" role="alert">{live.error} <button class="x" onclick={() => live && (live.error = '')}>✕</button></div>
  {/if}
  {#if shownReaction}
    {#key shownReaction.at}
      <div class="reaction" aria-live="polite">
        <span class="emoji">{shownReaction.emoji}</span>
        <span class="say">{shownReaction.name ? `${shownReaction.name}: ` : ''}{shownReaction.text}</span>
      </div>
    {/key}
  {/if}
</div>

<style>
  .room {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--bg);
    color: var(--text);
    display: flex;
    flex-direction: column;
  }
  .room > :global(:first-child) {
    flex: 1;
    min-height: 0;
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
    padding: 24px;
    overflow: auto;
  }
  h1 {
    margin: 0;
    font: 700 28px var(--font-title);
  }
  .muted {
    color: var(--muted);
  }
  .big {
    font: 800 26px var(--font-title);
    color: var(--gold);
  }
  .report pre {
    text-align: left;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
    max-width: min(560px, 100%);
    white-space: pre-wrap;
    font: 500 14px var(--font-body);
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    z-index: 90;
    background: var(--card);
    border: 1px solid var(--gold);
    border-radius: 12px;
    padding: 10px 16px;
    box-shadow: var(--shadow);
    font-weight: 600;
    max-width: calc(100vw - 32px);
  }
  .toast.err {
    border-color: var(--loss);
    bottom: 76px;
  }
  .x {
    background: none;
    border: 0;
    color: var(--muted);
    cursor: pointer;
  }
  .reaction {
    position: fixed;
    left: 50%;
    top: 38%;
    transform: translate(-50%, -50%);
    z-index: 95;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    pointer-events: none;
    animation: rise 3.2s ease-out forwards;
  }
  .emoji {
    font-size: 110px;
    line-height: 1;
    filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.4));
  }
  .say {
    font: 800 28px var(--font-title);
    color: #fff;
    background: rgba(11, 20, 38, 0.8);
    padding: 6px 16px;
    border-radius: 14px;
  }
  @keyframes rise {
    0% {
      opacity: 0;
      transform: translate(-50%, -30%) scale(0.5);
    }
    12% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
    20% {
      transform: translate(-50%, -50%) scale(1);
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -70%) scale(1);
    }
  }
</style>

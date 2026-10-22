<script lang="ts">
  /**
   * Puzzle Racer's home (owner, 2026-10-22: "our own puzzle racer and battle, rich UI"): cars racing across the top,
   * then three ways to race: a quick race with whoever is waiting (computer racers if nobody), a race with friends
   * (a link to share), and a Puzzle Battle (one friend, one on one). Below: the player's record and the top racers.
   */
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer } from '$lib/classroom/api';
  import { boardOf, type KfideLeader } from '$lib/social';
  import { track } from '$lib/analytics';
  import Car from '$lib/racer/Car.svelte';
  import { CARS, newRace, quickRace } from '$lib/racer/api';
  import { racerStats } from '$lib/racer/stats';

  const signedIn = $derived($session.status === 'in' || !!devPlayer());
  let busy = $state('');
  let error = $state('');
  let seconds = $state(90);

  async function go(kind: 'quick' | 'friends' | 'battle') {
    if (!signedIn) return startSignIn();
    busy = kind;
    error = '';
    try {
      const r = kind === 'quick' ? await quickRace() : await newRace({ seconds: kind === 'battle' ? Math.min(seconds, 90) : seconds, duel: kind === 'battle' });
      track('feature', `racer_${kind}`);
      await goto(`/puzzles/racer/${r.id}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = '';
    }
  }

  let top = $state<KfideLeader[]>([]);
  $effect(() => {
    if ($session.status !== 'in') return;
    boardOf('racer').then(
      (l) => (top = l.slice(0, 5)),
      () => {},
    );
  });
</script>

<svelte:head><title>Puzzle Racer · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/puzzles">← Puzzles</a>

  <section class="hero">
    <div class="sky">
      <h1 class="display">Puzzle Racer <span class="new">NEW</span></h1>
      <p class="lead">Race other players through the same puzzles. Every right answer drives your car forward!</p>
    </div>
    <div class="road" aria-hidden="true">
      <div class="kerb"></div>
      <div class="lanes">
        {#each [0, 1, 2] as lane (lane)}
          <div class="lane">
            {#each CARS.slice(lane * 3, lane * 3 + 3) as _, k (k)}
              <span class="drive" style="--d: {6 + lane * 1.3 + k * 0.7}s; --delay: {-k * 2.4 - lane * 1.1}s"><Car car={lane * 3 + k} size={70} moving /></span>
            {/each}
          </div>
        {/each}
        <div class="finish"></div>
      </div>
      <div class="kerb"></div>
    </div>
  </section>

  {#if error}<p class="err">{error}</p>{/if}

  <div class="modes">
    <button class="mode quick" onclick={() => go('quick')} disabled={!!busy}>
      <span class="icon">🏎️</span>
      <span class="name">Quick race</span>
      <span class="what">Race whoever is here now, up to 10 cars. Nobody? Computer racers join you.</span>
      <span class="cta">{busy === 'quick' ? 'Finding a race…' : 'Race now'}</span>
    </button>
    <button class="mode friends" onclick={() => go('friends')} disabled={!!busy}>
      <span class="icon">🏁</span>
      <span class="name">Race with friends</span>
      <span class="what">Get a link for your friends or your class. You start the race when everyone is in.</span>
      <span class="cta">{busy === 'friends' ? 'Making the race…' : 'Make a race'}</span>
    </button>
    <button class="mode battle" onclick={() => go('battle')} disabled={!!busy}>
      <span class="icon">⚔️</span>
      <span class="name">Puzzle Battle</span>
      <span class="what">You against one friend: the same puzzles, who solves more wins. They get a popup!</span>
      <span class="cta">{busy === 'battle' ? 'Making the battle…' : 'Challenge a friend'}</span>
    </button>
  </div>
  <div class="len" role="group" aria-label="Race length for friends and battles">
    <span class="muted">Races with friends last</span>
    {#each [60, 90, 120] as s (s)}<button class="chip" class:on={seconds === s} onclick={() => (seconds = s)}>{s === 60 ? '1 min' : s === 90 ? '90 s' : '2 min'}</button>{/each}
    <span class="muted small">(battles: up to 90 s)</span>
  </div>

  <div class="cols">
    <section class="card pad stats">
      <h2>Your record</h2>
      <div class="nums">
        <span><b class="num lcd">{$racerStats.best}</b><span class="muted">best score</span></span>
        <span><b class="num">{$racerStats.races}</b><span class="muted">races</span></span>
        <span><b class="num">{$racerStats.wins}</b><span class="muted">wins 🥇</span></span>
        <span><b class="num">{$racerStats.battleWins}</b><span class="muted">battles won ⚔️</span></span>
      </div>
      {#if !signedIn}<button class="btn primary" onclick={() => startSignIn()}>Sign in to race</button>{/if}
    </section>
    <section class="card pad">
      <h2>Top racers</h2>
      {#each top as p, i (p.uid)}
        <div class="row" class:me={p.me}><span class="pos">{['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`}</span><span class="nm">{p.name}{p.me ? ' (you)' : ''}</span><b class="num">{p.rating}</b></div>
      {:else}
        <p class="muted">{signedIn ? 'No scores yet: win the first race and lead the board!' : 'Sign in to see the leaderboard.'}</p>
      {/each}
      <a class="all" href="/leaderboard#racer">Whole leaderboard →</a>
    </section>
  </div>

  <section class="card pad how">
    <h2>How it works</h2>
    <ol>
      <li><b>🚦 Lights:</b> five red lights, then GO! Everyone starts together.</li>
      <li><b>🧩 Puzzles:</b> the same ones for every racer, easy first and harder each time.</li>
      <li><b>⚡ Combo:</b> right answers in a row earn bonus points (+1 at 5, +2 at 12, +3 at 20, +4 at 30).</li>
      <li><b>❌ A wrong move</b> breaks the combo and goes straight to the next puzzle.</li>
      <li><b>🏆 The flag:</b> most points wins. After the race, open any puzzle to see the answer.</li>
    </ol>
  </section>
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    font-weight: 600;
    font-size: 14px;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12.5px;
  }
  .err {
    color: var(--loss);
  }
  .pad {
    padding: 16px 18px;
  }
  .hero {
    border-radius: 22px;
    overflow: hidden;
    background: linear-gradient(180deg, #1d4ed8 0%, #38bdf8 60%, #7dd3fc 100%);
    box-shadow: var(--shadow);
  }
  .sky {
    padding: 22px 22px 14px;
    color: #fff;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }
  .sky h1 {
    margin: 0;
    font-size: clamp(30px, 6vw, 48px);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .new {
    font: 800 13px var(--font-body);
    padding: 3px 10px;
    border-radius: 999px;
    background: #f43f5e;
    text-shadow: none;
    animation: bob 1.2s ease-in-out infinite;
  }
  @keyframes bob {
    50% {
      transform: translateY(-3px);
    }
  }
  .lead {
    margin: 6px 0 0;
    font: 600 17px var(--font-body);
    max-width: 560px;
  }
  .road {
    background: #2f7d32;
  }
  .kerb {
    height: 7px;
    background: repeating-linear-gradient(90deg, #e53935 0 18px, #fafafa 18px 36px);
    animation: kerb 0.5s linear infinite;
  }
  @keyframes kerb {
    to {
      background-position: -36px 0;
    }
  }
  .lanes {
    position: relative;
    background: linear-gradient(180deg, #3a3f4b, #2c313b);
  }
  .lane {
    position: relative;
    height: 44px;
    border-bottom: 2px dashed rgba(255, 255, 255, 0.22);
    overflow: hidden;
  }
  .lane:last-of-type {
    border-bottom: 0;
  }
  .drive {
    position: absolute;
    top: 6px;
    left: -80px;
    animation: across var(--d) linear infinite;
    animation-delay: var(--delay);
  }
  @keyframes across {
    to {
      left: calc(100% + 20px);
    }
  }
  .finish {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 40px;
    width: 12px;
    background: repeating-conic-gradient(#fff 0 25%, #111 0 50%) 0 0 / 12px 12px;
    opacity: 0.85;
  }
  .modes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .mode {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 18px;
    border-radius: 20px;
    border: 0;
    color: #fff;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s;
  }
  .mode:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.01);
  }
  .mode:disabled {
    opacity: 0.75;
    cursor: wait;
  }
  .quick {
    background: linear-gradient(135deg, #f97316, #ef4444);
  }
  .friends {
    background: linear-gradient(135deg, #0ea5e9, #6366f1);
  }
  .battle {
    background: linear-gradient(135deg, #a855f7, #db2777);
  }
  .icon {
    font-size: 40px;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
  }
  .name {
    font: 800 22px var(--font-title);
  }
  .what {
    font: 500 14px/1.35 var(--font-body);
    opacity: 0.95;
    flex: 1;
  }
  .cta {
    margin-top: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.95);
    color: #0b1426;
    font: 800 15px var(--font-body);
  }
  .len {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  h2 {
    margin: 0 0 8px;
    font: 700 19px var(--font-title);
  }
  .nums {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 8px;
  }
  .nums > span {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    font-size: 12.5px;
  }
  .nums b {
    font: 800 28px var(--font-title);
  }
  .nums b.lcd {
    font: 800 34px/1 'Barlow Condensed', var(--font-display);
    color: #ffb84d;
    text-shadow: 0 0 12px rgba(255, 160, 40, 0.5);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    border-top: 1px solid var(--border-soft);
  }
  .row.me {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    border-radius: 8px;
  }
  .pos {
    width: 34px;
  }
  .nm {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .all {
    display: inline-block;
    margin-top: 8px;
    font-weight: 700;
    font-size: 14px;
  }
  .how ol {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  @media (max-width: 760px) {
    .modes,
    .cols {
      grid-template-columns: 1fr;
    }
    .mode {
      padding: 14px 16px;
    }
    .icon {
      font-size: 32px;
    }
    .nums {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .drive,
    .kerb,
    .new {
      animation: none;
    }
  }
</style>

<script lang="ts">
  /**
   * The Puzzle Lobby on Home (owner, 2026-10-22: "show the upcoming or current puzzle race with a join button, and
   * puzzle battle challenges, so kids can race easily"): the race filling up now with its countdown and the cars
   * waiting, how many are racing this moment, and Puzzle Battles anyone can take (or post one). Live: the server
   * sends every change (server/api-worker src/racer.ts, "race:lobby"), nothing is asked every few seconds.
   */
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { session } from '$lib/auth';
  import { Room, devPlayer } from '$lib/classroom/api';
  import { track } from '$lib/analytics';
  import Car from '$lib/racer/Car.svelte';
  import { quickRace, seekBattle, type Lobby } from '$lib/racer/api';
  import { racerTitle } from '$lib/racer/stats';

  let lobby = $state<Lobby | undefined>();
  let room: Room | undefined;
  $effect(() => {
    if (!($session.status === 'in' || devPlayer()) || room) return;
    room = new Room(
      'lobby',
      (m) => {
        if (m.t === 'lobby') lobby = m;
      },
      () => {},
      false,
      'race',
    );
  });
  onDestroy(() => room?.close());
  let now = $state(Date.now());
  const tick = setInterval(() => (now = room?.now() ?? Date.now()), 250);
  onDestroy(() => clearInterval(tick));

  const me = $derived($session.status === 'in' ? $session.uid : (devPlayer() ?? ''));
  /** Seconds until the open race's lights (it can be joined until then). */
  const left = $derived(lobby?.open ? Math.max(0, Math.ceil((lobby.open.startAt - 4000 - now) / 1000)) : 0);
  const open = $derived(lobby?.open && left > 1 ? lobby.open : null);
  const seeks = $derived((lobby?.seeks ?? []).filter((s) => now - s.at < 180_000));
  const mine = $derived(seeks.find((s) => s.uid === me));

  let busy = $state('');
  let error = $state('');
  async function act(kind: string, f: () => Promise<string>) {
    busy = kind;
    error = '';
    try {
      const id = await f();
      track('feature', `lobby_${kind}`);
      await goto(`/puzzles/racer/${id}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = '';
    }
  }
  const joinRace = () => act('race', async () => (open ? open.id : (await quickRace()).id));
  const postBattle = () => act('post', async () => (await seekBattle()).id);
  const takeBattle = (id: string) => act('take', async () => id);
  const waited = (at: number) => {
    const s = Math.max(0, Math.floor((now - at) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
  };
</script>

<section class="lobby" aria-labelledby="lobby-h">
  <header class="lh">
    <h2 id="lobby-h" class="display">🏁 Puzzle Lobby <span class="new">NEW</span></h2>
    {#if lobby?.racing}<span class="livepill"><span class="dot"></span>{lobby.racers} racing now</span>{/if}
  </header>

  <div class="cards">
    <div class="card race" class:hot={!!open}>
      <span class="kicker">Next race</span>
      {#if open}
        <div class="count">
          <svg viewBox="0 0 44 44" class="ring" aria-hidden="true">
            <circle cx="22" cy="22" r="19" class="track" />
            <circle cx="22" cy="22" r="19" class="fill" style="stroke-dashoffset: {119.4 * (1 - Math.min(1, left / 14))}" />
          </svg>
          <b class="num">{left}</b>
        </div>
        <p class="what">Starts in {left} s · {open.cars} {open.cars === 1 ? 'racer' : 'racers'} waiting</p>
        <div class="cars" aria-hidden="true">
          {#each Array.from({ length: Math.min(open.cars, 6) }) as _, i (i)}<Car car={i} size={40} moving />{/each}
        </div>
        <button class="btn go" onclick={joinRace} disabled={!!busy}>{busy === 'race' ? 'Joining…' : '🏎️ Join the race'}</button>
      {:else}
        <p class="what">No race is filling up. Start one: others join you, or computer racers will!</p>
        <div class="cars" aria-hidden="true"><Car car={0} size={40} /><Car car={4} size={40} /><Car car={7} size={40} /></div>
        <button class="btn go" onclick={joinRace} disabled={!!busy}>{busy === 'race' ? 'Starting…' : '🏁 Start a race'}</button>
      {/if}
    </div>

    <div class="card battle">
      <span class="kicker">⚔️ Battle challenges</span>
      {#each seeks.slice(0, 4) as s (s.id)}
        <div class="seek" class:mine={s.uid === me}>
          <span class="av">{s.name.trim()[0]?.toUpperCase() ?? '?'}</span>
          <span class="who">
            <b>{s.uid === me ? 'Your challenge' : s.name}</b>
            <small>{racerTitle(s.best) ? `🏎️ ${racerTitle(s.best)} · ` : ''}waiting {waited(s.at)}</small>
          </span>
          {#if s.uid === me}
            <button class="btn small" onclick={() => takeBattle(s.id)}>Open</button>
          {:else}
            <button class="btn small fight" onclick={() => takeBattle(s.id)} disabled={!!busy}>Battle!</button>
          {/if}
        </div>
      {:else}
        <p class="what">No challenges yet. Post one and the first to take it races you!</p>
      {/each}
      {#if !mine}<button class="btn post" onclick={postBattle} disabled={!!busy}>{busy === 'post' ? 'Posting…' : '⚔️ Post a challenge'}</button>{/if}
    </div>
  </div>
  {#if error}<p class="err">{error}</p>{/if}
  <div class="links"><a href="/puzzles/racer">Race with friends →</a><a href="/leaderboard#racer">Top racers →</a></div>
</section>

<style>
  .lobby {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 20px;
    border: 2px solid color-mix(in srgb, #38bdf8 60%, transparent);
    background:
      radial-gradient(70% 90% at 0% 0%, color-mix(in srgb, #38bdf8 22%, transparent), transparent 70%),
      radial-gradient(60% 80% at 100% 100%, color-mix(in srgb, #a855f7 20%, transparent), transparent 70%),
      linear-gradient(135deg, #16224a, #0f1733);
    color: #eef3ff;
  }
  .lh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  h2 {
    margin: 0;
    font-size: 24px;
    color: #7dd3fc;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .new {
    font: 800 11px var(--font-body);
    padding: 2px 8px;
    border-radius: 999px;
    background: #f43f5e;
    color: #fff;
    animation: bob 1.2s ease-in-out infinite;
  }
  @keyframes bob {
    50% {
      transform: translateY(-2px);
    }
  }
  .livepill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.18);
    color: #fecaca;
    font: 800 12.5px var(--font-body);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    animation: ping 1.2s ease-out infinite;
  }
  @keyframes ping {
    from {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
    }
    to {
      box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
    }
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: inherit;
  }
  .race.hot {
    border-color: #22c55e;
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.4), 0 0 24px rgba(34, 197, 94, 0.18);
  }
  .kicker {
    font: 800 12px var(--font-body);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #c9d3ee;
  }
  .what {
    margin: 0;
    font-size: 14px;
    color: #dfe6fb;
    line-height: 1.3;
  }
  .count {
    position: relative;
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
  }
  .ring {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
  }
  .ring circle {
    fill: none;
    stroke-width: 4;
  }
  .ring .track {
    stroke: rgba(255, 255, 255, 0.12);
  }
  .ring .fill {
    stroke: #22c55e;
    stroke-dasharray: 119.4;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.25s linear;
  }
  .count b {
    font: 800 26px 'Barlow Condensed', var(--font-title);
    color: #86efac;
  }
  .cars {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    min-height: 22px;
  }
  .go {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border: 0;
    color: #fff;
    font-weight: 800;
  }
  .seek {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
  }
  .seek.mine {
    outline: 1px dashed rgba(247, 210, 122, 0.6);
  }
  .av {
    width: 30px;
    height: 30px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, #a855f7, #db2777);
    font: 800 14px var(--font-body);
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .who b {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who small {
    color: #c9d3ee;
    font-size: 11.5px;
  }
  .fight {
    background: linear-gradient(135deg, #a855f7, #db2777);
    border: 0;
    color: #fff;
    font-weight: 800;
  }
  .post {
    margin-top: auto;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.25);
    font-weight: 800;
  }
  .err {
    margin: 0;
    color: #fca5a5;
    font-size: 13px;
  }
  .links {
    display: flex;
    gap: 16px;
    font-size: 13px;
    font-weight: 700;
  }
  .links a {
    color: #7dd3fc;
  }
  @media (max-width: 640px) {
    .cards {
      grid-template-columns: 1fr;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .new,
    .dot {
      animation: none;
    }
  }
</style>

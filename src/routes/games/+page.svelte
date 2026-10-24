<script lang="ts">
  /**
   * My games: every game, newest first, grouped by day. At the top the record (wins, draws, losses and the win
   * rate) of the games shown; each card shows the result, the opponent and their rating, how the game went
   * (mode, time control, moves, how it ended), the player's rating with how it moved, and Review and Share.
   */
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import ShareGame from '$lib/components/ShareGame.svelte';
  import { session } from '$lib/auth';
  import { onMount } from 'svelte';
  import { syncGames, syncState } from '$lib/stores/gameSync';
  import { KIND_LABEL, opponentOf, outcome, type GameKind, type SavedGame } from '$lib/stores/myGames';
  import { kfideAll, shownGames } from '$lib/stores/me';
  import { gameRating } from '$lib/stores/gameRatings';

  // Opening My games always checks the account for games from other devices.
  onMount(() => {
    const s = $session;
    if (s.status === 'in') void syncGames(s.uid);
  });
  $effect(() => {
    if ($session.status === 'in' && $syncState.status === 'idle') void syncGames($session.uid);
  });

  let filter = $state<GameKind | 'all'>('all');
  const games = $derived($shownGames.filter((g) => filter === 'all' || g.kind === filter));
  const count = (k: GameKind | 'all') => (k === 'all' ? $shownGames.length : $shownGames.filter((g) => g.kind === k).length);
  const moves = (g: SavedGame) => Math.ceil(g.uci.length / 2);

  /** The record of the games shown (finished ones). */
  const record = $derived.by(() => {
    const r = { won: 0, draw: 0, lost: 0 };
    for (const g of games) {
      const o = outcome(g);
      if (o !== 'unfinished') r[o]++;
    }
    const total = r.won + r.draw + r.lost;
    return { ...r, total, rate: total ? Math.round((100 * (r.won + r.draw / 2)) / total) : 0 };
  });

  /** Today, Yesterday, then the date. */
  const dayLabel = (t: number) => {
    const d = new Date(t);
    const today = new Date();
    const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(today) - start(d)) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  };
  const groups = $derived.by(() => {
    const out: { label: string; games: SavedGame[] }[] = [];
    for (const g of games) {
      const label = dayLabel(g.playedAt);
      if (out.at(-1)?.label === label) out.at(-1)!.games.push(g);
      else out.push({ label, games: [g] });
    }
    return out;
  });
  const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const RESULT = { won: ['W', 'Win'], lost: ['L', 'Loss'], draw: ['D', 'Draw'], unfinished: ['–', 'Not finished'] } as const;
  const KIND_ICON: Record<GameKind, IconName> = { fide: 'trophy', computer: 'robot', lichess: 'globe', friend: 'users' };
  const KIND_SHORT: Record<GameKind, string> = { fide: 'FIDE-level', computer: 'Computer', lichess: 'Lichess', friend: 'Friends' };
</script>

<svelte:head><title>My games · Chess Castles</title></svelte:head>

<div class="page">
  <header class="head">
    <div>
      <h1 class="display">My games</h1>
      <p class="sub">{$session.status === 'in' ? 'Your games on every device where you sign in.' : 'Kept in this browser. Sign in to have them on every device.'} Open one to go through it with the engine and the FIDE games database.</p>
    </div>
    {#if $session.status === 'in'}
      <p class="sync" role="status">
        {#if $syncState.status === 'syncing'}<span class="dot busy"></span>Syncing…
        {:else if $syncState.status === 'done'}<span class="dot ok"></span>Synced{$syncState.added ? ` · ${$syncState.added} new` : ''}
        {:else if $syncState.status === 'error'}<span class="dot bad"></span><span class="bad">Couldn't sync: {$syncState.message}</span>{/if}
        {#if $syncState.status !== 'syncing'}<button class="link" onclick={() => $session.status === 'in' && syncGames($session.uid)}>Sync now</button>{/if}
      </p>
    {/if}
  </header>

  <div class="filters" role="group" aria-label="Show">
    {#each [['all', 'All games'], ['fide', 'FIDE-level'], ['computer', 'Computer'], ['lichess', 'Lichess'], ['friend', 'Friends']] as const as [k, label] (k)}
      <button class="fchip" aria-pressed={filter === k} onclick={() => (filter = k)}>{label} <span class="n num">{count(k)}</span></button>
    {/each}
  </div>

  {#if record.total}
    <section class="record card" aria-label="Your record">
      <div class="rec-nums">
        <span><strong class="num">{record.total}</strong><span class="rl">games</span></span>
        <span class="w"><strong class="num">{record.won}</strong><span class="rl">wins</span></span>
        <span class="d"><strong class="num">{record.draw}</strong><span class="rl">draws</span></span>
        <span class="l"><strong class="num">{record.lost}</strong><span class="rl">losses</span></span>
        <span class="rate"><strong class="num">{record.rate}%</strong><span class="rl">score</span></span>
      </div>
      <div class="bar" aria-hidden="true">
        <span class="bw" style="flex: {record.won}"></span><span class="bd" style="flex: {record.draw}"></span><span class="bl" style="flex: {record.lost}"></span>
      </div>
    </section>
  {/if}

  {#if !games.length}
    <div class="empty card">
      <Icon name="history" size={34} color="var(--muted)" />
      <p>{$shownGames.length ? 'No games of this kind yet.' : 'Games you play on this site appear here.'}</p>
      <a class="btn primary" href="/play">Play a game</a>
    </div>
  {:else}
    {#each groups as grp (grp.label)}
      <section class="day">
        <h2 class="day-h">{grp.label} <span class="dc num">{grp.games.length}</span></h2>
        <ul class="list">
          {#each grp.games as g (g.id)}
            {@const o = outcome(g)}
            {@const r = gameRating(g, $kfideAll)}
            {@const d = r.before !== undefined && r.after !== undefined ? r.after - r.before : undefined}
            <li class="game {o}">
              <a class="open" href="/analysis?game={g.id}">
                <span class="res" aria-label={RESULT[o][1]}><b>{RESULT[o][0]}</b><small>{RESULT[o][1]}</small></span>
                <span class="mid">
                  <span class="opp-line">
                    <span class="vs">vs</span>
                    <span class="opp">{opponentOf(g)}</span>
                    {#if g.opponentRating && g.kind !== 'computer' && !opponentOf(g).includes(String(g.opponentRating))}<span class="orating num">{g.opponentRating}</span>{/if}
                  </span>
                  <span class="facts">
                    <span class="fact"><Icon name={KIND_ICON[g.kind]} size={13} />{KIND_SHORT[g.kind]}</span>
                    {#if g.timeControl}<span class="fact"><Icon name="history" size={13} />{g.timeControl}</span>{/if}
                    <span class="fact num">{moves(g)} moves</span>
                    {#if g.reason}<span class="fact reason">{g.reason}</span>{/if}
                  </span>
                </span>
                <span class="me">
                  {#if r.before !== undefined}
                    <span class="mine num">{r.after ?? r.before}{#if d !== undefined}<span class="delta" class:up={d > 0} class:down={d < 0}>{d > 0 ? '▲' : d < 0 ? '▼' : '='}{Math.abs(d) || ''}</span>{/if}</span>
                    <span class="ml">{r.label}</span>
                  {/if}
                  <span class="when num">{time(g.playedAt)}</span>
                </span>
              </a>
              <div class="acts">
                <a class="btn small review" href="/analysis?game={g.id}" title="Review this game: engine, database or Chess Guru"><Icon name="analyse" size={16} />Review</a>
                {#if g.result !== '*'}<ShareGame game={() => g} small />{/if}
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 42px;
  }
  .sub {
    margin: 6px 0 0;
    max-width: 560px;
    color: var(--text-2);
    font-size: 15px;
    line-height: 1.5;
  }
  .sync {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--raised);
    font-size: 13.5px;
    color: var(--text-2);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
  }
  .dot.ok {
    background: var(--win);
  }
  .dot.busy {
    background: var(--gold);
    animation: pulse 1s ease-in-out infinite;
  }
  .dot.bad,
  .sync .bad {
    color: var(--loss);
    background: var(--loss);
  }
  .sync .bad {
    background: none;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .fchip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .fchip[aria-pressed='true'] {
    background: var(--gold);
    border-color: var(--gold);
    color: #1b1300;
  }
  .fchip .n {
    min-width: 22px;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 14%, transparent);
    font-size: 12px;
    text-align: center;
  }
  .record {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px;
  }
  .rec-nums {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
  .rec-nums > span {
    display: flex;
    flex-direction: column;
  }
  .rec-nums strong {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.1;
  }
  .rl {
    font-size: 12.5px;
    color: var(--text-2);
  }
  .rec-nums .w strong {
    color: var(--win);
  }
  .rec-nums .d strong {
    color: var(--accent);
  }
  .rec-nums .l strong {
    color: var(--loss);
  }
  .rec-nums .rate strong {
    color: var(--gold);
  }
  .bar {
    display: flex;
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--raised);
  }
  .bw {
    background: var(--win);
  }
  .bd {
    background: var(--accent);
  }
  .bl {
    background: var(--loss);
  }
  .day {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .day-h {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-2);
  }
  .dc {
    padding: 0 7px;
    border-radius: 999px;
    background: var(--raised);
    font-size: 11.5px;
    letter-spacing: 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .game {
    --c: var(--muted);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px 8px 8px;
    border-radius: 14px;
    border: 1px solid var(--border);
    border-left: 4px solid var(--c);
    background: var(--card);
    transition:
      border-color 0.15s,
      transform 0.15s;
  }
  .game:hover {
    border-color: color-mix(in srgb, var(--c) 50%, var(--border));
    border-left-color: var(--c);
  }
  .game.won {
    --c: var(--win);
  }
  .game.lost {
    --c: var(--loss);
  }
  .game.draw {
    --c: var(--accent);
  }
  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 4px;
    color: var(--text);
    text-decoration: none;
  }
  .open:hover {
    text-decoration: none;
  }
  .res {
    width: 52px;
    height: 52px;
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, transparent);
  }
  .res b {
    font-size: 20px;
    font-weight: 800;
    line-height: 1;
  }
  .res small {
    margin-top: 2px;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .mid {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .opp-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }
  .vs {
    font-size: 13px;
    color: var(--text-2);
  }
  .opp {
    font-size: 16.5px;
    font-weight: 650;
    letter-spacing: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .orating {
    flex: none;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--raised);
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-2);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .fact {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--raised);
    font-size: 12.5px;
    color: var(--text-2);
    white-space: nowrap;
  }
  .fact.reason {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .me {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    min-width: 92px;
    text-align: right;
  }
  .mine {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 18px;
    font-weight: 800;
    color: var(--gold);
  }
  .delta {
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 800;
    color: var(--muted);
    background: var(--raised);
  }
  .delta.up {
    color: var(--win);
    background: color-mix(in srgb, var(--win) 15%, transparent);
  }
  .delta.down {
    color: var(--loss);
    background: color-mix(in srgb, var(--loss) 15%, transparent);
  }
  .ml {
    font-size: 11.5px;
    color: var(--text-2);
  }
  .when {
    font-size: 12px;
    color: var(--muted);
  }
  .acts {
    display: flex;
    gap: 8px;
    flex: none;
  }
  .acts :global(.btn) {
    gap: 6px;
    min-height: 38px;
    padding: 0 14px;
    font-size: 14px;
    white-space: nowrap;
  }
  .review {
    background: color-mix(in srgb, var(--gold) 16%, var(--raised));
    border-color: color-mix(in srgb, var(--gold) 40%, var(--border));
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 18px;
    text-align: center;
  }
  .empty p {
    margin: 0;
    color: var(--text-2);
  }
  /* Phones: the game on top, its buttons on their own row underneath, easy to tap. */
  @media (max-width: 640px) {
    h1 {
      font-size: 34px;
    }
    .filters {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .fchip {
      flex: none;
    }
    .rec-nums strong {
      font-size: 20px;
    }
    .game {
      flex-wrap: wrap;
      padding: 8px 8px 10px;
    }
    .open {
      flex: 1 1 100%;
      gap: 10px;
    }
    .res {
      width: 46px;
      height: 46px;
    }
    .me {
      min-width: 0;
    }
    .mine {
      font-size: 16px;
    }
    .acts {
      flex: 1 1 100%;
    }
    .acts > :global(*) {
      flex: 1;
      justify-content: center;
    }
  }
</style>

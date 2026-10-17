<script lang="ts">
  /** Puzzles from the player's own games: the positions where they went wrong; find the better move (three tries). */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import { moveLabel, TACTICS, type Tactic } from '$lib/insights/analysis';
  import { opponentOf } from '$lib/insights/games';
  import { mistakesToTrain, type MoveRef } from '$lib/insights/report';
  import { loadInsights } from '$lib/insights/store';
  import { POINTS, study } from '$lib/study/progress';

  const tactic = (page.url.searchParams.get('tactic') ?? undefined) as Tactic | undefined;
  let list = $state<MoveRef[]>([]);
  let i = $state(0);
  let result = $state<boolean | undefined>();
  let solved = $state(0);
  let loaded = $state(false);

  onMount(() => {
    const d = loadInsights();
    list = d ? mistakesToTrain(d.games, tactic) : [];
    loaded = true;
  });

  function done(ok: boolean) {
    result = ok;
    if (ok) {
      solved++;
      study.log('puzzle', POINTS.puzzleSolved, `Own mistake: ${list[i].move.san}`);
    }
  }
  function next() {
    i = (i + 1) % Math.max(1, list.length);
    result = undefined;
  }
  const cur = $derived(list[i]);
</script>

<svelte:head><title>Your own mistakes · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/insights"><Icon name="back" size={16} />Guru's analysis</a>
  <header class="head">
    <div>
      <h1 class="display">Your own mistakes</h1>
      <p class="label">Positions from your games where a better move was there. Find it: three tries each.{tactic ? ` Theme: ${TACTICS[tactic].label.toLowerCase()}.` : ''}</p>
    </div>
    <div class="stat card"><span class="label">Solved now</span><strong class="display num">{solved}</strong></div>
  </header>

  {#if loaded && !list.length}
    <div class="card pad">
      <p>No positions yet. Let Guru analyse your games first.</p>
      <a class="btn primary" href="/insights">Analyse my games</a>
    </div>
  {:else if cur}
    <div class="body">
      <section class="board-box">
        {#key i}
          <PuzzleBoard fen={cur.move.fen} moves={[cur.move.bestUci!]} opponentFirst={false} tries={3} onresult={done} />
        {/key}
      </section>
      <section class="card side">
        <span class="pill">{i + 1} of {list.length}</span>
        <p>In your game against <strong>{opponentOf(cur.game)}</strong> you played <strong class="num">{moveLabel(cur.move)}</strong>.</p>
        {#if result !== undefined}
          <p class:ok={result}>{result ? `Yes! ${cur.move.bestSan} was the move.` : `The better move was ${cur.move.bestSan}.`}</p>
          {#if cur.move.tactic && cur.move.tactic !== 'other'}<p class="label">Theme: {TACTICS[cur.move.tactic].label.toLowerCase()} ({cur.move.tacticMissed ? 'you missed it' : 'your move allowed it'}).</p>{/if}
          <button class="btn primary" onclick={next}>Next position</button>
          <a class="label" href={cur.game.url} target="_blank" rel="noopener">Open the game</a>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 38px;
  }
  .head p {
    margin: 4px 0 0;
  }
  .stat {
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    border-color: var(--gold);
  }
  .stat strong {
    font-size: 30px;
    color: var(--gold);
  }
  .pad {
    padding: 18px;
  }
  .pad p {
    margin: 0 0 10px;
  }
  .body {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .board-box {
    flex: 1 1 420px;
    max-width: 640px;
    min-width: 0;
  }
  .side {
    flex: 1 1 260px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .side p {
    margin: 0;
  }
  .ok {
    color: var(--win);
    font-weight: 700;
  }
</style>

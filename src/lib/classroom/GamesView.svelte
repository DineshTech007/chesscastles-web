<script lang="ts">
  /**
   * The coach's games: every game in the class at a glance (whose move, the clocks, the results). In a simul, "Next
   * board" goes to the next game waiting for the coach's move. A game opens big to play it, end it, or put it on the
   * class board for everyone.
   */
  import type { Key } from '@lichess-org/chessground/types';
  import ClassBoard from './ClassBoard.svelte';
  import GameBoard from './GameBoard.svelte';
  import { lineAt } from './tasks';
  import type { Game } from './api';
  import type { Live } from './live.svelte';

  let { live, onspotlight, onnew }: { live: Live; onspotlight: () => void; onnew: () => void } = $props();
  let open = $state<string | undefined>();
  const me = $derived(live.me.uid);
  const games = $derived(live.games);
  const sel = $derived(games.find((g) => g.id === open));
  const turnOf = (g: Game) => lineAt(g.root, g.moves, g.moves.length).turn;
  const waitsForMe = (g: Game) => !g.result && (turnOf(g) === 'white' ? g.white : g.black) === me;
  const waiting = $derived(games.filter(waitsForMe));
  const finished = $derived(games.filter((g) => g.result).length);
  function next() {
    const list = games.filter(waitsForMe);
    if (!list.length) return;
    const i = list.findIndex((g) => g.id === open);
    open = list[(i + 1) % list.length].id;
  }
  function spotlight(g: Game) {
    live.setBoard({ ...live.board, root: g.root, moves: g.moves, ply: g.moves.length, orient: 'white', shapes: [], marks: {}, title: `${g.whiteName} – ${g.blackName}`, game: -1 });
    onspotlight();
  }
  const RESULT: Record<string, string> = { '1-0': '1–0', '0-1': '0–1', '1/2-1/2': '½–½' };
</script>

<section class="games">
  <header>
    <div>
      <b>Games</b>
      <span class="muted">{games.length} {games.length === 1 ? 'game' : 'games'} · {finished} finished{waiting.length ? ` · ${waiting.length} waiting for your move` : ''}</span>
    </div>
    <div class="acts">
      {#if waiting.length}<button class="btn primary" onclick={next} title="The next board waiting for your move">Next board ▶</button>{/if}
      <button class="btn" onclick={onnew}>+ New games</button>
      {#if games.length}<button class="btn ghost" onclick={() => live.clearGames()}>Clear all</button>{/if}
    </div>
  </header>

  {#if sel}
    <div class="one">
      <div class="big">
        <GameBoard {live} game={sel} />
      </div>
      <div class="side-acts">
        <button class="btn" onclick={() => (open = undefined)}>◀ All games</button>
        <button class="btn" onclick={() => spotlight(sel)}>Show on the class board</button>
        {#if !sel.result}
          <span class="muted small">End the game:</span>
          <div class="row">
            <button class="btn ghost" onclick={() => live.endGame(sel.id, '1-0')}>1–0</button>
            <button class="btn ghost" onclick={() => live.endGame(sel.id, '1/2-1/2')}>½–½</button>
            <button class="btn ghost" onclick={() => live.endGame(sel.id, '0-1')}>0–1</button>
          </div>
        {/if}
      </div>
    </div>
  {:else if !games.length}
    <p class="muted">No games yet. Start a simul (you against every student), the game zone (students in pairs), or play one student.</p>
    <button class="btn primary" onclick={onnew}>Start games</button>
  {:else}
    <div class="grid">
      {#each games as g (g.id)}
        {@const at = lineAt(g.root, g.moves, g.moves.length)}
        <button class="card-g" class:wait={waitsForMe(g)} class:done={!!g.result} onclick={() => (open = g.id)}>
          <span class="names"><b>{g.whiteName}</b> – <b>{g.blackName}</b></span>
          <ClassBoard fen={at.fen} lastMove={at.last as Key[] | undefined} orientation={g.black === me ? 'black' : 'white'} coordinates={false} label="{g.whiteName} – {g.blackName}" />
          <span class="info">
            {#if g.result}<span>{RESULT[g.result]} · {g.reason}</span>{:else if waitsForMe(g)}<span class="your">Your move</span>{:else}<span>{at.turn === 'white' ? g.whiteName : g.blackName} to move</span>{/if}
            {#if g.awayW || g.awayB}<span class="away" title="Times each player left the class tab during the game">👀 {g.awayW ?? 0}–{g.awayB ?? 0}</span>{:else}<span class="muted">{Math.ceil(g.moves.length / 2)} moves</span>{/if}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .games {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  header b {
    font: 700 20px var(--font-title);
    margin-right: 8px;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
  }
  .acts,
  .row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .one {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .big {
    width: min(100%, calc(100vh - 260px));
    min-width: 280px;
  }
  .side-acts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }
  .card-g {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border-radius: 12px;
    background: var(--card);
    border: 2px solid var(--border);
    color: var(--text);
    cursor: pointer;
    text-align: left;
    font: 600 13px var(--font-body);
    min-width: 0;
  }
  .card-g.wait {
    border-color: var(--gold);
    box-shadow: 0 0 12px rgba(237, 176, 64, 0.35);
  }
  .card-g.done {
    opacity: 0.75;
  }
  .card-g :global(.board) {
    pointer-events: none;
  }
  .names {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .info {
    display: flex;
    justify-content: space-between;
    gap: 4px;
  }
  .your {
    color: var(--gold);
    font-weight: 800;
  }
  .away {
    color: var(--engine);
    font-weight: 700;
  }
</style>

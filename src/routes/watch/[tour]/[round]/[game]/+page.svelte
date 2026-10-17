<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import MoveList from '$lib/components/MoveList.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import { fenOf, keyOf } from '$lib/chess/position';
  import { clocksAt, readPgn, type PgnGame } from '$lib/chess/pgn';
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
  import { broadcastGamePgn } from '$lib/lichess';

  const { tour, round, game: gameId } = page.params as { tour: string; round: string; game: string };
  let pgnText = '';
  let game = $state<PgnGame | undefined>();
  let cursor = $state(0);
  let following = $state(true);
  let orientation = $state<'white' | 'black'>('white');
  let engineOn = $state(false);
  let info = $state<EngineInfo | undefined>();
  let error = $state('');
  let timer: ReturnType<typeof setInterval> | undefined;

  async function load() {
    try {
      const text = await broadcastGamePgn(round, gameId);
      if (text === pgnText) return;
      pgnText = text;
      const [g] = readPgn(text);
      if (!g) throw new Error();
      game = g;
      if (following) cursor = g.plies.length;
      if (g.headers.get('Result') !== '*') clearInterval(timer);
    } catch {
      if (!game) error = 'This game could not be loaded. Check your connection and try again.';
    }
  }

  onMount(async () => {
    await load();
    if (game?.headers.get('Result') === '*') timer = setInterval(load, 8000);
  });
  onDestroy(() => {
    clearInterval(timer);
    engine.stopAnalysis();
  });

  const pos = $derived(game ? (cursor === 0 ? game.start : game.plies[cursor - 1].after) : undefined);
  const fen = $derived(pos ? fenOf(pos) : '');
  const h = (k: string) => game?.headers.get(k) ?? '';
  const live = $derived(h('Result') === '*');

  function go(ply: number) {
    if (!game) return;
    cursor = Math.max(0, Math.min(game.plies.length, ply));
    following = cursor === game.plies.length;
  }

  $effect(() => {
    const f = fen;
    info = undefined;
    if (!engineOn || !f || pos?.isEnd()) {
      engine.stopAnalysis();
      return;
    }
    void engine.analyse(f, (i) => {
      if (i.fen === f) info = i;
    }, 20);
  });

  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') go(cursor - 1);
    else if (e.key === 'ArrowRight') go(cursor + 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(game?.plies.length ?? 0);
    else if (e.key === 'f') orientation = orientation === 'white' ? 'black' : 'white';
    else return;
    e.preventDefault();
  }

  function analyse() {
    try {
      sessionStorage.setItem('k24.importPgn', pgnText);
    } catch {
      /* storage blocked */
    }
    goto(`/analysis?import=1&ply=${cursor}`);
  }

  function bar(side: 'white' | 'black') {
    const name = h(side === 'white' ? 'White' : 'Black');
    const title = h(side === 'white' ? 'WhiteTitle' : 'BlackTitle');
    const elo = h(side === 'white' ? 'WhiteElo' : 'BlackElo');
    const clocks = game ? clocksAt(game, cursor) : {};
    return {
      name: `${title ? title + ' ' : ''}${name}`,
      initials: name.split(/[ ,]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?',
      subtitle: [elo, h(side === 'white' ? 'WhiteFed' : 'BlackFed')].filter(Boolean).join(' · ') || (side === 'white' ? 'White' : 'Black'),
      toMove: live && pos?.turn === side && cursor === (game?.plies.length ?? 0),
      clockMs: clocks[side],
    };
  }
  const top = $derived.by(() => {
    void cursor;
    void game;
    return bar(orientation === 'white' ? 'black' : 'white');
  });
  const bottom = $derived.by(() => {
    void cursor;
    void game;
    return bar(orientation);
  });
</script>

<svelte:head><title>{game ? `${h('White')} – ${h('Black')}` : 'Game'} · Watch · Chess Castles</title></svelte:head>
<svelte:window onkeydown={onkey} />

<div class="viewer">
  {#if error}
    <div class="card">{error} <a href="/watch/{tour}?round={round}">Back to the round</a></div>
  {:else if !game || !pos}
    <div class="card">Loading the game…</div>
  {:else}
    <section class="board-col" aria-label="Board">
      <PlayerBar {...top} />
      <div class="board-row">
        {#if engineOn}
          <div class="evalbar" class:flipped={orientation === 'black'} aria-label="Evaluation {info ? evalLabel(info) : 'pending'}">
            <div class="white-share" style="height: {(info ? whiteChances(info) : 0.5) * 100}%"></div>
          </div>
        {/if}
        <div class="board-box">
          <Board
            {fen}
            {orientation}
            turnColor={pos.turn}
            viewOnly
            lastMove={cursor ? [keyOf(game.plies[cursor - 1].move.from), keyOf(game.plies[cursor - 1].move.to)] : undefined}
            check={pos.isCheck()}
            label="{h('White')} against {h('Black')}"
          />
        </div>
      </div>
      <PlayerBar {...bottom} />
    </section>

    <aside class="side">
      <div class="card info">
        <a class="back" href="/watch/{tour}?round={round}"><Icon name="back" size={16} />All boards</a>
        <h1 class="title g-title">{h('White')} – {h('Black')}</h1>
        <p class="label">{[h('Event').replace(/^Round [^:]+: .*$/, h('BroadcastName')) || h('BroadcastName'), h('Opening')].filter(Boolean).join(' · ')}</p>
        <div class="status">
          {#if live}<span class="pill live"><span class="dot"></span>Live</span>{:else}<span class="tag title">{h('Result').replace('1/2-1/2', '½-½')}</span>{/if}
          {#if !following && live}<button class="btn small" onclick={() => go(game!.plies.length)}>Follow live</button>{/if}
        </div>
        <label class="toggle">
          <input type="checkbox" bind:checked={engineOn} />
          <span>Engine {engineOn && info ? `· ${evalLabel(info)} (depth ${info.depth})` : ''}</span>
        </label>
      </div>
      <div class="card moves-card">
        <MoveList sans={game.plies.map((p) => p.san)} current={cursor} onselect={go} />
        <MoveNav ply={cursor} max={game.plies.length} {go} onflip={() => (orientation = orientation === 'white' ? 'black' : 'white')} />
      </div>
      <button class="btn primary" onclick={analyse}><Icon name="analyse" size={18} />Analyse this game</button>
    </aside>
  {/if}
</div>

<style>
  .viewer {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    max-width: 1280px;
    margin: 0 auto;
    justify-content: center;
    align-items: flex-start;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 210px), 740px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .board-box {
    flex: 1;
    min-width: 0;
  }
  .evalbar {
    width: 18px;
    flex: none;
    border-radius: 6px;
    overflow: hidden;
    background: #1b1f2a;
    display: flex;
    flex-direction: column-reverse;
  }
  .evalbar.flipped {
    flex-direction: column;
  }
  .white-share {
    background: #f2f5fb;
    transition: height 0.4s;
  }
  .side {
    flex: 1 1 340px;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .g-title {
    font-size: 21px;
  }
  .info .label {
    margin: 0;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--live);
  }
  .tag {
    padding: 3px 9px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--raised);
    font-size: 15px;
  }
  .btn.small {
    min-height: 34px;
    padding: 0 12px;
    font-size: 14px;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }
  .toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--action);
  }
  .moves-card {
    padding: 0;
    overflow: hidden;
  }
  .moves-card :global(.moves) {
    height: 300px;
  }
  @media (max-width: 767px) {
    .side {
      max-width: none;
    }
    .moves-card :global(.moves) {
      height: 180px;
    }
  }
</style>

<script lang="ts">
  /**
   * A game opened from a shared link: board, moves and result, for anyone
   * (no sign-in), with the full review one tap away.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Board from './Board.svelte';
  import Icon from './Icon.svelte';
  import MoveList from './MoveList.svelte';
  import MoveNav from './MoveNav.svelte';
  import { fenOf, keyOf, positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
  import { KIND_LABEL, pgnOfSaved, type SavedGame } from '$lib/stores/myGames';
  import { loadShared } from '$lib/share';
  import { formatDate } from '$lib/format';
  import { playMoveSound } from '$lib/sound';
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import type { Key } from '@lichess-org/chessground/types';

  let { source }: { source: string } = $props();
  let game = $state<SavedGame | undefined>();
  let error = $state('');
  let ply = $state(0);
  let orientation = $state<'white' | 'black'>('white');

  onMount(() => {
    loadShared(source).then(
      (g) => {
        game = g;
        ply = g.uci.length;
        orientation = g.userSide ?? 'white';
      },
      (e) => (error = e instanceof Error ? e.message : 'This game could not be opened.'),
    );
  });

  /** Every position of the game, and its moves in SAN. */
  const line = $derived.by(() => {
    if (!game) return { positions: [] as Chess[], moves: [] as NormalMove[], sans: [] as string[] };
    const pos = positionFromFen(game.startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const positions = [pos.clone()];
    const moves: NormalMove[] = [];
    const sans: string[] = [];
    for (const u of game.uci) {
      const m = uciToMove(u);
      if (!m || !pos.isLegal(m)) break;
      sans.push(sanOf(pos, m));
      pos.play(m);
      moves.push(m);
      positions.push(pos.clone());
    }
    return { positions, moves, sans };
  });

  function go(p: number) {
    const to = Math.max(0, Math.min(line.sans.length, p));
    if (to === ply + 1) playMoveSound(line.positions[ply], line.moves[ply]);
    ply = to;
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') go(ply - 1);
    else if (e.key === 'ArrowRight') go(ply + 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(line.sans.length);
    else return;
    e.preventDefault();
  }

  const pos = $derived(line.positions[ply]);
  const last = $derived(ply ? ([keyOf(line.moves[ply - 1].from), keyOf(line.moves[ply - 1].to)] as Key[]) : undefined);
  const resultText = $derived(!game ? '' : game.result === '1-0' ? `${game.white} won` : game.result === '0-1' ? `${game.black} won` : game.result === '1/2-1/2' ? 'Draw' : KIND_LABEL[game.kind] ? 'Unfinished' : '');

  function analyse() {
    if (!game) return;
    sessionStorage.setItem('k24.importPgn', pgnOfSaved(game));
    goto(`/analysis?import=1&review=1&ply=${ply}`);
  }
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>{game ? `${game.white} vs ${game.black}` : 'Shared game'} · Chess Castles</title></svelte:head>

{#if error}
  <div class="card msg">
    <p>{error}</p>
    <a class="btn primary" href="/">Go to Chess Castles</a>
  </div>
{:else if !game || !pos}
  <div class="card msg"><p class="label">Opening the game…</p></div>
{:else}
  <div class="shared">
    <section class="board-col">
      <div class="who top">{orientation === 'white' ? game.black : game.white}</div>
      <Board fen={fenOf(pos)} {orientation} turnColor={pos.turn} lastMove={last} check={pos.isCheck()} viewOnly label="Shared game" onswipe={(d) => go(ply + (d === 'forward' ? 1 : -1))} />
      <div class="who">{orientation === 'white' ? game.white : game.black}</div>
    </section>
    <aside class="side">
      <div class="card head">
        <span class="label">{KIND_LABEL[game.kind] ?? 'Analysis'}{game.timeControl ? ` · ${game.timeControl}` : ''} · {formatDate(game.playedAt)}</span>
        <h1 class="title">{game.white} <span class="vs">vs</span> {game.black}</h1>
        <p class="res"><strong>{resultText}</strong>{game.reason ? ` · ${game.reason}` : ''}</p>
        <div class="btns">
          <button class="btn primary" onclick={analyse}><Icon name="analyse" size={16} />Review every move</button>
          <button class="btn" onclick={() => (orientation = orientation === 'white' ? 'black' : 'white')}><Icon name="flip" size={16} />Flip</button>
        </div>
      </div>
      <div class="card moves">
        <MoveList sans={line.sans} current={ply} onselect={go} />
        <MoveNav {ply} max={line.sans.length} {go} />
      </div>
      <a class="card cta" href="/">
        <span><strong>Play on Chess Castles</strong><span class="label">Free chess: FIDE-rated opponents, lessons, puzzles and more.</span></span>
        <Icon name="chevron" />
      </a>
    </aside>
  </div>
{/if}

<style>
  .shared {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    max-width: 1200px;
    margin: 0 auto;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 200px), 720px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .who {
    font-weight: 700;
    padding: 2px 4px;
  }
  .side {
    flex: 1 1 300px;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head h1 {
    margin: 0;
    font-size: 22px;
  }
  .vs {
    color: var(--muted);
    font-weight: 500;
  }
  .res {
    margin: 0;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .btns .btn {
    gap: 6px;
  }
  .moves {
    padding: 0;
    overflow: hidden;
  }
  .moves :global(.moves) {
    max-height: 300px;
  }
  .cta {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    text-decoration: none;
    border-color: var(--gold);
  }
  .cta > span {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .msg {
    max-width: 520px;
    margin: 40px auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .msg p {
    margin: 0;
  }
  @media (max-width: 767px) {
    .side {
      max-width: none;
    }
  }
</style>

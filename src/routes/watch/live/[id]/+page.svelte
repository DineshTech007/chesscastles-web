<script lang="ts">
  /**
   * Watches a Lichess game live (a friend's game, from their profile or the
   * Friends page): the board moves as they play, with both clocks. When the
   * game ends it can be opened in Analyse.
   */
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import { followGame, type LiveFrame, type LiveGameInfo } from '$lib/lichess';
  import { positionFromFen } from '$lib/chess/position';
  import { playMoveSound } from '$lib/sound';
  import { parseUci } from 'chessops/util';
  import type { NormalMove } from 'chessops/types';
  import type { Key } from '@lichess-org/chessground/types';

  const id = page.params.id!;
  let info = $state<LiveGameInfo | undefined>();
  let frame = $state<LiveFrame | undefined>();
  let at = $state(Date.now());
  let ended = $state(false);
  let orientation = $state<'white' | 'black'>(page.url.searchParams.get('as') === 'black' ? 'black' : 'white');
  let tick = $state(Date.now());

  const stop = followGame(
    id,
    // The last message may come without the players: keep them.
    (g) => (info = info && g.white.name === 'Anonymous' ? { ...info, status: g.status, winner: g.winner } : g),
    (f) => {
      // A new move: its sound, from the position before it.
      if (frame && f.lm && f.fen !== frame.fen) {
        try {
          const before = positionFromFen(frame.fen);
          const m = parseUci(f.lm) as NormalMove | undefined;
          if (m) playMoveSound(before, m);
        } catch {
          /* no sound */
        }
      }
      frame = f;
      at = Date.now();
    },
    () => (ended = true),
  );
  const timer = setInterval(() => (tick = Date.now()), 250);
  onDestroy(() => {
    stop();
    clearInterval(timer);
  });

  const pos = $derived.by(() => {
    try {
      return frame ? positionFromFen(frame.fen) : undefined;
    } catch {
      return undefined;
    }
  });
  const turn = $derived(pos?.turn ?? 'white');
  // Lichess sends no status while the game is on, then one when it ends.
  const finished = $derived(ended || (!!info?.status && !['started', 'created'].includes(info.status)));
  /** Clocks run down locally between moves. */
  const clock = (side: 'white' | 'black') => {
    const s = side === 'white' ? frame?.wc : frame?.bc;
    if (s === undefined) return undefined;
    const running = !finished && turn === side && pos && pos.fullmoves > 1;
    return Math.max(0, s * 1000 - (running ? tick - at : 0));
  };
  const lastMove = $derived(frame?.lm && frame.lm.length >= 4 ? ([frame.lm.slice(0, 2), frame.lm.slice(2, 4)] as Key[]) : undefined);
  const initials = (n: string) => n.slice(0, 2).toUpperCase();
  const resultText = $derived(
    !finished ? '' : info?.winner ? `${info.winner === 'white' ? info.white.name : info.black.name} won` : info?.status === 'draw' || info?.status === 'stalemate' ? 'Draw' : 'Game over',
  );

  async function analyse() {
    const res = await fetch(`https://lichess.org/game/export/${id}?clocks=false&evals=false`, { headers: { Accept: 'application/x-chess-pgn' } });
    if (!res.ok) return;
    sessionStorage.setItem('k24.importPgn', await res.text());
    goto('/analysis?import=1');
  }

  function bar(side: 'white' | 'black') {
    const p = side === 'white' ? info?.white : info?.black;
    return {
      name: `${p?.title ? `${p.title} ` : ''}${p?.name ?? '…'}`,
      subtitle: side === 'white' ? 'White' : 'Black',
      initials: initials(p?.name ?? '?'),
      rating: p?.rating ? String(p.rating) : undefined,
      toMove: !finished && turn === side,
      clockMs: clock(side),
    };
  }
  const other = $derived(orientation === 'white' ? 'black' : 'white');
</script>

<svelte:head><title>Live game · Chess Castles</title></svelte:head>

<div class="live">
  <div class="board-col">
    <PlayerBar {...bar(other)} />
    <div class="board-box">
      {#if pos}
        <Board fen={frame!.fen} {orientation} turnColor={turn} movable={undefined} {lastMove} check={pos.isCheck()} label="Live game board" />
      {:else}
        <div class="wait card">{ended ? 'This game could not be found on Lichess.' : 'Connecting to the game…'}</div>
      {/if}
    </div>
    <PlayerBar {...bar(orientation)} />
  </div>

  <aside class="side card">
    <span class="live-tag" class:over={finished}>{finished ? 'Finished' : '● Live'}</span>
    <h1 class="title">{info ? `${info.white.name} – ${info.black.name}` : 'Live game'}</h1>
    {#if info}<p class="label">{[info.speed && info.speed[0].toUpperCase() + info.speed.slice(1), info.clock, 'on Lichess'].filter(Boolean).join(' · ')}</p>{/if}
    {#if finished && resultText}<p class="result title">{resultText}</p>{/if}
    <div class="btns">
      <button class="btn" onclick={() => (orientation = other)}><Icon name="flip" size={16} />Flip board</button>
      {#if finished}<button class="btn primary" onclick={analyse}><Icon name="analyse" size={16} />Analyse this game</button>{/if}
    </div>
    <a class="label back" href="/friends"><Icon name="back" size={14} />Back to friends</a>
  </aside>
</div>

<style>
  .live {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    max-width: 1200px;
    margin: 0 auto;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 230px), 720px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wait {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    text-align: center;
  }
  .side {
    flex: 1 1 280px;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .side h1 {
    margin: 0;
    font-size: 21px;
  }
  .side p {
    margin: 0;
  }
  .live-tag {
    align-self: flex-start;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--loss) 20%, transparent);
    color: var(--loss);
  }
  .live-tag.over {
    background: var(--raised);
    color: var(--muted);
  }
  .result {
    font-size: 19px;
  }
  .btns {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .btns .btn {
    justify-content: center;
    gap: 6px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  @media (max-width: 767px) {
    .side {
      max-width: none;
    }
  }
</style>

<script lang="ts">
  /**
   * A model game on the board: it opens where the studied line ends, and the
   * student steps through it (or lets it play) with the move list beside it.
   */
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import { fenOf, keyOf, sanOf } from '$lib/chess/position';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { gamesDb } from '$lib/games/gamesDb';
  import { playMoveSound } from '$lib/sound';

  let { gameId, lineEnd, orientation = 'white', onclose }: { gameId: number; lineEnd?: string; orientation?: 'white' | 'black'; onclose?: () => void } = $props();

  let positions = $state<Chess[]>([]);
  let moves = $state<NormalMove[]>([]);
  let sans = $state<string[]>([]);
  let ply = $state(0);
  let title = $state('');
  let info = $state('');
  let failed = $state(false);
  let auto = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(async () => {
    try {
      const g = await gamesDb.game(untrack(() => gameId));
      if (!g) throw new Error('missing');
      const ps: Chess[] = [g.start.clone()];
      const ss: string[] = [];
      for (const m of g.moves) {
        const p = ps[ps.length - 1].clone();
        ss.push(sanOf(p, m));
        p.play(m);
        ps.push(p);
      }
      positions = ps;
      moves = g.moves;
      sans = ss;
      title = `${g.white} – ${g.black}`;
      info = [g.event, g.year || '', g.result.replace('1/2-1/2', '½-½')].filter(Boolean).join(' · ');
      // Start where the line ends (the first time the game reaches it).
      const at = lineEnd ? ps.findIndex((p) => polyglotKey(p).toString(16) === lineEnd) : -1;
      ply = at >= 0 ? at : Math.min(ps.length - 1, 16);
    } catch {
      failed = true;
    }
  });
  onDestroy(() => clearInterval(timer));

  function go(n: number) {
    const to = Math.max(0, Math.min(positions.length - 1, n));
    if (to === ply + 1 && moves[ply]) playMoveSound(positions[ply], moves[ply]);
    ply = to;
  }
  function toggleAuto() {
    auto = !auto;
    clearInterval(timer);
    if (auto)
      timer = setInterval(() => {
        if (ply >= positions.length - 1) {
          auto = false;
          clearInterval(timer);
        } else go(ply + 1);
      }, 1200);
  }
  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') go(ply + 1);
    else if (e.key === 'ArrowLeft') go(ply - 1);
  }

  const last = $derived<Key[] | undefined>(ply > 0 && moves[ply - 1] ? [keyOf(moves[ply - 1].from), keyOf(moves[ply - 1].to)] : undefined);
  const pos = $derived(positions[ply]);
  const keyNow = $derived(pos ? polyglotKey(pos).toString(16) : '');
</script>

<svelte:window onkeydown={onkey} />

<div class="viewer">
  {#if failed}
    <p class="card note">This game could not be loaded. Check your connection and try again.</p>
  {:else if !pos}
    <p class="card note">Loading the game…</p>
  {:else}
    <div class="board-col">
      <Board fen={fenOf(pos)} {orientation} turnColor={pos.turn} lastMove={last} check={pos.isCheck()} viewOnly label="Model game" onswipe={(d) => go(d === 'forward' ? ply + 1 : ply - 1)} />
      <MoveNav {ply} max={positions.length - 1} {go} />
    </div>
    <div class="side">
      <div class="head">
        <div>
          <span class="title">{title}</span>
          <span class="label">{info}</span>
        </div>
        {#if onclose}<button class="icon-btn" onclick={onclose} aria-label="Close the game"><Icon name="close" size={18} /></button>{/if}
      </div>
      <div class="btns">
        <button class="btn" onclick={toggleAuto}><Icon name={auto ? 'close' : 'play'} size={16} />{auto ? 'Stop' : 'Play through'}</button>
        <a class="btn ghost" href="/analysis?db={gameId}&key={keyNow}">Analyse</a>
      </div>
      <p class="moves">
        {#each sans as s, i (i)}
          {#if i % 2 === 0}<span class="no">{i / 2 + 1}.</span>{/if}
          <button class="mv" class:on={i + 1 === ply} onclick={() => (ply = i + 1)}>{s}</button>
        {/each}
      </p>
    </div>
  {/if}
</div>

<style>
  .viewer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 16px;
    align-items: start;
  }
  .board-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    max-width: 560px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .head > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .moves {
    margin: 0;
    max-height: 360px;
    overflow-y: auto;
    line-height: 1.9;
  }
  .no {
    color: var(--muted);
    font-size: 13px;
    margin: 0 2px 0 6px;
  }
  .mv {
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    padding: 1px 4px;
    border-radius: 6px;
    cursor: pointer;
  }
  .mv.on {
    background: var(--brand);
    color: var(--on-action);
  }
  .note {
    padding: 14px;
  }
  @media (max-width: 800px) {
    .viewer {
      grid-template-columns: 1fr;
    }
    .moves {
      max-height: 180px;
    }
  }
</style>

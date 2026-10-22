<script lang="ts">
  /**
   * A classroom board: the site's Board plus the coach's tools as everyone sees them: square names on every square,
   * pieces hidden (blindfold; the coach still sees them faintly), only the pawns, coloured squares, and the coach's
   * arrows and circles (drawn in the colour the coach picked).
   */
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Color, Dests, Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import type { Shape } from './api';

  let {
    fen,
    orientation = 'white',
    lastMove,
    check = false,
    movable,
    dests,
    shapes = [],
    autoShapes = [],
    marks = {},
    squares = false,
    blind = false,
    pawns = false,
    coach = false,
    brush = 'green',
    coordinates = true,
    label = 'Class board',
    onmove,
    premovable = false,
    queued = [],
    onpremove,
    ondraw,
    onselect,
  }: {
    fen: string;
    orientation?: Color;
    lastMove?: Key[];
    check?: boolean;
    movable?: Color | 'both';
    dests?: Dests;
    /** The coach's arrows and circles (kept by the room). */
    shapes?: Shape[];
    /** Shapes the page adds (a hint), not the coach's. */
    autoShapes?: DrawShape[];
    marks?: Record<string, string>;
    squares?: boolean;
    blind?: boolean;
    pawns?: boolean;
    coach?: boolean;
    /** The colour for new arrows (the coach's pick; Shift, Ctrl and Alt still give chessground's own colours). */
    brush?: string;
    coordinates?: boolean;
    label?: string;
    onmove?: (orig: Key, dest: Key) => void;
    /** Premoves (the game zone): moves made while the opponent thinks, queued by the page. */
    premovable?: boolean;
    queued?: Key[];
    onpremove?: (orig: Key, dest: Key) => void;
    ondraw?: (shapes: Shape[]) => void;
    onselect?: (key: Key) => void;
  } = $props();

  let board = $state<ReturnType<typeof Board>>();
  /** The board's own premove dropped (the page keeps the queue). */
  export function cancelPremove() {
    board?.cancelPremove();
    board?.unselect();
  }

  /** Only the pawns: the other pieces left out of the position shown. */
  const shown = $derived.by(() => {
    if (!pawns) return fen;
    const [placement, ...rest] = fen.split(' ');
    const rows = placement.split('/').map((row) => {
      let out = '';
      let empty = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) empty += Number(ch);
        else if (ch === 'p' || ch === 'P') {
          out += (empty ? String(empty) : '') + ch;
          empty = 0;
        } else empty++;
      }
      return out + (empty ? String(empty) : '');
    });
    return [rows.join('/'), ...rest].join(' ');
  });

  const drawn = $derived(shapes.map((s) => ({ orig: s.orig as Key, ...(s.dest ? { dest: s.dest as Key } : {}), brush: s.brush })) as DrawShape[]);

  /** New shapes drawn with no key held come out green: they take the coach's colour. */
  function changed(next: DrawShape[]) {
    if (!ondraw) return;
    const before = new Set(shapes.map((s) => `${s.orig}${s.dest ?? ''}`));
    ondraw(next.map((s) => ({ orig: s.orig, ...(s.dest ? { dest: s.dest } : {}), brush: !before.has(`${s.orig}${s.dest ?? ''}`) && s.brush === 'green' ? brush : (s.brush ?? 'green') })));
  }

  const FILES = 'abcdefgh';
  const names = $derived(
    Array.from({ length: 64 }, (_, i) => {
      const row = Math.floor(i / 8);
      const col = i % 8;
      return orientation === 'white' ? `${FILES[col]}${8 - row}` : `${FILES[7 - col]}${row + 1}`;
    }),
  );
</script>

<div class="cb" class:blind class:coach>
  <Board
    bind:this={board}
    fen={shown}
    {orientation}
    turnColor={fen.split(' ')[1] === 'b' ? 'black' : 'white'}
    {lastMove}
    {check}
    {movable}
    {dests}
    {drawn}
    shapes={autoShapes}
    {marks}
    {coordinates}
    {label}
    {onmove}
    {premovable}
    {queued}
    {onpremove}
    ondraw={ondraw ? changed : undefined}
    {onselect}
  />
  {#if squares}
    <div class="names" aria-hidden="true">
      {#each names as n (n)}<span>{n}</span>{/each}
    </div>
  {/if}
</div>

<style>
  .cb {
    position: relative;
  }
  .names {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(8, 1fr);
    pointer-events: none;
    z-index: 3;
    border-radius: 8px;
    overflow: hidden;
  }
  .names span {
    padding: 2px 4px;
    font: 700 clamp(9px, 1.4vw, 15px) / 1 var(--font-title);
    color: rgba(10, 18, 40, 0.75);
    text-shadow: 0 0 2px rgba(255, 255, 255, 0.7);
  }
  .blind :global(cg-board piece) {
    opacity: 0;
  }
  .blind.coach :global(cg-board piece) {
    opacity: 0.28;
  }
</style>

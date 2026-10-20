<script lang="ts">
  import { onMount } from 'svelte';
  import { Chessground } from '@lichess-org/chessground';
  import type { Api } from '@lichess-org/chessground/api';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Color, Dests, Key } from '@lichess-org/chessground/types';
  import '@lichess-org/chessground/assets/chessground.base.css';
  import '@lichess-org/chessground/assets/chessground.cburnett.css';
  import '$lib/pieceSets.css';

  let {
    fen,
    orientation = 'white',
    turnColor = 'white',
    movable,
    dests = new Map(),
    lastMove,
    check = false,
    shapes = [],
    premovable = false,
    queued = [],
    coordinates = true,
    viewOnly = false,
    label = 'Chess board',
    onmove,
    onpremove,
    onswipe,
  }: {
    fen: string;
    orientation?: Color;
    turnColor?: Color;
    /** Which side the viewer can move; undefined for none. */
    movable?: Color | 'both';
    dests?: Dests;
    lastMove?: Key[];
    check?: boolean;
    shapes?: DrawShape[];
    premovable?: boolean;
    /** Squares of queued premoves, drawn darker. */
    queued?: Key[];
    coordinates?: boolean;
    viewOnly?: boolean;
    label?: string;
    onmove?: (orig: Key, dest: Key) => void;
    onpremove?: (orig: Key, dest: Key) => void;
    /** A finger swipe on an empty part of the board (not a piece): step through the move history, as Lichess and chess.com do on phones. */
    onswipe?: (dir: 'back' | 'forward') => void;
  } = $props();

  // A swipe that didn't start on a piece (so it never competes with dragging one).
  // Listened for in the capture phase, straight on the wrapper: chessground attaches its
  // own handlers on the board underneath and stops them bubbling, so a plain bubble-phase
  // listener up here would never see a touch that started on the board at all.
  let touch: { x: number; y: number; t: number; onPiece: boolean } | undefined;
  function onpointerdown(e: PointerEvent) {
    if (!onswipe || e.pointerType !== 'touch') return;
    touch = { x: e.clientX, y: e.clientY, t: Date.now(), onPiece: !!(e.target as HTMLElement).closest('piece') };
  }
  function onpointerup(e: PointerEvent) {
    if (!touch) return;
    const { x, y, t, onPiece } = touch;
    touch = undefined;
    if (onPiece) return;
    const dx = e.clientX - x;
    const dy = e.clientY - y;
    if (Date.now() - t < 600 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) onswipe?.(dx < 0 ? 'forward' : 'back');
  }

  let wrap: HTMLDivElement;
  let el: HTMLDivElement;
  let cg: Api | undefined = $state();

  onMount(() => {
    const oncancel = () => (touch = undefined);
    wrap.addEventListener('pointerdown', onpointerdown, { capture: true, passive: true });
    wrap.addEventListener('pointerup', onpointerup, { capture: true, passive: true });
    wrap.addEventListener('pointercancel', oncancel, { capture: true, passive: true });
    cg = Chessground(el, {
      fen,
      orientation,
      coordinates,
      viewOnly,
      blockTouchScroll: true,
      animation: { enabled: true, duration: 140 },
      highlight: { lastMove: true, check: true },
      draggable: { showGhost: true },
      movable: { free: false, showDests: true, events: { after: (o, d) => onmove?.(o, d) } },
      premovable: {
        enabled: premovable,
        showDests: true,
        events: { set: (o, d) => onpremove?.(o, d) },
      },
      drawable: { enabled: true, visible: true },
    });
    const ro = new ResizeObserver(() => cg?.redrawAll());
    ro.observe(el);
    return () => {
      ro.disconnect();
      cg?.destroy();
      wrap.removeEventListener('pointerdown', onpointerdown, { capture: true });
      wrap.removeEventListener('pointerup', onpointerup, { capture: true });
      wrap.removeEventListener('pointercancel', oncancel, { capture: true });
    };
  });

  $effect(() => {
    if (!cg) return;
    const custom = new Map<Key, string>();
    for (const k of queued) custom.set(k, 'queued-premove');
    cg.set({
      fen,
      orientation,
      turnColor,
      lastMove,
      check: check ? turnColor : false,
      viewOnly,
      coordinates,
      highlight: { lastMove: true, check: true, custom },
      movable: { color: movable, dests: movable ? dests : new Map() },
      premovable: { enabled: premovable },
    });
    cg.setAutoShapes(shapes);
  });

  /** Clears the board's own premove (the page keeps its own queue). */
  export function cancelPremove() {
    cg?.cancelPremove();
  }

  /** Snaps the board back to its current `fen`: used after a promotion choice is cancelled,
   * since chessground had already moved the pawn to the back rank on its own. */
  export function resync() {
    cg?.set({ fen });
  }
</script>

<div class="board" role="group" aria-label={label} bind:this={wrap}>
  <div bind:this={el} class="cg-host"></div>
</div>

<style>
  .board {
    width: 100%;
    aspect-ratio: 1;
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow);
    touch-action: none;
  }
  .cg-host {
    width: 100%;
    height: 100%;
  }
  /* Custom shapes (move badges) may reach past their square's centre box. */
  .cg-host :global(.cg-custom-svgs svg) {
    overflow: visible;
  }
  .cg-host :global(.cg-wrap) {
    width: 100%;
    height: 100%;
  }
</style>

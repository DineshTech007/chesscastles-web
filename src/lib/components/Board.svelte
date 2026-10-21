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
  /**
   * Whether a touch at (x, y) is on a piece. Asked of the board itself: chessground's pieces don't take pointer
   * events (the touch's target is the board, never the piece), so looking for a piece element found none, and a
   * quick sideways drag of a piece also counted as a swipe, stepping the game back while it was being played.
   */
  const pieceAt = (x: number, y: number) => {
    const k = cg?.getKeyAtDomPos([x, y]);
    return !!k && !!cg?.state.pieces.has(k);
  };
  /**
   * A piece under the finger or close to it (0.4 of a square): on a phone a square is about 45 px and a finger often
   * lands on the edge of the next one; a drag meant for a piece must never become a swipe. (A swipe from the middle
   * of an empty square stays a swipe.)
   */
  const nearPiece = (x: number, y: number) => {
    const reach = ((cg?.state.dom.bounds().width ?? 0) / 8) * 0.4;
    return [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach]].some(([dx, dy]) => pieceAt(x + dx, y + dy));
  };
  function onpointerdown(e: PointerEvent) {
    // Chessground remembers where the board was; on a phone, anything appearing or going above the board (a
    // clock, a banner, a dialog) moves it without a scroll or a resize, and a drag with the old place drops the
    // piece on the wrong square, so it jumps back. Measured afresh at the start of every touch (this runs before
    // chessground's own touchstart).
    cg?.state.dom.bounds.clear();
    if (!onswipe || e.pointerType !== 'touch') return;
    touch = { x: e.clientX, y: e.clientY, t: Date.now(), onPiece: nearPiece(e.clientX, e.clientY) || !!(e.target as HTMLElement).closest('piece') };
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
      // Chessground selects the touched square as a touch begins (a tap or the start of a drag), empty or not: a
      // touch that begins on a piece is never a swipe, whatever the geometry says.
      events: { select: (key) => void (touch && cg?.state.pieces.has(key) && (touch.onPiece = true)) },
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
  });
  // The arrows on their own (an engine's arrow changes several times a second): redrawing the position, legal moves
  // and all for each one made dragging a piece jerky.
  $effect(() => {
    cg?.setAutoShapes(shapes);
  });

  /** Clears the board's own premove (the page keeps its own queue). */
  export function cancelPremove() {
    cg?.cancelPremove();
  }

  /** Drops the piece the board has picked up (after a premove that could not be played: the next tap starts afresh). */
  export function unselect() {
    cg?.selectSquare(null);
  }

  /** Snaps the board back to its current `fen`: used after a promotion choice is cancelled,
   * since chessground had already moved the pawn to the back rank on its own. Its turn and legal moves too: it
   * had also passed the turn on and dropped the moves, so the pawn could not be moved again (owner, 2026-10-21). */
  export function resync() {
    cg?.selectSquare(null);
    cg?.set({ fen, turnColor, lastMove, check: check ? turnColor : false, movable: { color: movable, dests: movable ? dests : new Map() } });
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

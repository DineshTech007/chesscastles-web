<script lang="ts">
  import { onMount } from 'svelte';
  import { Chessground } from '@lichess-org/chessground';
  import type { Api } from '@lichess-org/chessground/api';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Color, Dests, Key } from '@lichess-org/chessground/types';
  import '@lichess-org/chessground/assets/chessground.base.css';
  import '@lichess-org/chessground/assets/chessground.cburnett.css';

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
  } = $props();

  let el: HTMLDivElement;
  let cg: Api | undefined = $state();

  onMount(() => {
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
</script>

<div class="board" role="group" aria-label={label}>
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

<script lang="ts">
  /**
   * Set up any position: clear the board, tap a piece below then tap
   * squares to place it (tap again to remove), choose who is to move, and
   * analyse it. Castling rights follow from where the kings and rooks stand.
   * Dragging works too (owner, 2026-10-22: "we can't drag the pieces"): a piece on the board to another square, off
   * the board to take it away, or one from the pieces below straight onto a square.
   * The ✕ at the top closes it (and Esc); taking pieces off is the eraser, not a ✕ (owner, 2026-10-22: the old ✕
   * eraser looked like a close button that "is not working").
   */
  import { positionFromFen } from '$lib/chess/position';
  import '@lichess-org/chessground/assets/chessground.base.css';
  import '@lichess-org/chessground/assets/chessground.cburnett.css';
  import { t } from '$lib/i18n';

  let {
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    onapply,
    oncancel,
    applyLabel,
    title = '',
  }: {
    fen?: string;
    onapply: (fen: string) => void;
    oncancel: () => void;
    /** The confirm button (a class board: "Put on the class board"); "Analyse this position" when not given. */
    applyLabel?: string;
    /** A heading beside the close button, when the page around has none. */
    title?: string;
  } = $props();

  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const ROLE: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

  /** a8..h8, a7..h1: one character per square ('' for empty). */
  const parse = (placement: string) => placement.split('/').flatMap((row) => row.split('').flatMap((c) => (/\d/.test(c) ? Array(Number(c)).fill('') : [c])));
  // svelte-ignore state_referenced_locally
  let squares = $state<string[]>(parse(fen.split(' ')[0]));
  // svelte-ignore state_referenced_locally
  let turn = $state<'w' | 'b'>(fen.split(' ')[1] === 'b' ? 'b' : 'w');
  let tool = $state<string>('P');
  let flipped = $state(false);

  const placement = $derived(
    Array.from({ length: 8 }, (_, r) => {
      let s = '';
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const c = squares[r * 8 + f];
        if (c) {
          s += (empty || '') + c;
          empty = 0;
        } else empty++;
      }
      return s + (empty || '');
    }).join('/'),
  );
  /** Castling where king and rook still stand on their first squares. */
  const castling = $derived(
    [squares[60] === 'K' && squares[63] === 'R' ? 'K' : '', squares[60] === 'K' && squares[56] === 'R' ? 'Q' : '', squares[4] === 'k' && squares[7] === 'r' ? 'k' : '', squares[4] === 'k' && squares[0] === 'r' ? 'q' : ''].join('') || '-',
  );
  const full = $derived(`${placement} ${turn} ${castling} - 0 1`);
  const problem = $derived.by(() => {
    const kings = (c: string) => squares.filter((x) => x === c).length;
    if (kings('K') !== 1 || kings('k') !== 1) return $t('kidsclass.editor.oneKing');
    if (squares.slice(0, 8).some((c) => c.toLowerCase() === 'p') || squares.slice(56).some((c) => c.toLowerCase() === 'p')) return $t('kidsclass.editor.pawnRank');
    try {
      positionFromFen(full);
      return '';
    } catch {
      return $t('kidsclass.editor.inCheck');
    }
  });

  // ----- dragging (mouse and touch): a tap stays a tap; a move of a few pixels is a drag.
  let boardEl = $state<HTMLDivElement>();
  let drag = $state<{ piece: string; from: number | null; x: number; y: number; size: number; moved: boolean } | undefined>();
  /** The click that follows a drop is not a tap. */
  let dropped = false;
  function startDrag(e: PointerEvent, piece: string, from: number | null) {
    if (!piece || (e.pointerType === 'mouse' && e.button !== 0) || !boardEl) return;
    const size = boardEl.getBoundingClientRect().width / 8;
    const sx = e.clientX;
    const sy = e.clientY;
    drag = { piece, from, x: sx, y: sy, size, moved: false };
    const move = (ev: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      drag = { ...drag, x: ev.clientX, y: ev.clientY, moved: true };
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = drag;
      drag = undefined;
      if (!d?.moved || ev.type === 'pointercancel') return;
      dropped = true;
      setTimeout(() => (dropped = false), 60);
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-sq]');
      const to = el ? Number(el.getAttribute('data-sq')) : -1;
      if (to >= 0) {
        if (d.from !== null) squares[d.from] = '';
        squares[to] = d.piece;
      } else if (d.from !== null) squares[d.from] = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /**
   * The dragged piece is drawn on the page itself: inside a dialog that is moved with a transform (CastlesClass), a
   * fixed position counts from the dialog, and the piece showed away from the finger (owner, 2026-10-22).
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function tap(i: number) {
    if (dropped) return;
    if (tool === 'x') squares[i] = '';
    else squares[i] = squares[i] === tool ? '' : tool;
  }
  const order = $derived(flipped ? [...Array(64).keys()].reverse() : [...Array(64).keys()]);
  const pieceClass = (c: string) => `${c === c.toUpperCase() ? 'white' : 'black'} ${ROLE[c.toLowerCase()]}`;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !drag && oncancel()} />

<div class="editor">
  <div class="cg-wrap board" class:flipped bind:this={boardEl}>
    {#each order as i (i)}
      {@const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1}
      <button class="sq" class:dark data-sq={i} onpointerdown={(e) => startDrag(e, squares[i], i)} onclick={() => tap(i)} aria-label="{'abcdefgh'[i % 8]}{8 - Math.floor(i / 8)}{squares[i] ? `: ${pieceClass(squares[i])}` : ''}">
        {#if squares[i] && !(drag?.moved && drag.from === i)}<piece class={pieceClass(squares[i])}></piece>{/if}
      </button>
    {/each}
  </div>
  {#if drag?.moved}
    <div class="cg-wrap drag-ghost" use:portal style="left: {drag.x - drag.size / 2}px; top: {drag.y - drag.size / 2}px; width: {drag.size}px; height: {drag.size}px" aria-hidden="true">
      <piece class={pieceClass(drag.piece)}></piece>
    </div>
  {/if}

  <div class="side">
    <div class="head">
      {#if title}<h2>{title}</h2>{/if}
      <button class="close" onclick={oncancel} aria-label={$t('kidsclass.editor.close')} title={$t('kidsclass.editor.close')}>✕</button>
    </div>
    <div class="cg-wrap palette" role="radiogroup" aria-label="Piece to place">
      {#each ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'] as c (c)}
        <button class="pick" class:on={tool === c} role="radio" aria-checked={tool === c} aria-label={pieceClass(c)} onpointerdown={(e) => startDrag(e, c, null)} onclick={() => !dropped && (tool = c)}><piece class={pieceClass(c)}></piece></button>
      {/each}
      <button class="pick erase" class:on={tool === 'x'} role="radio" aria-checked={tool === 'x'} aria-label={$t('kidsclass.editor.removeTitle')} title={$t('kidsclass.editor.removeTitle')} onclick={() => (tool = 'x')}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15.2 3.6a2 2 0 0 1 2.8 0l3.4 3.4a2 2 0 0 1 0 2.8L11.6 19.6H20v1.9H8.4L3.6 16.7a2 2 0 0 1 0-2.8z" fill="currentColor" opacity=".35" /><path d="M15.2 3.6a2 2 0 0 1 2.8 0l3.4 3.4a2 2 0 0 1 0 2.8l-6 6-6.2-6.2z" fill="currentColor" /></svg>
        <span class="erase-label">{$t('kidsclass.editor.remove')}</span>
      </button>
    </div>
    <p class="label hint">{$t('kidsclass.editor.hint')}</p>

    <div class="segmented" role="group" aria-label="To move">
      <button aria-pressed={turn === 'w'} onclick={() => (turn = 'w')}>{$t('kidsclass.editor.white')}</button>
      <button aria-pressed={turn === 'b'} onclick={() => (turn = 'b')}>{$t('kidsclass.editor.black')}</button>
    </div>
    <div class="row">
      <button class="btn" onclick={() => (squares = Array(64).fill(''))}>{$t('kidsclass.editor.clear')}</button>
      <button class="btn" onclick={() => (squares = parse(START))}>{$t('kidsclass.editor.start')}</button>
      <button class="btn" onclick={() => (flipped = !flipped)}>{$t('kidsclass.editor.flip')}</button>
    </div>
    <code class="fen">{full}</code>
    {#if problem}<p class="err">{problem}</p>{/if}
    <div class="row">
      <button class="btn primary" disabled={!!problem} onclick={() => onapply(full)}>{applyLabel ?? $t('kidsclass.editor.analyse')}</button>
      <button class="btn ghost" onclick={oncancel}>{$t('kidsclass.editor.cancel')}</button>
    </div>
  </div>
</div>

<style>
  .editor {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .board {
    position: relative;
    flex: 0 1 min(100%, 520px);
    aspect-ratio: 1;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }
  .sq {
    position: relative;
    border: 0;
    padding: 0;
    background: var(--board-light);
    cursor: pointer;
    /* A finger dragging a piece doesn't scroll the page. */
    touch-action: none;
  }
  /* The piece being dragged (not .ghost: the Cancel button is a .btn.ghost and took this style). */
  .drag-ghost {
    position: fixed;
    z-index: 200;
    pointer-events: none;
    filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.45));
    transform: scale(1.12);
  }
  .sq.dark {
    background: var(--board-dark);
  }
  .sq:hover {
    box-shadow: inset 0 0 0 3px var(--gold);
  }
  .cg-wrap piece {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .side {
    flex: 1 1 280px;
    /* Never wider than the dialog on a phone (it scrolled sideways and hid the close button). */
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .palette {
    position: relative;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .pick {
    position: relative;
    touch-action: none;
    aspect-ratio: 1;
    border: 2px solid var(--border);
    border-radius: 8px;
    background: var(--raised);
    cursor: pointer;
    color: var(--text);
    font-size: 18px;
    font-weight: 800;
  }
  .pick.on {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 22%, var(--raised));
  }
  .erase {
    grid-row: span 2;
    grid-column: 7;
    grid-row-start: 1;
    aspect-ratio: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 1px;
  }
  .erase-label {
    max-width: 100%;
    font-size: 9.5px;
    font-weight: 700;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .head h2 {
    margin: 0;
    font-size: 18px;
  }
  .close {
    margin-left: auto;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
  }
  .close:hover {
    border-color: var(--gold);
  }
  .hint {
    margin: 0;
    font-size: 13px;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .fen {
    font-size: 12px;
    word-break: break-all;
    color: var(--muted);
  }
  .err {
    margin: 0;
    color: var(--loss);
    font-size: 14px;
  }
</style>

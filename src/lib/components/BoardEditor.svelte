<script lang="ts">
  /**
   * Set up any position: clear the board, tap a piece below then tap
   * squares to place it (tap again to remove), choose who is to move, and
   * analyse it. Castling rights follow from where the kings and rooks stand.
   */
  import { positionFromFen } from '$lib/chess/position';
  import '@lichess-org/chessground/assets/chessground.base.css';
  import '@lichess-org/chessground/assets/chessground.cburnett.css';

  let { fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', onapply, oncancel }: { fen?: string; onapply: (fen: string) => void; oncancel: () => void } = $props();

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
    if (kings('K') !== 1 || kings('k') !== 1) return 'Each side needs exactly one king.';
    if (squares.slice(0, 8).some((c) => c.toLowerCase() === 'p') || squares.slice(56).some((c) => c.toLowerCase() === 'p')) return 'Pawns cannot stand on the first or last rank.';
    try {
      positionFromFen(full);
      return '';
    } catch {
      return `This position is not possible: the side not to move is in check.`;
    }
  });

  function tap(i: number) {
    if (tool === 'x') squares[i] = '';
    else squares[i] = squares[i] === tool ? '' : tool;
  }
  const order = $derived(flipped ? [...Array(64).keys()].reverse() : [...Array(64).keys()]);
  const pieceClass = (c: string) => `${c === c.toUpperCase() ? 'white' : 'black'} ${ROLE[c.toLowerCase()]}`;
</script>

<div class="editor">
  <div class="cg-wrap board" class:flipped>
    {#each order as i (i)}
      {@const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1}
      <button class="sq" class:dark onclick={() => tap(i)} aria-label="{'abcdefgh'[i % 8]}{8 - Math.floor(i / 8)}{squares[i] ? `: ${pieceClass(squares[i])}` : ''}">
        {#if squares[i]}<piece class={pieceClass(squares[i])}></piece>{/if}
      </button>
    {/each}
  </div>

  <div class="side">
    <div class="cg-wrap palette" role="radiogroup" aria-label="Piece to place">
      {#each ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'] as c (c)}
        <button class="pick" class:on={tool === c} role="radio" aria-checked={tool === c} aria-label={pieceClass(c)} onclick={() => (tool = c)}><piece class={pieceClass(c)}></piece></button>
      {/each}
      <button class="pick erase" class:on={tool === 'x'} role="radio" aria-checked={tool === 'x'} aria-label="Remove pieces" onclick={() => (tool = 'x')}>✕</button>
    </div>
    <p class="label hint">Tap a piece, then tap squares to place it. Tap a piece on the board again to remove it.</p>

    <div class="segmented" role="group" aria-label="To move">
      <button aria-pressed={turn === 'w'} onclick={() => (turn = 'w')}>White to move</button>
      <button aria-pressed={turn === 'b'} onclick={() => (turn = 'b')}>Black to move</button>
    </div>
    <div class="row">
      <button class="btn" onclick={() => (squares = Array(64).fill(''))}>Clear board</button>
      <button class="btn" onclick={() => (squares = parse(START))}>Start position</button>
      <button class="btn" onclick={() => (flipped = !flipped)}>Flip</button>
    </div>
    <code class="fen">{full}</code>
    {#if problem}<p class="err">{problem}</p>{/if}
    <div class="row">
      <button class="btn primary" disabled={!!problem} onclick={() => onapply(full)}>Analyse this position</button>
      <button class="btn ghost" onclick={oncancel}>Cancel</button>
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
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .palette {
    position: relative;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }
  .pick {
    position: relative;
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

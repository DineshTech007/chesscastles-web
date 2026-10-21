<script lang="ts">
  /** The coach's own answer for one diagram: typed in SAN ("1. Rd8+ Kh7 2. Re7") or played on the board, both sides. */
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { makeUci, parseUci } from 'chessops/util';
  import { makeFen } from 'chessops/fen';
  import Board from '$lib/components/Board.svelte';
  import { destsOf, keyOf, moveFromKeys, positionFromFen } from '$lib/chess/position';
  import { promotionFor } from '$lib/chess/promotion';
  import { sanLine } from '../tasks';
  import { readLine } from './solutions';

  let { fen, line = [], onsave, oncancel }: { fen: string; line?: string[]; onsave: (line: string[]) => void; oncancel: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let moves = $state<string[]>([...line]);
  let typed = $state('');
  let typedNote = $state('');
  let remount = $state(0);

  const at = $derived.by(() => {
    try {
      const pos = positionFromFen(fen);
      let last: Key[] | undefined;
      for (const u of moves) {
        const m = parseUci(u) as NormalMove | undefined;
        if (!m || !pos.isLegal(m)) break;
        pos.play(m);
        last = [keyOf(m.from), keyOf(m.to)];
      }
      return { pos, fen: makeFen(pos.toSetup()), last };
    } catch {
      return undefined;
    }
  });

  async function onmove(orig: Key, dest: Key) {
    if (!at) return;
    const role = await promotionFor(at.pos, orig, dest);
    if (role === null) return void remount++;
    moves = [...moves, makeUci(moveFromKeys(at.pos, orig, dest, role ?? undefined))];
    typed = '';
    typedNote = '';
  }
  function read() {
    const r = readLine(fen, typed, true);
    moves = r.moves;
    typedNote = !typed.trim() ? '' : r.moves.length ? `Read ${r.moves.length} ${r.moves.length === 1 ? 'move' : 'moves'}.` : 'No legal move found from this position.';
  }
</script>

<div class="edit">
  {#if at}
    {#key remount}
      <Board fen={at.fen} orientation={fen.split(' ')[1] === 'b' ? 'black' : 'white'} turnColor={at.pos.turn} movable={at.pos.isEnd() ? undefined : at.pos.turn} dests={destsOf(at.pos)} lastMove={at.last} {onmove} label="Play the answer" />
    {/key}
  {/if}
  <div class="side">
    <p class="line">{moves.length ? sanLine(fen, moves) : 'Play the answer on the board (both sides), or type it below.'}</p>
    <label class="field">
      <span class="muted small">Type it (SAN)</span>
      <input bind:value={typed} oninput={read} placeholder="1. Rd8+ Kh7 2. Re7" aria-label="The answer in SAN" />
    </label>
    {#if typedNote}<span class="muted small">{typedNote}</span>{/if}
    <div class="row">
      <button class="btn" onclick={() => (moves = moves.slice(0, -1))} disabled={!moves.length}>Undo</button>
      <button class="btn ghost" onclick={() => ((moves = []), (typed = ''))} disabled={!moves.length}>Clear</button>
    </div>
    <div class="row end">
      <button class="btn ghost" onclick={oncancel}>Cancel</button>
      <button class="btn primary" disabled={!moves.length} onclick={() => onsave(moves)}>Use this answer</button>
    </div>
  </div>
</div>

<style>
  .edit {
    display: grid;
    grid-template-columns: minmax(0, 360px) 1fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 720px) {
    .edit {
      grid-template-columns: 1fr;
    }
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .line {
    margin: 0;
    font: 700 17px var(--font-title);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field input {
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    font: 600 15px var(--font-body);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row.end {
    justify-content: flex-end;
  }
</style>

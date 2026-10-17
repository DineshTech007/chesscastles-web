<script lang="ts" module>
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';

  /** A move in the analysis tree: the first child is the main line, the others are variations. */
  export interface TNode {
    id: number;
    move?: NormalMove;
    san: string;
    after: Chess;
    parent?: TNode;
    children: TNode[];
  }
</script>

<script lang="ts">
  /**
   * The moves of an analysis as a tree: the main line in two columns, and
   * variations in brackets after the move they branch from (nested ones in
   * brackets inside). Click any move to go there.
   */
  import type { MoveClass } from '$lib/review/badges';
  import MoveBadge from '$lib/review/MoveBadge.svelte';
  import { revealIn } from '$lib/scroll';

  let {
    root,
    current,
    version = 0,
    badges = new Map(),
    onselect,
  }: {
    root: TNode;
    current: TNode;
    /** Bumped when the tree changes (the tree itself is not reactive). */
    version?: number;
    badges?: Map<number, MoveClass>;
    onselect: (n: TNode) => void;
  } = $props();

  /** "12." for White, "12..." for Black, from the position before the move. */
  const numberOf = (n: TNode) => {
    const p = n.parent!.after;
    return p.turn === 'white' ? `${p.fullmoves}.` : `${p.fullmoves}...`;
  };
  const isWhite = (n: TNode) => n.parent!.after.turn === 'white';

  type Item = { kind: 'row'; no: number; white?: TNode; black?: TNode } | { kind: 'vars'; vars: TNode[] };

  const items = $derived.by((): Item[] => {
    void version;
    const out: Item[] = [];
    let row: Extract<Item, { kind: 'row' }> | undefined;
    for (let n = root.children[0]; n; n = n.children[0]) {
      const p = n.parent!.after;
      if (isWhite(n)) {
        row = { kind: 'row', no: p.fullmoves, white: n };
        out.push(row);
      } else if (row && row.no === p.fullmoves && !row.black) {
        row.black = n;
      } else {
        row = { kind: 'row', no: p.fullmoves, black: n };
        out.push(row);
      }
      // Variations of this move: they break the row, which continues after them.
      const alts = n.parent!.children.slice(1);
      if (alts.length) {
        out.push({ kind: 'vars', vars: alts });
        row = undefined;
      }
    }
    return out;
  });

  let box: HTMLDivElement | undefined = $state();
  $effect(() => {
    void current;
    void version;
    queueMicrotask(() => revealIn(box, box?.querySelector('.cur')));
  });
</script>

{#snippet mv(n: TNode, label = '')}
  <button class="mv" class:cur={n === current} onclick={() => onselect(n)}>
    {#if label}<span class="vno">{label}</span>{/if}
    {n.san}
    {#if badges.get(n.id) && badges.get(n.id) !== 'good'}<MoveBadge kind={badges.get(n.id)!} size={22} />{/if}
  </button>
{/snippet}

{#snippet line(start: TNode, first: boolean)}
  {@const chain = (() => {
    const out: TNode[] = [];
    for (let n: TNode | undefined = start; n; n = n.children[0]) out.push(n);
    return out;
  })()}
  {#each chain as n, i (n.id)}
    {@render mv(n, isWhite(n) || (i === 0 && first) || (i > 0 && chain[i - 1].children.length > 1) ? numberOf(n) : '')}
    {#each n.children.slice(1) as alt (alt.id)}
      <span class="paren">(</span>{@render line(alt, true)}<span class="paren">)</span>
    {/each}
  {/each}
{/snippet}

<!-- A region, not a list: variations sit between the move rows. -->
<div class="tree" bind:this={box} role="region" aria-label="Moves">
  {#if !items.length}
    <p class="empty label">No moves yet. Move a piece on the board to start.</p>
  {/if}
  {#each items as it, k (k)}
    {#if it.kind === 'row'}
      <div class="row">
        <span class="no num">{it.no}.</span>
        {#if it.white}{@render mv(it.white)}{:else}<span class="mv dots">…</span>{/if}
        {#if it.black}{@render mv(it.black)}{:else}<span class="mv"></span>{/if}
      </div>
    {:else}
      <div class="vars">
        {#each it.vars as v (v.id)}
          <div class="var">{@render line(v, true)}</div>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .tree {
    overflow-y: auto;
    padding: 6px 0;
    font-size: 15px;
  }
  .empty {
    padding: 8px 14px;
    margin: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 44px 1fr 1fr;
    align-items: center;
    padding: 0 8px;
  }
  .row:nth-child(even) {
    background: color-mix(in srgb, var(--raised) 50%, transparent);
  }
  .no {
    color: var(--muted);
    font-size: 13px;
  }
  .mv {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 30px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .row .mv :global(.badge) {
    margin-left: auto;
  }
  .mv.dots {
    color: var(--muted);
    cursor: default;
  }
  .mv:hover:not(.dots) {
    background: var(--raised);
  }
  .mv.cur {
    background: var(--action);
    color: var(--on-action);
  }
  .vars {
    margin: 2px 8px 4px 44px;
    padding: 4px 8px;
    border-left: 3px solid var(--gold);
    border-radius: 0 8px 8px 0;
    background: color-mix(in srgb, var(--gold) 7%, transparent);
    font-size: 14px;
  }
  .var {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 2px;
  }
  .var .mv {
    min-height: 26px;
    padding: 0 5px;
    font-weight: 500;
  }
  .vno {
    color: var(--muted);
    font-weight: 500;
  }
  .mv.cur .vno {
    color: inherit;
  }
  .paren {
    color: var(--muted);
    padding: 0 1px;
  }
</style>

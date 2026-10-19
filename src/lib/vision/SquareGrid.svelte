<script lang="ts">
  /**
   * An empty board to answer on by tapping squares (for the Blindfold Gym):
   * coordinates on every square edge, chosen squares marked, and the right
   * and wrong ones shown after the answer.
   */
  let {
    chosen = [],
    right = [],
    wrong = [],
    missed = [],
    orientation = 'white',
    disabled = false,
    ontap,
  }: {
    chosen?: string[];
    right?: string[];
    wrong?: string[];
    missed?: string[];
    orientation?: 'white' | 'black';
    disabled?: boolean;
    ontap?: (square: string) => void;
  } = $props();

  const files = $derived(orientation === 'white' ? 'abcdefgh'.split('') : 'hgfedcba'.split(''));
  const ranks = $derived(orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]);
</script>

<div class="grid" role="group" aria-label="Board: tap a square">
  {#each ranks as r, ri (r)}
    {#each files as f, fi (f)}
      {@const s = `${f}${r}`}
      {@const light = ('abcdefgh'.indexOf(f) + r) % 2 === 0}
      <button
        class="sq"
        class:light
        class:chosen={chosen.includes(s)}
        class:right={right.includes(s)}
        class:wrong={wrong.includes(s)}
        class:missed={missed.includes(s)}
        {disabled}
        aria-label={s}
        aria-pressed={chosen.includes(s)}
        onclick={() => ontap?.(s)}
      >
        {#if fi === 0}<span class="rk">{r}</span>{/if}
        {#if ri === 7}<span class="fl">{f}</span>{/if}
      </button>
    {/each}
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .sq {
    position: relative;
    border: 0;
    padding: 0;
    background: #b58863;
    cursor: pointer;
  }
  .sq.light {
    background: #f0d9b5;
  }
  .sq:disabled {
    cursor: default;
  }
  .sq:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .sq.chosen::after,
  .sq.right::after,
  .sq.wrong::after,
  .sq.missed::after {
    content: '';
    position: absolute;
    inset: 22%;
    border-radius: 50%;
  }
  .sq.chosen::after {
    background: color-mix(in srgb, var(--brand) 75%, transparent);
  }
  .sq.right::after {
    background: var(--win);
  }
  .sq.wrong::after {
    background: var(--loss);
  }
  .sq.missed::after {
    inset: 26%;
    background: transparent;
    border: 4px solid var(--gold);
  }
  .rk,
  .fl {
    position: absolute;
    font-size: 11px;
    font-weight: 700;
    color: #37474f;
    opacity: 0.8;
  }
  .rk {
    top: 2px;
    left: 3px;
  }
  .fl {
    bottom: 1px;
    right: 3px;
  }
</style>

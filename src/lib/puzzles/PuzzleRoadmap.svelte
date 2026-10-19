<script lang="ts">
  /**
   * The puzzle road map: the player's level (Pawn to King), how far to the
   * next, the rating along the last puzzles, and the counts.
   */
  import { PUZZLE_LEVELS, levelOf } from './bank';
  import { puzzleHistory, puzzleStats } from './rating';

  const lv = $derived(levelOf($puzzleStats.rating));
  /** The last 60 ratings, for the line. */
  const line = $derived.by(() => {
    const h = $puzzleHistory.slice(-60);
    if (h.length < 2) return '';
    const rs = h.map((x) => x.r);
    const lo = Math.min(...rs) - 10;
    const hi = Math.max(...rs) + 10;
    return h.map((x, i) => `${i ? 'L' : 'M'}${((i / (h.length - 1)) * 100).toFixed(2)},${((1 - (x.r - lo) / (hi - lo)) * 100).toFixed(2)}`).join(' ');
  });
  const solvedPct = $derived($puzzleStats.attempted ? Math.round((100 * $puzzleStats.solved) / $puzzleStats.attempted) : 0);
</script>

<section class="card road" aria-label="Your puzzle road map">
  <div class="now">
    <span class="glyph" aria-hidden="true">{lv.level.glyph}</span>
    <div>
      <span class="label">Puzzle rating</span>
      <strong class="display num big">{$puzzleStats.rating}</strong>
      <span class="label">{lv.level.name} level</span>
    </div>
  </div>

  <div class="path">
    <ol class="steps" aria-label="Levels">
      {#each PUZZLE_LEVELS as l (l.name)}
        <li class:reached={$puzzleStats.rating >= l.from} class:here={l === lv.level}>
          <span class="dot" aria-hidden="true">{l.glyph}</span>
          <span class="nm">{l.name}</span>
          <span class="label num">{l.from || ''}</span>
        </li>
      {/each}
    </ol>
    {#if lv.next}
      <div class="meter" aria-hidden="true"><span style="width: {Math.round(lv.progress * 100)}%"></span></div>
      <span class="label">{lv.next.from - $puzzleStats.rating} points to {lv.next.name}</span>
    {:else}
      <span class="label">The top level. Keep your crown!</span>
    {/if}
  </div>

  <div class="counts">
    <span><strong class="num">{$puzzleStats.solved}</strong><span class="label">solved</span></span>
    <span><strong class="num">{solvedPct}%</strong><span class="label">first try</span></span>
    <span><strong class="num">{$puzzleStats.streak}</strong><span class="label">streak</span></span>
    <span><strong class="num">{$puzzleStats.best}</strong><span class="label">best streak</span></span>
  </div>

  {#if line}
    <svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Your puzzle rating over your last {Math.min(60, $puzzleHistory.length)} puzzles">
      <path d={line} fill="none" stroke="var(--series-1)" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>
  {/if}
</section>

<style>
  .road {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 14px 24px;
    align-items: center;
  }
  .now {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .now > div {
    display: flex;
    flex-direction: column;
  }
  .glyph {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--gold-soft);
    color: var(--gold);
    font-size: 34px;
  }
  .big {
    font-size: 34px;
    line-height: 1;
  }
  .path {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px;
  }
  .steps li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    opacity: 0.45;
    font-size: 13px;
  }
  .steps li.reached {
    opacity: 1;
  }
  .steps li.here .dot {
    background: var(--gold);
    color: var(--on-action);
  }
  .dot {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--raised);
    font-size: 17px;
  }
  .nm {
    font-weight: 600;
  }
  .meter {
    height: 8px;
    border-radius: 4px;
    background: var(--raised);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--gold);
    border-radius: 4px;
  }
  .counts {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 6px 18px;
  }
  .counts span {
    display: flex;
    flex-direction: column;
  }
  .counts strong {
    font-size: 20px;
  }
  .spark {
    grid-column: 1 / -1;
    width: 100%;
    height: 44px;
  }
  /* Phones: one compact strip (rating, level, points to the next), so the board fits on screen. */
  @media (max-width: 760px) {
    .road {
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px 14px;
      padding: 10px 14px;
    }
    .glyph {
      width: 40px;
      height: 40px;
      font-size: 24px;
    }
    .big {
      font-size: 26px;
    }
    .steps,
    .counts,
    .spark {
      display: none;
    }
  }
</style>

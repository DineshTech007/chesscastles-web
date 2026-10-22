<script lang="ts">
  /**
   * After a puzzle, right under the board (owner's request, 2026-10-21: "nice UI after they solve, the puzzle's
   * rating and their own, and how to climb"): how it went with up to three stars, the rating moving to its new
   * value, this puzzle's rating, the level trophy and the points to the next one, and Next. During placement (a new
   * player's first rated puzzles, rating provisional) how far the level search has come, and after its last puzzle
   * the rating revealed, counting up.
   */
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { levelOf, PLACEMENT, stageOf } from './bank';

  let {
    solved,
    stars,
    puzzleRating,
    before,
    change,
    placement,
    themes = '',
    onnext,
    busy = false,
  }: {
    solved: boolean;
    stars: number;
    /** The puzzle's own rating. */
    puzzleRating: number;
    /** The player's rating before this puzzle. */
    before: number;
    /** How it moved (undefined: not rated, e.g. a puzzle seen before, or not saved). */
    change?: number;
    /** For a placement puzzle: the rated puzzles done so far (PLACEMENT: the level is found, the rating revealed). */
    placement?: number;
    themes?: string;
    onnext: () => void;
    busy?: boolean;
  } = $props();

  const after = $derived(before + (change ?? 0));
  const placing = $derived(placement !== undefined && placement < PLACEMENT);
  const revealed = $derived(placement !== undefined && placement >= PLACEMENT);
  // The rating counts up (or down) to its new value; revealed, all the way up from nothing.
  // svelte-ignore state_referenced_locally
  const shown = new Tween(placement !== undefined ? 0 : before, { duration: placement !== undefined ? 1800 : 1100, delay: 350, easing: cubicOut });
  $effect(() => {
    shown.target = after;
  });
  const lv = $derived(levelOf(after));
  const st = $derived(stageOf(puzzleRating));
  const title = $derived(!solved ? 'Not this time' : stars >= 3 ? 'Brilliant!' : stars === 2 ? 'Great job!' : 'Solved!');
  const sub = $derived(
    !solved
      ? 'Tricky one! Look at the answer, then try the next.'
      : stars >= 3
        ? 'First try and fast. Three stars!'
        : stars === 2
          ? 'First try, well done.'
          : 'You got there. First try earns more points.',
  );
</script>

<section class="pres" class:ok={solved} class:miss={!solved} aria-live="polite">
  <div class="top">
    <div class="ttl">
      <strong class="display">{title}</strong>
      <span>{sub}</span>
    </div>
    <div class="stars" aria-label="{stars} of 3 stars">
      {#each [1, 2, 3] as n (n)}<span class="star" class:on={stars >= n} style="animation-delay: {0.15 + n * 0.22}s">★</span>{/each}
    </div>
  </div>

  <div class="nums">
    <div class="rating" class:reveal={revealed}>
      <span class="lbl">{revealed ? 'Your level is found!' : 'Your rating'}</span>
      <span class="r-row">
        {#if placing}
          <strong class="num big q">?</strong><span class="soon">after {PLACEMENT - placement!} more</span>
        {:else}
          <strong class="num big">{Math.round(shown.current)}</strong>
          <!-- Placement's steps aren't points won or lost: no change shown. -->
          {#if placement === undefined && change}
            <span class="delta num" class:up={change > 0} class:down={change < 0}>{change > 0 ? '+' : '−'}{Math.abs(change)}</span>
          {:else if placement === undefined && change === 0}
            <span class="delta num">±0</span>
          {/if}
        {/if}
      </span>
    </div>
    <div class="puz">
      <span class="lbl">This puzzle</span>
      <span class="r-row"><strong class="num">{puzzleRating}</strong><span class="stage" style="--c: {st.color}">{st.name}</span></span>
    </div>
  </div>

  {#if placing}
    <div class="place">
      <span class="lbl">Finding your level · {placement} of {PLACEMENT}</span>
      <span class="dots" aria-hidden="true">{#each Array.from({ length: PLACEMENT }) as _, i (i)}<i class:on={i < placement!}></i>{/each}</span>
      <span class="hint">Your first {PLACEMENT} puzzles find the puzzles that suit you. Then your rating appears, and every first-try solve moves it up.</span>
    </div>
  {:else}
    <div class="ladder">
      <img src={lv.level.image} alt="" width="40" height="40" />
      <div class="lad-mid">
        <span class="lbl"><strong>{lv.level.name} level</strong>{#if lv.next} · {lv.next.from - after} points to {lv.next.name}{/if}</span>
        <span class="bar"><span style="width: {Math.round(lv.progress * 100)}%"></span></span>
      </div>
      {#if lv.next}<img class="next" src={lv.next.image} alt={lv.next.name} width="34" height="34" />{/if}
    </div>
  {/if}

  {#if themes}<p class="themes">Theme: {themes}</p>{/if}
  <button class="btn primary go" onclick={onnext} disabled={busy}>Next puzzle →</button>
</section>

<style>
  .pres {
    --tone: var(--win);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--tone) 45%, var(--border));
    background:
      radial-gradient(90% 80% at 0% 0%, color-mix(in srgb, var(--tone) 16%, transparent), transparent 70%),
      var(--card);
    animation: rise 0.35s ease-out;
  }
  .pres.miss {
    --tone: #7d8bb5;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .ttl {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .ttl strong {
    font-size: 30px;
    line-height: 1.05;
    color: var(--tone);
  }
  .ok .ttl strong {
    color: var(--win);
  }
  .ttl span {
    font-size: 13.5px;
    color: var(--text-2);
  }
  .stars {
    display: flex;
    gap: 2px;
    flex: none;
  }
  .star {
    font-size: 30px;
    line-height: 1;
    color: color-mix(in srgb, var(--text) 18%, transparent);
  }
  .star.on {
    color: #f7c948;
    text-shadow: 0 0 12px rgba(247, 201, 72, 0.6);
    animation: pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both;
  }
  @keyframes pop {
    from {
      transform: scale(0.2) rotate(-40deg);
      opacity: 0;
    }
  }
  .nums {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 10px;
  }
  .rating,
  .puz {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }
  .lbl {
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
  }
  .lbl strong {
    color: var(--text);
  }
  .r-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .r-row strong {
    font-family: var(--font-display);
    font-size: 26px;
    line-height: 1;
  }
  .r-row .big {
    font-size: 34px;
    color: var(--gold);
  }
  .r-row .q {
    animation: think 1.6s ease-in-out infinite;
  }
  @keyframes think {
    50% {
      opacity: 0.45;
    }
  }
  .soon {
    font-size: 12.5px;
    color: var(--text-2);
  }
  .rating.reveal {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 55%, transparent);
  }
  .rating.reveal .lbl {
    color: var(--gold);
  }
  .delta {
    padding: 1px 8px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 15px;
    background: color-mix(in srgb, var(--text) 10%, transparent);
    animation: pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) 0.9s both;
  }
  .delta.up {
    background: color-mix(in srgb, var(--win) 22%, transparent);
    color: var(--win);
  }
  .delta.down {
    background: color-mix(in srgb, var(--loss) 18%, transparent);
    color: var(--loss);
  }
  .stage {
    font-size: 12px;
    font-weight: 800;
    color: var(--c);
  }
  .ladder {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ladder img {
    flex: none;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
  }
  .ladder img.next {
    opacity: 0.55;
  }
  .lad-mid {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .bar {
    height: 10px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--text) 10%, transparent);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 5px;
    background: linear-gradient(90deg, #f7cd62, #edb040);
    transition: width 1s cubic-bezier(0.2, 0.8, 0.2, 1) 0.4s;
  }
  .place {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dots {
    display: flex;
    gap: 4px;
  }
  .dots i {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--text) 12%, transparent);
  }
  .dots i.on {
    background: var(--gold);
  }
  .hint {
    font-size: 12.5px;
    color: var(--text-2);
  }
  .themes {
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
  }
  .go {
    min-height: 52px;
    font-size: 18px;
  }
  /* Phones and tablets: the board fills the screen and this card sits below it, so Next is pinned above the menu bar
     (always in reach after a puzzle, without scrolling). */
  @media (max-width: 899px) {
    .pres {
      padding-bottom: 72px;
    }
    .go {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: calc(76px + env(safe-area-inset-bottom));
      z-index: 55;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      animation: rise 0.3s ease-out;
    }
  }
  @keyframes rise {
    from {
      transform: translateY(16px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .go {
      animation: none;
    }
  }
</style>

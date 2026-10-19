<script lang="ts">
  /**
   * Rated puzzles, one after another, at the player's level (bank.ts): a
   * puzzle counts once, at its first result (rating.ts); after a wrong move the
   * player may try again, and the answer shows after two wrong moves.
   */
  import { onMount } from 'svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import { THEME_NAMES } from '$lib/insights/plan';
  import { useFeature } from '$lib/plans';
  import { POINTS, study } from '$lib/study/progress';
  import { markSeen, nextRated, type BandPuzzle } from './bank';
  import { puzzleRating, ratePuzzle } from './rating';

  let current = $state<BandPuzzle | undefined>();
  let round = $state(0);
  let result = $state<boolean | undefined>();
  let change = $state<number | undefined>();
  let error = $state('');
  let loading = $state(false);

  onMount(() => void next());

  async function next() {
    if (loading) return;
    loading = true;
    error = '';
    try {
      const p = await nextRated($puzzleRating);
      if (!p) {
        error = 'You have solved every puzzle near your rating in this browser. Well done!';
        return;
      }
      void useFeature('puzzle', p[0]);
      markSeen(p[0]);
      current = p;
      result = undefined;
      change = undefined;
      round++;
    } catch {
      error = 'The puzzles could not be loaded. Check your connection and try again.';
    } finally {
      loading = false;
    }
  }

  async function rate(clean: boolean) {
    if (!current) return;
    change = await ratePuzzle(current[0], current[3], clean, current[4][0] ?? 'mix');
  }

  function done(ok: boolean) {
    result = ok;
    if (ok && current) study.log('puzzle', POINTS.puzzleSolved, `Rated puzzle ${current[0]}`);
  }

  const nameOf = (t: string) => {
    const n = THEME_NAMES[t] ?? t.replace(/([A-Z])/g, ' $1').toLowerCase();
    return n[0].toUpperCase() + n.slice(1);
  };
  /** The themes worth naming (not "middlegame", "short"…), after the answer. */
  const SKIP = new Set(['opening', 'middlegame', 'endgame', 'short', 'long', 'crushing', 'advantage', 'equality']);
</script>

<div class="rated">
  <section class="board-col" aria-label="Puzzle board">
    {#if current}
      {#key round}
        <PuzzleBoard fen={current[1]} moves={current[2].split(' ')} tries={2} onresult={done} onfirst={rate} hintButton />
      {/key}
    {:else}
      <div class="placeholder">{error || 'Finding a puzzle at your level…'}</div>
    {/if}
  </section>
  <aside class="side card">
    {#if current}
      <div class="meta">
        <span class="pill gold">Puzzle {current[3]}</span>
        {#if change !== undefined}
          <span class="pill chg" class:up={change > 0}>{change > 0 ? '+' : ''}{change}</span>
        {/if}
      </div>
      {#if result === undefined}
        <p class="label">Find the best move, then keep finding them. Your first try counts for your rating; after a wrong move you may try again.</p>
      {:else}
        <p class:ok={result} class:bad={!result}>{result ? (change && change > 0 ? 'Solved! Your rating went up.' : 'Solved!') : 'This one was tricky: watch the answer, then try the next.'}</p>
        {#if current[4].some((t) => !SKIP.has(t))}
          <p class="label">Theme: {current[4].filter((t) => !SKIP.has(t)).slice(0, 3).map(nameOf).join(', ')}</p>
        {/if}
      {/if}
      <button class="btn primary" onclick={next} disabled={loading}>{result === undefined ? 'Skip to the next puzzle' : 'Next puzzle'}</button>
      {#if result === undefined}<p class="label small">Skipping doesn't change your rating.</p>{/if}
    {:else if error}
      <button class="btn primary" onclick={next}>Try again</button>
    {/if}
  </aside>
</div>

<style>
  .rated {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: center;
    align-items: flex-start;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 340px), 720px);
    min-width: min(100%, 300px);
  }
  .placeholder {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    padding: 24px;
    text-align: center;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--muted);
  }
  .side {
    flex: 1 1 300px;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .side p {
    margin: 0;
  }
  .meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chg {
    background: var(--raised);
    color: var(--loss);
    font-weight: 700;
  }
  .chg.up {
    color: var(--win);
  }
  .ok {
    color: var(--win);
    font-weight: 600;
  }
  .bad {
    color: var(--loss);
    font-weight: 600;
  }
  .small {
    font-size: 13px;
  }
</style>

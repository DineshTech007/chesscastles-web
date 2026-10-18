<script lang="ts">
  /**
   * The student's move at a chapter's position: every main move players of the
   * opening choose there (3%+ of games, 15+ games), how often and how it
   * scored. The pick is kept for the whole opening (choices.ts) and the
   * trainer builds the line from it.
   */
  import { onMount, untrack } from 'svelte';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { moveToUci, playSans, sanOf } from '$lib/chess/position';
  import { loadChoices, saveChoice, STUDY_ALT_GAMES, STUDY_ALT_SHARE } from './choices';
  import { StudyBook } from './studyBook';

  let { opening, sans, side, book }: { opening: string; sans: string; side: 'white' | 'black'; book: StudyBook } = $props();

  let options = $state<{ uci: string; san: string; games: number; share: number; score: number }[]>([]);
  let chosen = $state<string | undefined>();
  let key = '';

  onMount(async () => {
    const pos = playSans(untrack(() => sans));
    if (pos.turn !== untrack(() => side)) return;
    key = polyglotKey(pos).toString(16);
    const entries = await untrack(() => book).entries(pos).catch(() => []);
    const total = entries.reduce((s, e) => s + e.games, 0);
    if (!total) return;
    options = entries
      .filter((e) => pos.isLegal(e.move) && e.games >= STUDY_ALT_GAMES && e.games / total >= STUDY_ALT_SHARE)
      .sort((a, b) => b.games - a.games)
      .slice(0, 5)
      .map((e) => ({ uci: moveToUci(e.move), san: sanOf(pos, e.move), games: e.games, share: e.games / total, score: (e.wins + e.draws / 2) / e.games }));
    chosen = loadChoices(untrack(() => opening))[key] ?? options[0]?.uci;
  });

  const no = $derived.by(() => {
    const n = sans.split(' ').length;
    return `${Math.floor(n / 2) + 1}${n % 2 === 0 ? '.' : '...'}`;
  });
  function pick(uci: string) {
    chosen = uci;
    saveChoice(opening, key, uci);
  }
</script>

{#if options.length > 1}
  <div class="pick">
    <span class="label">Your move here (players of this opening choose):</span>
    <div class="opts" role="group" aria-label="Your move">
      {#each options as o (o.uci)}
        <button class="chip opt" aria-pressed={chosen === o.uci} onclick={() => pick(o.uci)} title="{o.games.toLocaleString('en-IN')} games">
          {no}{o.san}
          <span class="meta">{Math.round(o.share * 100)}% · scored {Math.round(o.score * 100)}%</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .pick {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .opt {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    height: auto;
    padding: 5px 10px;
  }
  .meta {
    font-size: 11px;
    opacity: 0.8;
  }
</style>

<script lang="ts">
  /**
   * The pictures inside a blog post: a chess position ("board"), the rice-and-chessboard drawing ("rice"), and a
   * sample week of practice ("week"). Drawn here, so there is nothing to download and nothing to license.
   */
  import Board from './Board.svelte';
  import type { Lang } from '$lib/coach/i18n';

  let { kind, fen = '', caption = '', lang = 'en' }: { kind: 'board' | 'rice' | 'week'; fen?: string; caption?: string; lang?: Lang } = $props();

  const DAYS: Record<Lang, [string, string, number][]> = {
    en: [['Mon', 'Puzzles', 15], ['Tue', 'A slow game', 30], ['Wed', 'A lesson', 20], ['Thu', 'Puzzles', 15], ['Fri', 'Review the game', 20], ['Sat', 'Game or tournament', 45], ['Sun', 'Rest', 0]],
    hi: [['सोम', 'Puzzles', 15], ['मंगल', 'एक धीमा game', 30], ['बुध', 'एक lesson', 20], ['गुरु', 'Puzzles', 15], ['शुक्र', 'Game का review', 20], ['शनि', 'Game या tournament', 45], ['रवि', 'आराम', 0]],
    mr: [['सोम', 'Puzzles', 15], ['मंगळ', 'एक हळू game', 30], ['बुध', 'एक lesson', 20], ['गुरु', 'Puzzles', 15], ['शुक्र', 'Game चा review', 20], ['शनि', 'Game किंवा tournament', 45], ['रवि', 'विश्रांती', 0]],
  };
  const MIN: Record<Lang, string> = { en: 'min', hi: 'मिनट', mr: 'मिनिटं' };
  const total = $derived(DAYS[lang].reduce((n, d) => n + d[2], 0));
  const RICE: Record<Lang, [string, string]> = {
    en: ['Square 1: one grain', 'Square 64: 9,223,372,036,854,775,808 grains'],
    hi: ['खाना 1: एक दाना', 'खाना 64: 9,223,372,036,854,775,808 दाने'],
    mr: ['घर 1: एक दाणा', 'घर 64: 9,223,372,036,854,775,808 दाणे'],
  };
  /** Squares of the rice drawing: grain counts for the first row, doubling each time. */
  const row = [1, 2, 4, 8, 16, 32, 64, 128];
</script>

<figure class="fig">
  {#if kind === 'board'}
    <div class="board"><Board {fen} viewOnly coordinates={false} label={caption} /></div>
  {:else if kind === 'rice'}
    <svg viewBox="0 0 480 300" role="img" aria-label={RICE[lang][0] + '. ' + RICE[lang][1]}>
      {#each [0, 1, 2, 3, 4, 5, 6, 7] as c (c)}
        <rect x={c * 60} y="0" width="60" height="60" fill={c % 2 ? '#b58863' : '#f0d9b5'} />
        {#each Array.from({ length: Math.min(row[c], 14) }) as _, g (g)}
          <ellipse cx={c * 60 + 10 + (g % 5) * 10} cy={30 + Math.floor(g / 5) * 9} rx="3.6" ry="2.1" fill="#fff8e0" stroke="#8a6b2a" stroke-width="0.6" />
        {/each}
        <text x={c * 60 + 30} y="16" text-anchor="middle" font-size="14" font-weight="800" fill="#0b1426">{row[c]}</text>
      {/each}
      <text x="240" y="92" text-anchor="middle" font-size="15" fill="currentColor">× 2 → × 2 → × 2 …</text>
      <rect x="150" y="130" width="180" height="150" rx="10" fill="#b58863" stroke="#edb040" stroke-width="3" />
      <text x="240" y="170" text-anchor="middle" font-size="40" fill="#f0d9b5">♚</text>
      <text x="240" y="205" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">{RICE[lang][1].split(': ')[0]}</text>
      <text x="240" y="230" text-anchor="middle" font-size="12" fill="#fff">{RICE[lang][1].split(': ')[1].split(' ')[0]}</text>
      <text x="240" y="250" text-anchor="middle" font-size="12" fill="#fff">{RICE[lang][1].split(': ')[1].split(' ').slice(1).join(' ')}</text>
    </svg>
  {:else}
    <div class="week" role="img" aria-label="A week of practice">
      {#each DAYS[lang] as d, i (i)}
        <div class="day" class:rest={!d[2]}>
          <b>{d[0]}</b>
          <span class="bar" style="height: {d[2] ? 18 + d[2] * 1.6 : 8}px"></span>
          <span class="t">{d[1]}</span>
          <span class="m">{d[2] ? `${d[2]} ${MIN[lang]}` : '–'}</span>
        </div>
      {/each}
    </div>
    <p class="sum">{total} {MIN[lang]}</p>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .fig {
    margin: 6px 0;
    padding: 12px;
    border-radius: var(--r-card);
    background: var(--card);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .board {
    width: min(100%, 340px);
  }
  svg {
    width: min(100%, 480px);
    color: var(--text);
  }
  figcaption {
    font-size: 14px;
    color: var(--text-2);
    text-align: center;
    line-height: 1.45;
  }
  .week {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
    align-items: end;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    justify-content: flex-end;
  }
  .day b {
    font-size: 13px;
  }
  .bar {
    width: 70%;
    border-radius: 8px 8px 3px 3px;
    background: linear-gradient(180deg, var(--gold), var(--accent));
  }
  .rest .bar {
    background: var(--raised);
    border: 1px dashed var(--border);
  }
  .t {
    font-size: 11.5px;
    line-height: 1.2;
    color: var(--text-2);
    min-height: 28px;
  }
  .m {
    font-size: 12px;
    font-weight: 800;
    color: var(--gold);
  }
  .sum {
    margin: 0;
    font-weight: 800;
    color: var(--gold);
  }
</style>

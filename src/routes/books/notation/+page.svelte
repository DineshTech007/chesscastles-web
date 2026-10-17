<script lang="ts">
  /** How to read the old (descriptive) chess notation used in the classic books. */
  import Icon from '$lib/components/Icon.svelte';

  const FILES = ['QR', 'QKt', 'QB', 'Q', 'K', 'KB', 'KKt', 'KR'];
  const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  let side = $state<'white' | 'black'>('white');
  let picked = $state<{ f: number; r: number } | undefined>({ f: 4, r: 3 });

  /** The square's old name for the side chosen: ranks count from that player's side. */
  const oldName = (f: number, r: number) => `${FILES[f]}${side === 'white' ? r : 9 - r}`;
  const rows = $derived(side === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]);
  const cols = $derived(side === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]);

  const EXAMPLES: [string, string, string][] = [
    ['P-K4', 'e4 (White) · e5 (Black)', 'A pawn to the King’s fourth square'],
    ['Kt-KB3', 'Nf3 (White) · Nf6 (Black)', 'A knight to the King’s Bishop’s third square'],
    ['B-B4', 'Bc4 or Bf4', 'A bishop to a Bishop’s fourth square (the book’s position tells you which)'],
    ['P x P', 'exd5, cxd4…', 'A pawn takes a pawn'],
    ['Q x Kt ch', 'Qxf6+…', 'The queen takes a knight, with check'],
    ['Castles / O-O', 'O-O', 'Castles king side; Q R side is O-O-O'],
    ['… or 17 …', '17…', 'A move by Black'],
  ];
</script>

<svelte:head><title>Old chess notation · Books · Chess Castles</title></svelte:head>

<div class="page">
  <a class="btn ghost back" href="/books"><Icon name="back" size={18} color="currentColor" />Books</a>
  <h1 class="display">How to read old chess notation</h1>
  <p class="lead">
    Books written before about 1980 use <strong>descriptive notation</strong>. It is easy once you know two ideas, and
    reading it is good board-vision practice.
  </p>

  <div class="two">
    <section class="card">
      <h2 class="title">1. Files are named after the pieces that start on them</h2>
      <p>
        The <strong>K</strong>ing's side files are KR (King's Rook), KKt (King's Knight), KB (King's Bishop) and K. The
        <strong>Q</strong>ueen's side files are Q, QB, QKt and QR. <em>Kt</em> is the knight (some books write N).
      </p>
      <h2 class="title">2. Ranks are counted from each player's own side</h2>
      <p>
        White's first rank is Black's eighth. So White's <em>P-K4</em> is <strong>e4</strong>, but Black's
        <em>P-K4</em> is <strong>e5</strong>. Tap a square to see both names.
      </p>
      <div class="seg" role="group" aria-label="Seen from">
        <button aria-pressed={side === 'white'} onclick={() => (side = 'white')}>White's names</button>
        <button aria-pressed={side === 'black'} onclick={() => (side = 'black')}>Black's names</button>
      </div>
      {#if picked}
        <p class="answer">
          <strong class="num">{LETTERS[picked.f]}{picked.r}</strong> is <strong>{oldName(picked.f, picked.r)}</strong> for {side === 'white' ? 'White' : 'Black'}
          and <strong>{FILES[picked.f]}{side === 'white' ? 9 - picked.r : picked.r}</strong> for {side === 'white' ? 'Black' : 'White'}.
        </p>
      {/if}
    </section>

    <div class="board" role="grid" aria-label="Square names">
      {#each rows as r (r)}
        {#each cols as f (f)}
          <button
            class="sq"
            class:dark={(f + r) % 2 === 1}
            class:on={picked?.f === f && picked?.r === r}
            onclick={() => (picked = { f, r })}
            aria-label="{LETTERS[f]}{r}: {oldName(f, r)}"
          >
            <span class="old">{oldName(f, r)}</span>
            <span class="new">{LETTERS[f]}{r}</span>
          </button>
        {/each}
      {/each}
    </div>
  </div>

  <section class="card">
    <h2 class="title">Common moves</h2>
    <table>
      <thead><tr><th>Old</th><th>Modern</th><th>Meaning</th></tr></thead>
      <tbody>
        {#each EXAMPLES as [o, n, m] (o)}
          <tr><td class="num"><strong>{o}</strong></td><td class="num">{n}</td><td>{m}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="label">
      Other marks: <em>ch</em> or <em>+</em> check · <em>dis. ch.</em> discovered check · <em>e.p.</em> en passant ·
      <em>(Q)</em> promotes to a queen. When you tap <strong>Listen</strong> in a book, these are read out in words.
    </p>
  </section>
</div>

<style>
  .page {
    max-width: 980px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    align-self: flex-start;
    display: inline-flex;
    gap: 4px;
  }
  h1 {
    margin: 0;
    font-size: clamp(28px, 5vw, 38px);
  }
  .lead {
    margin: 0;
    color: var(--muted);
    max-width: 70ch;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 440px);
    gap: 14px;
    align-items: start;
  }
  .title {
    font-size: 17px;
    margin: 0 0 6px;
  }
  .card p {
    margin: 0 0 14px;
    line-height: 1.55;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .seg button {
    border: 0;
    background: var(--card);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    padding: 8px 14px;
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--action);
    color: var(--on-action);
  }
  .answer {
    font-size: 17px;
  }
  .board {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }
  .sq {
    border: 0;
    padding: 2px;
    background: #f0d9b5;
    color: #1f2a44;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font: inherit;
    min-width: 0;
  }
  .sq.dark {
    background: #b58863;
    color: #0f1a33;
  }
  .sq.on {
    background: var(--gold);
    color: #000;
  }
  .old {
    font-weight: 700;
    font-size: clamp(9px, 2.2vw, 14px);
  }
  .new {
    font-size: clamp(8px, 1.8vw, 11px);
    opacity: 0.7;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  th,
  td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    color: var(--muted);
    font-size: 13px;
  }
  @media (max-width: 760px) {
    .two {
      grid-template-columns: 1fr;
    }
    td:nth-child(3),
    th:nth-child(3) {
      display: none;
    }
  }
</style>

<script lang="ts">
  import FeatureGate from '$lib/components/FeatureGate.svelte';
  import { tabRef } from '$lib/plans';
  import { onDestroy, onMount } from 'svelte';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { fenOf, keyOf } from '$lib/chess/position';
  import { session, startSignIn } from '$lib/auth';
  import { POINTS, study } from '$lib/study/progress';
  import { BlindPuzzle, describe, loadVision, nextVisionPuzzle, saveVision, visionRatingAfter, type VisionRecord } from '$lib/vision/vision';
  import { sendPuzzle } from '$lib/vision/api';

  let rec = $state<VisionRecord>({ rating: 1000, games: 0, solved: 0, bestSprint: 0, bestMemory: 0 });
  let p = $state<BlindPuzzle | undefined>();
  /** The puzzle's state, kept here so the page updates (the puzzle object itself is not reactive). */
  let status = $state<'solving' | 'solved' | 'failed'>('solving');
  let moved = $state(0);
  let v = $state(0);
  let typed = $state('');
  let note = $state('');
  let change = $state<number | undefined>();
  let serverNote = $state('');
  let easier = $state(true);
  let peeking = $state(false);
  let peeked = $state(false);
  let input: HTMLInputElement | undefined = $state();
  /** The reveal: which move of the solution the board shows. */
  let shown = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(async () => {
    rec = loadVision();
    try {
      easier = localStorage.getItem('k24.vision.easier') !== 'false';
    } catch {
      /* default */
    }
    await next();
  });
  onDestroy(() => clearInterval(timer));

  async function next() {
    clearInterval(timer);
    p = new BlindPuzzle(await nextVisionPuzzle(rec.rating));
    status = 'solving';
    moved = 0;
    typed = '';
    note = '';
    change = undefined;
    serverNote = '';
    peeked = false;
    peeking = false;
    shown = 0;
    v++;
    queueMicrotask(() => input?.focus());
  }

  function setEasier(e: boolean) {
    easier = e;
    try {
      localStorage.setItem('k24.vision.easier', String(e));
    } catch {
      /* fine */
    }
  }

  const view = $derived.by(() => {
    void v;
    if (!p) return undefined;
    // Easier: the position after the opponent's move. Harder: before it, and you play their move in your head.
    const base = easier ? p.positionAt(1) : p.start;
    return { sides: describe(base), moves: p.shown, toMove: p.side, step: p.step };
  });

  async function submit() {
    if (!p || status !== 'solving' || !typed.trim()) return;
    const r = p.answer(typed);
    status = p.status;
    moved = p.played.length;
    if (r.illegal) {
      note = `"${typed}" is not a legal move here. Write it like Nf3, Qxh7+ or O-O.`;
      p.played.pop();
      moved = p.played.length;
      v++;
      return;
    }
    typed = '';
    if (r.ok && r.reply) {
      note = `Right! They answer ${r.reply}. Your next move?`;
      v++;
      return;
    }
    v++;
    await finish(status === 'solved');
  }

  async function finish(solved: boolean) {
    if (!p) return;
    note = solved ? 'Solved, without seeing the board!' : 'Not this time. Here is the board and the answer.';
    // Practice (the board was peeked at) is not rated.
    if (!peeked) {
      const before = rec.rating;
      const local = visionRatingAfter(rec.rating, rec.games, p.rating, solved);
      rec = { ...rec, rating: local, games: rec.games + 1, solved: rec.solved + (solved ? 1 : 0) };
      change = local - before;
      if ($session.status === 'in') {
        try {
          const s = await sendPuzzle(p.id, p.played);
          if (s && !s.repeat) {
            rec = { ...rec, rating: s.rating };
            change = s.change;
          }
          serverNote = s?.repeat ? 'You had this puzzle before, so the leaderboard rating stays.' : '';
        } catch {
          serverNote = "The leaderboard couldn't be reached; your rating here is updated.";
        }
      }
      saveVision(rec);
    }
    if (solved) study.log('puzzle', POINTS.puzzleWithHint, 'Vision puzzle');
    // Play the solution on the board.
    shown = 0;
    timer = setInterval(() => {
      if (!p || shown >= p.moves.length) return clearInterval(timer);
      shown++;
    }, 900);
  }

  function giveUp() {
    if (!p || status !== 'solving') return;
    p.status = 'failed';
    status = 'failed';
    v++;
    void finish(false);
  }

  function peek() {
    peeked = true;
    peeking = true;
    setTimeout(() => (peeking = false), 4000);
  }

  function key(k: string) {
    if (k === '⌫') typed = typed.slice(0, -1);
    else typed += k;
    input?.focus();
  }

  const reveal = $derived.by(() => {
    void v;
    if (!p) return undefined;
    if (status === 'solving') return peeking ? { fen: fenOf(easier ? p.positionAt(1) : p.start), shapes: [] as DrawShape[], last: undefined } : undefined;
    const pos = p.positionAt(Math.max(1, shown));
    const m = p.moves[Math.max(0, shown - 1)];
    const best = p.moves[Math.max(1, shown)];
    return {
      fen: fenOf(pos),
      last: m ? [keyOf(m.from), keyOf(m.to)] : undefined,
      shapes: shown < p.moves.length && best ? [{ orig: keyOf(best.from), dest: keyOf(best.to), brush: 'green' } as DrawShape] : [],
    };
  });
  const solution = $derived.by(() => {
    void v;
    return p ? p.moves.map((_, i) => p!.san(i)) : [];
  });
</script>

<svelte:head><title>Blindfold puzzles · Vision Gym · Chess Castles</title></svelte:head>

<FeatureGate feature="vision" ref={tabRef('blind')} back="/vision" backLabel="Vision Gym">
<div class="page">
  <a class="back" href="/vision"><Icon name="back" size={16} />Vision Gym</a>
  <header class="head">
    <div>
      <h1 class="display">Blindfold puzzles</h1>
      <p class="label">Read the position, see it in your head, find the move. The board appears only with the answer.</p>
    </div>
    <div class="stat card"><span class="label">Vision rating</span><strong class="display num">{rec.rating}</strong></div>
  </header>

  {#if p && view}
    <div class="body">
      <section class="card puzzle">
        <div class="seg-row">
          <div class="segmented" role="group" aria-label="Difficulty">
            <button aria-pressed={easier} onclick={() => setEasier(true)} disabled={status === 'solving' && moved > 0}>After their move</button>
            <button aria-pressed={!easier} onclick={() => setEasier(false)} disabled={status === 'solving' && moved > 0}>Before their move (harder)</button>
          </div>
          <span class="pill">Puzzle {p.rating}</span>
        </div>

        {#each view.sides as s (s.color)}
          <div class="side">
            <span class="disc {s.color}"></span>
            <div>
              <strong class="title">{s.color === 'white' ? 'White' : 'Black'}{s.color === view.toMove ? ' (you)' : ''}</strong>
              <p class="pieces num">{s.pieces || '—'}</p>
              {#if s.pawns}<p class="pawns num">Pawns {s.pawns}</p>{/if}
            </div>
          </div>
        {/each}

        <div class="moves">
          {#if easier}
            <p><span class="label">Their last move:</span> <strong class="num">{view.moves[0]}</strong> (already on the board above)</p>
          {:else}
            <p><span class="label">They play:</span> <strong class="num">{view.moves[0]}</strong>. Move it in your head.</p>
          {/if}
          {#if view.moves.length > 1}
            <p><span class="label">Since then:</span> <strong class="num">{view.moves.slice(1).join(', ')}</strong></p>
          {/if}
        </div>

        {#if status === 'solving'}
          <form class="answer" onsubmit={(e) => (e.preventDefault(), submit())}>
            <label for="vision-move" class="title">{view.toMove === 'white' ? 'White' : 'Black'} to move: your move?</label>
            <div class="row">
              <input bind:this={input} id="vision-move" bind:value={typed} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="e.g. Qxh7+" />
              <button class="btn primary" type="submit">Play</button>
            </div>
          </form>
          <div class="keys" aria-label="Move keys">
            {#each ['K', 'Q', 'R', 'B', 'N', 'x', '+', '#', '=', 'O-O', '⌫'] as k (k)}<button class="key" onclick={() => key(k)}>{k}</button>{/each}
            {#each 'abcdefgh'.split('') as k (k)}<button class="key" onclick={() => key(k)}>{k}</button>{/each}
            {#each '12345678'.split('') as k (k)}<button class="key" onclick={() => key(k)}>{k}</button>{/each}
          </div>
          {#if note}<p class="note" role="status">{note}</p>{/if}
          <div class="row">
            <button class="btn ghost" onclick={peek} disabled={peeking}><Icon name="search" size={16} />Peek at the board (practice, not rated)</button>
            <button class="btn ghost" onclick={giveUp}>Show the answer</button>
          </div>
        {:else}
          <div class="result" class:ok={status === 'solved'}>
            <strong class="title">{note}</strong>
            <p>Solution: <span class="num">{solution.slice(1).join(' ')}</span></p>
            {#if change !== undefined}<p>Vision rating {rec.rating} <span class="num" class:up={change > 0} class:down={change < 0}>({change >= 0 ? '+' : ''}{change})</span></p>{:else if peeked}<p class="label">You peeked, so this one was practice.</p>{/if}
            {#if serverNote}<p class="label">{serverNote}</p>{/if}
            {#if $session.status === 'out'}<p class="label"><button class="link" onclick={() => startSignIn()}>Sign in</button> to put your Vision rating on the leaderboard.</p>{/if}
            <button class="btn primary" onclick={next}>Next puzzle</button>
          </div>
        {/if}
      </section>

      <section class="board-box">
        {#if reveal}
          <Board fen={reveal.fen} viewOnly orientation={p.side} lastMove={reveal.last as never} shapes={reveal.shapes} label="The puzzle's board" />
        {:else}
          <div class="hidden card"><Icon name="search" size={40} color="var(--muted)" /><p class="label">The board is hidden. See it in your mind.</p></div>
        {/if}
      </section>
    </div>
  {:else}
    <div class="card skel"></div>
  {/if}
</div>
</FeatureGate>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 38px;
  }
  .head p {
    margin: 4px 0 0;
    max-width: 60ch;
  }
  .stat {
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    border-color: var(--gold);
  }
  .stat strong {
    font-size: 30px;
    color: var(--gold);
  }
  .body {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .puzzle {
    flex: 1 1 420px;
    min-width: 0;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .board-box {
    flex: 1 1 340px;
    max-width: 520px;
    min-width: 0;
  }
  .seg-row {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .side {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--raised);
  }
  .side p {
    margin: 2px 0 0;
  }
  .pieces {
    font-size: 19px;
    font-weight: 700;
    word-spacing: 6px;
  }
  .pawns {
    font-size: 15px;
    color: var(--text-2);
    word-spacing: 4px;
  }
  .disc {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--border);
    margin-top: 4px;
    flex: none;
  }
  .disc.white {
    background: #f4f4f4;
  }
  .disc.black {
    background: #222;
  }
  .moves p {
    margin: 2px 0;
    font-size: 16px;
  }
  .answer {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .answer input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 22px;
    font-weight: 700;
    padding: 8px 12px;
    border-radius: var(--r-control);
    border: 2px solid var(--brand);
    background: var(--raised);
    color: inherit;
  }
  .keys {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
    gap: 5px;
  }
  .key {
    font: inherit;
    font-weight: 700;
    padding: 8px 0;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
    cursor: pointer;
  }
  .note {
    margin: 0;
    color: var(--gold);
  }
  .result {
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--loss) 14%, transparent);
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .result.ok {
    background: color-mix(in srgb, var(--win) 16%, transparent);
  }
  .result p {
    margin: 0;
  }
  .up {
    color: var(--win);
  }
  .down {
    color: var(--loss);
  }
  .hidden {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 8px;
    text-align: center;
    background: repeating-conic-gradient(color-mix(in srgb, var(--raised) 70%, transparent) 0% 25%, transparent 0% 50%) 50% / 25% 25%;
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .skel {
    height: 400px;
  }
</style>

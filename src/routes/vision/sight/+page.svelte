<script lang="ts">
  import FeatureGate from '$lib/components/FeatureGate.svelte';
  import { tabRef } from '$lib/plans';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { study } from '$lib/study/progress';
  import SquareGrid from '$lib/vision/SquareGrid.svelte';

  /**
   * Piece Sight: a piece and a few others are named in text; tap every
   * square the piece can move to. Own pieces block; enemy pieces can be
   * captured. More pieces join as you get it right.
   */
  type P = 'Q' | 'R' | 'B' | 'N' | 'K';
  const NAMES: Record<P, string> = { Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', K: 'king' };
  const DIRS: Record<P, [number, number][]> = {
    R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    Q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
    N: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
    K: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
  };
  const sq = (f: number, r: number) => `${'abcdefgh'[f]}${r + 1}`;

  interface Task {
    piece: P;
    at: [number, number];
    own: string[];
    enemy: string[];
    answer: string[];
  }

  let level = $state(0);
  let task = $state<Task | undefined>();
  let chosen = $state<string[]>([]);
  let checked = $state(false);
  let score = $state(0);
  let best = $state(0);

  onMount(() => {
    try {
      best = Number(localStorage.getItem('k24.vision.sight')) || 0;
    } catch {
      /* none */
    }
    next();
  });

  function make(blockers: number): Task {
    const pieces: P[] = ['Q', 'R', 'B', 'N', 'K'];
    const piece = pieces[Math.floor(Math.random() * pieces.length)];
    const at: [number, number] = [Math.floor(Math.random() * 8), Math.floor(Math.random() * 8)];
    const taken = new Set([sq(...at)]);
    const near = () => {
      // Blockers go where they matter: on the piece's lines, most of the time.
      for (let i = 0; i < 50; i++) {
        const [df, dr] = DIRS[piece][Math.floor(Math.random() * DIRS[piece].length)];
        const k = piece === 'N' || piece === 'K' ? 1 : 1 + Math.floor(Math.random() * 4);
        const f = at[0] + df * k;
        const r = at[1] + dr * k;
        if (f < 0 || f > 7 || r < 0 || r > 7 || taken.has(sq(f, r))) continue;
        taken.add(sq(f, r));
        return sq(f, r);
      }
      return undefined;
    };
    const own: string[] = [];
    const enemy: string[] = [];
    for (let i = 0; i < blockers; i++) {
      const s = near();
      if (s) (i % 2 ? enemy : own).push(s);
    }
    const answer: string[] = [];
    for (const [df, dr] of DIRS[piece]) {
      for (let k = 1; k < 8; k++) {
        const f = at[0] + df * k;
        const r = at[1] + dr * k;
        if (f < 0 || f > 7 || r < 0 || r > 7) break;
        const s = sq(f, r);
        if (own.includes(s)) break;
        answer.push(s);
        if (enemy.includes(s) || piece === 'N' || piece === 'K') break;
      }
    }
    return { piece, at, own, enemy, answer };
  }

  function next() {
    task = make(Math.min(4, Math.floor(level / 2)));
    chosen = [];
    checked = false;
  }

  function tap(s: string) {
    if (checked || !task) return;
    if (s === sq(...task.at)) return;
    chosen = chosen.includes(s) ? chosen.filter((x) => x !== s) : [...chosen, s];
  }

  const result = $derived.by(() => {
    if (!task || !checked) return undefined;
    const right = chosen.filter((s) => task!.answer.includes(s));
    const wrong = chosen.filter((s) => !task!.answer.includes(s));
    const missed = task.answer.filter((s) => !chosen.includes(s));
    return { right, wrong, missed, perfect: !wrong.length && !missed.length };
  });

  function check() {
    checked = true;
    queueMicrotask(() => {
      if (!result) return;
      if (result.perfect) {
        score++;
        level++;
        study.log('puzzle', 2, 'Piece Sight');
        if (score > best) {
          best = score;
          try {
            localStorage.setItem('k24.vision.sight', String(best));
          } catch {
            /* fine */
          }
        }
      } else {
        score = 0;
        level = Math.max(0, level - 1);
      }
    });
  }
</script>

<svelte:head><title>Piece Sight · Blindfold Gym · Chess Castles</title></svelte:head>

<FeatureGate feature="vision" ref={tabRef('sight')} back="/vision" backLabel="Blindfold Gym">
<div class="page">
  <a class="back" href="/vision"><Icon name="back" size={16} />Blindfold Gym</a>
  <header class="head">
    <div>
      <h1 class="display">Piece Sight</h1>
      <p class="label">Tap every square the piece can move to. Your own pieces block it; enemy pieces can be taken. Get it perfect and more pieces join in.</p>
    </div>
    <div class="stat card"><span class="label">In a row · best</span><strong class="display num">{score} · {best}</strong></div>
  </header>

  {#if task}
    <div class="body">
      <section class="card main">
        <h2 class="title q">Your {NAMES[task.piece]} is on <span class="num">{sq(...task.at)}</span>.</h2>
        {#if task.own.length}<p>Your other pieces: <strong class="num">{task.own.join(', ')}</strong></p>{/if}
        {#if task.enemy.length}<p>Enemy pieces: <strong class="num">{task.enemy.join(', ')}</strong></p>{/if}
        {#if !task.own.length && !task.enemy.length}<p class="label">Nothing else on the board.</p>{/if}
        <p class="label">Chosen: {chosen.length} {chosen.length === 1 ? 'square' : 'squares'}</p>
        {#if !checked}
          <button class="btn primary" onclick={check}>Check</button>
        {:else if result}
          <div class="result" class:good={result.perfect}>
            <strong>{result.perfect ? `Perfect: all ${task.answer.length} squares!` : `${result.right.length} of ${task.answer.length} right${result.wrong.length ? `, ${result.wrong.length} wrong` : ''}.`}</strong>
            <span class="label">Gold rings: squares you missed. Red: squares it can't reach.</span>
            <button class="btn primary" onclick={next}>Next</button>
          </div>
        {/if}
      </section>
      <section class="board-box">
        <SquareGrid
          chosen={checked ? [] : [...chosen, sq(...task.at)]}
          right={result ? result.right : []}
          wrong={result ? result.wrong : []}
          missed={result ? result.missed : []}
          ontap={tap}
          disabled={checked}
        />
        <p class="label hint">The {NAMES[task.piece]}'s own square is marked. The other pieces are not shown: keep them in mind.</p>
      </section>
    </div>
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
    font-size: 28px;
    color: var(--gold);
  }
  .body {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .main {
    flex: 1 1 360px;
    min-width: 0;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .main p {
    margin: 0;
    font-size: 17px;
  }
  .q {
    margin: 0;
    font-size: 24px;
  }
  .board-box {
    flex: 1 1 340px;
    max-width: 520px;
    min-width: 0;
  }
  .hint {
    margin: 6px 0 0;
  }
  .result {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--loss) 14%, transparent);
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .result.good {
    background: color-mix(in srgb, var(--win) 16%, transparent);
  }
</style>

<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { destsOf, fenOf, keyOf, moveFromKeys, positionFromFen, sanOf, START_FEN, uciToMove } from '$lib/chess/position';
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
  import { engineMove, maiaPick } from '$lib/game/engineMove';
  import { maia, maiaStatus } from '$lib/engine/maia';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import MaiaCard from '$lib/components/MaiaCard.svelte';
  import { entryById } from '$lib/coach/catalog';
  import { loadCoach, updateCoach } from '$lib/coach/progress';

  const params = page.url.searchParams;
  const startFen = (() => {
    try {
      return fenOf(positionFromFen(params.get('fen') ?? START_FEN));
    } catch {
      return START_FEN;
    }
  })();
  const from = params.get('from') ?? '';
  const lessonTitle = entryById(from)?.title;

  let side = $state<'white' | 'black'>(params.get('side') === 'black' ? 'black' : 'white');
  let rating = $state(1200);
  let pos = $state<Chess>(positionFromFen(startFen));
  let history = $state<{ fen: string; lastMove?: Key[] }[]>([]);
  let lastMove = $state<Key[] | undefined>();
  let shapes = $state<DrawShape[]>([]);
  let thinking = $state(false);
  let showEval = $state(false);
  let info = $state<EngineInfo | undefined>();
  let sans = $state<string[]>([]);
  /** Human-like Maia-3, or Stockfish. */
  let opponent = $state<'maia' | 'stockfish'>('maia');
  let token = 0;

  const fen = $derived(fenOf(pos));
  const myTurn = $derived(pos.turn === side && !pos.isEnd() && !thinking);
  const result = $derived.by(() => {
    if (pos.isCheckmate()) return pos.turn === side ? 'You were checkmated. Try again!' : 'Checkmate! You won.';
    if (pos.isStalemate()) return 'Stalemate: a draw.';
    if (pos.isInsufficientMaterial()) return 'Draw: nobody can checkmate any more.';
    return undefined;
  });

  onMount(() => {
    rating = loadCoach().rating;
    try {
      if (localStorage.getItem('k24.practice.opponent') === 'stockfish') opponent = 'stockfish';
    } catch {
      // ignore
    }
    maia.init();
    maybeEngine();
    if (showEval) void evaluate();
  });
  onDestroy(() => {
    token++;
    engine.stopAnalysis();
  });

  const LABELS: [number, string][] = [
    [800, 'Beginner'],
    [1200, 'Casual'],
    [1600, 'Club player'],
    [2000, 'Expert'],
    [2400, 'Master'],
    [3200, 'Grandmaster+'],
  ];
  const strength = $derived(LABELS.find(([r]) => rating < r)?.[1] ?? 'Grandmaster+');

  function legalMoves(p: Chess): NormalMove[] {
    const out: NormalMove[] = [];
    for (const [from, dests] of p.allDests()) for (const to of dests) out.push({ from, to, promotion: p.board.get(from)?.role === 'pawn' && (to >> 3 === 7 || to >> 3 === 0) ? 'queen' : undefined });
    return out.filter((m) => p.isLegal(m));
  }

  const useMaia = $derived(opponent === 'maia' && $maiaStatus === 'ready');

  /** The opponent's move: Maia plays like a human of this rating; Stockfish below 1320 sometimes plays a random move. */
  async function engineReply(p: Chess): Promise<NormalMove | undefined> {
    if (useMaia) {
      try {
        const pick = await maiaPick(p, rating);
        if (pick) return pick.move;
      } catch {
        // fall back to Stockfish
      }
    }
    if (rating < 1320) {
      const mistakes = Math.min(0.75, (1320 - rating) / 1200);
      if (Math.random() < mistakes) {
        const moves = legalMoves(p);
        if (moves.length) return moves[Math.floor(Math.random() * moves.length)];
      }
    }
    return engineMove(p, Math.max(1320, rating));
  }

  function apply(m: NormalMove) {
    history = [...history, { fen: fenOf(pos), lastMove }];
    sans = [...sans, sanOf(pos, m)];
    const next = pos.clone();
    next.play(m);
    pos = next;
    lastMove = [keyOf(m.from), keyOf(m.to)];
    shapes = [];
    if (showEval) void evaluate();
  }

  async function maybeEngine() {
    if (pos.isEnd() || pos.turn === side) return;
    const t = ++token;
    thinking = true;
    await new Promise((r) => setTimeout(r, 300));
    const m = await engineReply(pos.clone());
    if (t !== token) return;
    thinking = false;
    if (m && pos.isLegal(m)) apply(m);
  }

  function onmove(orig: Key, dest: Key) {
    if (!myTurn) return;
    const m = moveFromKeys(pos, orig, dest);
    if (!pos.isLegal(m)) return;
    apply(m);
    void maybeEngine();
  }

  async function evaluate() {
    const f = fenOf(pos);
    const i = await engine.evaluate(f, 12);
    if (f === fenOf(pos)) info = i;
  }

  async function hint() {
    if (!myTurn) return;
    thinking = true;
    const i = await engine.evaluate(fenOf(pos), 14);
    thinking = false;
    const m = i?.pv[0] ? uciToMove(i.pv[0]) : undefined;
    if (m) shapes = [{ orig: keyOf(m.from), dest: keyOf(m.to), brush: 'green' }];
  }

  function undo() {
    token++;
    thinking = false;
    // Take back to the last position where it was the student's turn.
    let h = [...history];
    let s = [...sans];
    while (h.length) {
      const prev = h.pop()!;
      s.pop();
      const p = positionFromFen(prev.fen);
      if (p.turn === side) {
        pos = p;
        lastMove = prev.lastMove;
        break;
      }
    }
    history = h;
    sans = s;
    shapes = [];
    if (showEval) void evaluate();
  }

  function restart() {
    token++;
    thinking = false;
    pos = positionFromFen(startFen);
    history = [];
    sans = [];
    lastMove = undefined;
    shapes = [];
    info = undefined;
    if (showEval) void evaluate();
    void maybeEngine();
  }

  function switchSide() {
    side = side === 'white' ? 'black' : 'white';
    void maybeEngine();
  }

  function setOpponent(o: 'maia' | 'stockfish') {
    opponent = o;
    try {
      localStorage.setItem('k24.practice.opponent', o);
    } catch {
      // ignore
    }
  }

  function setRating(r: number) {
    rating = r;
    updateCoach({ rating: r });
  }

  const chances = $derived(info ? whiteChances(info) : 0.5);
</script>

<svelte:head><title>Practice · Coach · Chess Castles</title></svelte:head>

<div class="practice">
  <section class="board-col" aria-label="Board">
    <div class="board-row">
      {#if showEval}
        <div class="evalbar" class:flipped={side === 'black'} aria-label="Evaluation {info ? evalLabel(info) : ''}">
          <div class="white-share" style="height: {chances * 100}%"></div>
          <span class="eval-text num">{info ? evalLabel(info) : ''}</span>
        </div>
      {/if}
      <div class="board-box">
        <Board
          {fen}
          orientation={side}
          turnColor={pos.turn}
          movable={myTurn ? side : undefined}
          dests={myTurn ? destsOf(pos) : new Map()}
          {lastMove}
          check={pos.isCheck()}
          {shapes}
          label="Practice board"
          {onmove}
        />
      </div>
    </div>
  </section>

  <section class="panel-side card">
    <header>
      {#if from}<a class="back" href="/coach/{from}" aria-label="Back to the lesson"><Icon name="back" size={18} /></a>{/if}
      <div>
        <h1 class="title">Practice with the engine</h1>
        {#if lessonTitle}<span class="label">From: {lessonTitle}</span>{/if}
      </div>
    </header>

    <div class="coach">
      <GuruAvatar size={56} />
      <p>
        {#if result}{result}
        {:else if thinking}{useMaia ? 'Maia is thinking like a human…' : 'The engine is thinking…'}
        {:else if myTurn}Your move. You play {side === 'white' ? 'White' : 'Black'}.
        {:else}…{/if}
      </p>
    </div>

    <div class="opponent">
      <span class="label">Opponent</span>
      <div class="segmented" role="group" aria-label="Opponent">
        <button aria-pressed={opponent === 'maia'} onclick={() => setOpponent('maia')}>Human-like (Maia-3)</button>
        <button aria-pressed={opponent === 'stockfish'} onclick={() => setOpponent('stockfish')}>Stockfish</button>
      </div>
      {#if opponent === 'maia'}
        <MaiaCard ready="Maia-3 learned from millions of human games: it plays like a real player of the chosen rating, including human-style mistakes." />
      {/if}
    </div>

    <div class="strength">
      <div class="row">
        <span class="label">{useMaia ? 'Play like a human rated' : 'Engine strength'}</span>
        <span class="value"><strong class="num">{rating}</strong> · {strength}</span>
      </div>
      <input type="range" min="400" max="3000" step="100" value={rating} oninput={(e) => setRating(Number((e.currentTarget as HTMLInputElement).value))} aria-label="Engine strength (rating)" />
      <div class="ticks label"><span>400</span><span>1200</span><span>2000</span><span>3000</span></div>
    </div>

    <div class="buttons">
      <button class="btn" onclick={hint} disabled={!myTurn}><Icon name="bulb" size={18} />Hint</button>
      <button class="btn" onclick={undo} disabled={!history.length}><Icon name="undo" size={18} />Undo</button>
      <button class="btn" onclick={restart}><Icon name="replay" size={18} />Restart</button>
      <button class="btn" onclick={switchSide}><Icon name="flip" size={18} />Play {side === 'white' ? 'Black' : 'White'}</button>
    </div>
    <label class="toggle">
      <input type="checkbox" bind:checked={showEval} onchange={() => showEval && evaluate()} />
      Show the evaluation bar
    </label>

    {#if sans.length}
      <p class="moves num">
        {#each sans as s, i (i)}<span>{s}</span>{/each}
      </p>
    {/if}
    {#if result}
      <div class="end">
        <button class="btn primary" onclick={restart}>Play this position again</button>
        {#if from}<a class="btn" href="/coach/{from}">Back to the lesson</a>{/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .practice {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: 20px;
    padding: 20px 24px;
    max-width: 1300px;
    margin: 0 auto;
    align-items: start;
  }
  .board-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .board-box {
    width: min(100%, calc(100vh - 80px), 760px);
    aspect-ratio: 1;
  }
  .evalbar {
    position: relative;
    width: 22px;
    border-radius: 6px;
    overflow: hidden;
    background: #1b1f2a;
    display: flex;
    flex-direction: column-reverse;
  }
  .evalbar.flipped {
    flex-direction: column;
  }
  .white-share {
    background: #f2f5fb;
    transition: height 0.4s;
  }
  .eval-text {
    position: absolute;
    bottom: 4px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    color: #1b1f2a;
  }
  .panel-side {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    position: sticky;
    top: 16px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .back {
    color: var(--muted);
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
  }
  .coach {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--raised);
    border-radius: 14px;
    padding: 10px 12px;
  }
  .coach p {
    margin: 0;
    font-size: 16px;
  }
  .opponent {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .strength {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .value strong {
    font-size: 20px;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--brand);
  }
  .ticks {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .buttons .btn {
    gap: 6px;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
  }
  .moves {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    font-size: 14px;
    color: var(--text-2);
  }
  .end {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  @media (max-width: 860px) {
    .practice {
      grid-template-columns: 1fr;
      padding: 12px 16px 24px;
    }
    .board-box {
      width: min(100%, 560px);
    }
    .panel-side {
      position: static;
    }
  }
</style>

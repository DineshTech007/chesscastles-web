<script lang="ts">
  /**
   * The game report: both players' accuracy and badges, every move with its
   * badge, and a board showing the move, its badge and the better move.
   */
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import type { Key } from '@lichess-org/chessground/types';
  import { makeSquare } from 'chessops/util';
  import Board from '$lib/components/Board.svelte';
  import { positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
  import { evalLabel } from '$lib/engine/stockfish';
  import type { GameReview, MoveReview } from '$lib/coach/review';
  import type { SavedGame } from '$lib/stores/myGames';
  import { BADGE_ORDER, BADGES, boardBadge } from './badges';
  import MoveBadge from './MoveBadge.svelte';
  import { playMoveSound } from '$lib/sound';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import ReviewSummary from './ReviewSummary.svelte';

  let { game, review }: { game: SavedGame; review: GameReview } = $props();

  /** Index into review.all of the move shown (-1: the start). */
  let at = $state(-1);
  const current = $derived<MoveReview | undefined>(review.all[at]);
  const fen = $derived(current ? review.fens[current.ply + 1] : review.fens[0]);
  const key = (sq: number) => makeSquare(sq) as Key;

  /** The better move, when the played one was not (one of) the best. */
  const better = $derived.by(() => {
    const m = current;
    if (!m || ['best', 'brilliant', 'only', 'book'].includes(m.cls)) return undefined;
    const best = m.before.pv[0] ? uciToMove(m.before.pv[0]) : undefined;
    const pos = positionFromFen(m.fenBefore);
    if (!best || !pos.isLegal(best)) return undefined;
    return { move: best, san: sanOf(pos, best) };
  });

  const shapes = $derived.by((): DrawShape[] => {
    const m = current;
    if (!m) return [];
    const s: DrawShape[] = [{ orig: key(m.move.to), customSvg: { html: boardBadge(m.cls) } }];
    if (better) s.push({ orig: key(better.move.from), dest: key(better.move.to), brush: 'green' });
    return s;
  });

  const rows = $derived.by(() => {
    const out: { no: number; white?: { m: MoveReview; i: number }; black?: { m: MoveReview; i: number } }[] = [];
    review.all.forEach((m, i) => {
      const no = Math.floor(m.ply / 2) + 1;
      let row = out[out.length - 1];
      if (!row || row.no !== no) out.push((row = { no }));
      row[m.color] = { m, i };
    });
    return out;
  });

  const players = $derived([
    { color: 'white' as const, name: game.white },
    { color: 'black' as const, name: game.black },
  ]);

  function go(i: number) {
    const to = Math.max(-1, Math.min(review.all.length - 1, i));
    if (to === at + 1 && review.all[to]) playMoveSound(positionFromFen(review.all[to].fenBefore), review.all[to].move);
    at = to;
  }
  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'ArrowRight') go(at + 1);
    else return;
    e.preventDefault();
  }
  /** The next move of the student's that is not best: inaccuracies and worse. */
  function nextSlip() {
    const i = review.all.findIndex((m, j) => j > at && m.color === game.userSide && ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(m.cls));
    if (i >= 0) go(i);
  }

  let list: HTMLElement | undefined = $state();
  // Keep the chosen move visible inside the list, without scrolling the page.
  $effect(() => {
    const el = list?.querySelector<HTMLElement>(`[data-move="${at}"]`);
    if (!list || !el) return;
    const top = el.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (top + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + el.offsetHeight - list.clientHeight + 8;
  });
</script>

<svelte:window onkeydown={onkey} />

<div class="report">
  <div class="summary-wide card">
    <ReviewSummary {review} names={{ white: game.userSide === 'white' ? 'You' : game.white, black: game.userSide === 'black' ? 'You' : game.black }} current={current ? current.ply + 1 : 0} onselect={(ply) => go(review.all.findIndex((m) => m.ply === ply - 1))} counts={false} />
  </div>
  <div class="board-col">
    <Board {fen} viewOnly orientation={game.userSide} lastMove={current ? [key(current.move.from), key(current.move.to)] : undefined} {shapes} label="Review board" onswipe={(d) => go(at + (d === 'forward' ? 1 : -1))} />
    <!-- Right under the board on every screen (on phones it stays in view with the board). -->
    <div class="card nav-card">
      <MoveNav ply={at + 1} max={review.all.length} go={(p) => go(p - 1)} />
      <button class="btn slip" onclick={nextSlip}>Next slip</button>
    </div>
    <section class="explain card" aria-live="polite">
      {#if current}
        <div class="head">
          <MoveBadge kind={current.cls} size={34} />
          <div>
            <p class="title"><span class="num">{Math.floor(current.ply / 2) + 1}{current.color === 'white' ? '.' : '…'}</span> {current.san} · <span style="color: {BADGES[current.cls].color}">{BADGES[current.cls].label}</span></p>
            <p class="label">{BADGES[current.cls].meaning}.</p>
          </div>
          <span class="eval num">{evalLabel(current.after)}</span>
        </div>
        {#if better}
          <p class="better">Better was <strong>{better.san}</strong> (the green arrow).</p>
        {/if}
      {:else}
        <p class="label">Click a move, or use the ← → keys, to see each move's badge on the board.</p>
      {/if}
    </section>

  </div>

  <div class="side">
    <section class="summary card" aria-label="Accuracy and badges">
      <div class="who">
        <span></span>
        {#each players as p (p.color)}
          <div class="player" class:me={p.color === game.userSide}>
            <span class="disc {p.color}"></span>
            <span class="name">{p.color === game.userSide ? 'You' : p.name}</span>
            <strong class="acc num">{review.sides[p.color].accuracy}%</strong>
            <span class="label">accuracy</span>
          </div>
        {/each}
      </div>
      <table>
        <tbody>
          {#each BADGE_ORDER as c (c)}
            <tr>
              <th scope="row"><MoveBadge kind={c} size={26} /> <span>{BADGES[c].label}</span></th>
              {#each players as p (p.color)}
                <td class="num" class:zero={!review.sides[p.color].classes[c]} style="color: {review.sides[p.color].classes[c] ? BADGES[c].color : ''}">{review.sides[p.color].classes[c] ?? 0}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section class="moves card" aria-label="Moves" bind:this={list}>
      {#each rows as r (r.no)}
        <div class="row">
          <span class="no num">{r.no}.</span>
          {#each ['white', 'black'] as const as c (c)}
            {@const x = r[c]}
            {#if x}
              <button class="mv" class:on={x.i === at} data-move={x.i} onclick={() => go(x.i)}>
                <span>{x.m.san}</span>
                {#if x.m.cls !== 'good'}<MoveBadge kind={x.m.cls} size={26} />{/if}
              </button>
            {:else}
              <span></span>
            {/if}
          {/each}
        </div>
      {/each}
    </section>
  </div>
</div>

<style>
  .nav-card {
    padding: 0 10px 0 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nav-card :global(.nav) {
    border-top: 0;
    flex: 1;
    min-width: 0;
  }
  .slip {
    flex: none;
    white-space: nowrap;
  }
  .report {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    align-items: flex-start;
  }
  .summary-wide {
    flex: 1 1 100%;
    padding: 14px 16px;
  }
  .board-col {
    flex: 1 1 420px;
    max-width: 620px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* On phones the board stays in view while the moves scroll under it. */
  @media (max-width: 760px) {
    .board-col {
      position: sticky;
      top: env(safe-area-inset-top, 0px);
      z-index: 3;
      background: var(--bg);
      padding-bottom: 8px;
    }
    .board-col :global(.board) {
      width: min(100%, 52vh);
      margin: 0 auto;
    }
  }
  .nav {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
  }
  .side {
    flex: 1 1 340px;
    max-width: 460px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .card {
    padding: 14px 16px;
  }
  .who {
    display: grid;
    grid-template-columns: 1fr 76px 76px;
    gap: 8px;
    align-items: end;
    margin-bottom: 6px;
  }
  .player {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .player .name {
    font-size: 13px;
    color: var(--text-2);
    max-width: 76px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player.me .name {
    color: var(--text);
    font-weight: 600;
  }
  .acc {
    font-size: 24px;
    line-height: 1.1;
  }
  .disc {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid var(--border);
  }
  .disc.white {
    background: #f4f4f4;
  }
  .disc.black {
    background: #222;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  td {
    width: 76px;
    text-align: center;
    font-weight: 700;
    font-size: 16px;
  }
  td.zero {
    color: var(--text-3, var(--text-2));
    opacity: 0.45;
    font-weight: 500;
  }
  .explain {
    min-height: 118px;
  }
  .explain .head {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .explain .head > div {
    flex: 1;
    min-width: 0;
  }
  .explain p {
    margin: 0;
  }
  .explain .title {
    font-size: 17px;
  }
  .eval {
    font-weight: 700;
    color: var(--text-2);
  }
  .better {
    margin-top: 8px !important;
  }
  .moves {
    position: relative;
    max-height: 340px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    display: grid;
    grid-template-columns: 34px 1fr 1fr;
    gap: 6px;
    align-items: center;
  }
  .no {
    color: var(--text-2);
    font-size: 13px;
  }
  .mv {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-align: left;
  }
  .mv:hover {
    background: var(--raised);
  }
  .mv.on {
    background: var(--action);
    color: var(--on-action);
  }
</style>

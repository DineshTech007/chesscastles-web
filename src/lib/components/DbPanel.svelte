<script lang="ts">
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import { movesInRange, type BookSource } from '$lib/book/book';
  import { sanOf } from '$lib/chess/position';
  import { gamesDb, type GameHeader, type RefEntry } from '$lib/games/gamesDb';

  let {
    pos,
    book,
    onplay,
    played,
    onopen,
  }: {
    pos: Chess;
    book: BookSource;
    onplay: (m: NormalMove) => void;
    /** The move played next in the game being analysed, to compare. */
    played?: NormalMove;
    /** Opens a reference game at this position. */
    onopen?: (gameId: number) => void;
  } = $props();

  const FLOORS = [0, 2000, 2200, 2500];
  const TOP = 8;
  let floor = $state(0);
  type Row = { move: NormalMove; san: string; games: number; white: number; draws: number; black: number; score: number };
  let rows = $state<Row[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let showAll = $state(false);
  let refs = $state<{ ref: RefEntry; san: string; h?: GameHeader }[] | undefined>();
  let refsFailed = $state(false);
  let allRefs = $state(false);
  const REFS_SHOWN = 4;
  let token = 0;
  /** The three most-played moves, each with how players usually went on (most-played replies). */
  let topLines = $state<{ row: Row; text: string }[]>([]);

  async function continuation(start: Chess, first: NormalMove, t: number): Promise<string> {
    const p = start.clone();
    const parts: string[] = [];
    let m: NormalMove | undefined = first;
    for (let i = 0; i < 5 && m; i++) {
      const no = p.turn === 'white' ? `${p.fullmoves}. ` : !parts.length ? `${p.fullmoves}... ` : '';
      parts.push(no + sanOf(p, m));
      p.play(m);
      if (i === 4) break;
      const next = movesInRange(await book.entries(p), floor).filter((x) => p.isLegal(x.move));
      if (t !== token) return '';
      m = next.sort((a, b) => b.games - a.games)[0]?.move;
    }
    return parts.join(' ');
  }

  $effect(() => {
    const p = pos;
    const f = floor;
    const t = ++token;
    loading = true;
    // Wait a moment while the player clicks through moves.
    const timer = setTimeout(async () => {
      const entries = await book.entries(p);
      if (t !== token) return;
      const whiteToMove = p.turn === 'white';
      const list = movesInRange(entries, f)
        .filter((m) => p.isLegal(m.move))
        .map((m) => {
          const losses = m.games - m.wins - m.draws;
          return {
            move: m.move,
            san: sanOf(p, m.move),
            games: m.games,
            white: whiteToMove ? m.wins : losses,
            draws: m.draws,
            black: whiteToMove ? losses : m.wins,
            score: (m.wins + m.draws / 2) / Math.max(1, m.games),
          };
        });
      rows = list;
      showAll = false;
      total = list.reduce((s, r) => s + r.games, 0);
      loading = false;
      loadRefs(p, t);
      // The three most-played moves at once; how players went on fills in after.
      const top = [...list].sort((a, b) => b.games - a.games).slice(0, 3);
      topLines = top.map((row) => ({ row, text: `${p.turn === 'white' ? `${p.fullmoves}.` : `${p.fullmoves}...`} ${row.san}` }));
      top.forEach(async (row, i) => {
        const text = await continuation(p, row.move, t).catch(() => '');
        if (t === token && text && topLines[i]) topLines[i] = { row, text };
      });
    }, 180);
    return () => clearTimeout(timer);
  });

  async function loadRefs(p: Chess, t: number) {
    refs = undefined;
    refsFailed = false;
    allRefs = false;
    try {
      const list = (await gamesDb.refs(p)).filter((r) => p.isLegal(r.move));
      if (t !== token) return;
      refs = list.map((ref) => ({ ref, san: sanOf(p, ref.move) }));
      // Headers arrive one by one; the list fills in as they do.
      list.forEach(async (ref, i) => {
        const h = await gamesDb.header(ref.gameId).catch(() => undefined);
        if (t === token && refs?.[i]) refs[i] = { ...refs[i], h };
      });
    } catch {
      if (t === token) (refs = []), (refsFailed = true);
    }
  }

  const same = (a: NormalMove, b?: NormalMove) => !!b && a.from === b.from && a.to === b.to && a.promotion === b.promotion;
  /** The most-played move, and the best-scoring one among moves with a real sample. */
  const mostPlayed = $derived(rows[0]?.san);
  const bestScore = $derived.by(() => {
    const solid = rows.filter((r) => r.games >= Math.max(20, total * 0.05));
    if (solid.length < 2) return undefined;
    return solid.reduce((a, b) => (b.score > a.score ? b : a)).san;
  });
  const playedRow = $derived(played ? rows.find((r) => same(r.move, played)) : undefined);
  const playedSan = $derived(played && pos.isLegal(played) ? sanOf(pos, played) : undefined);

  const pct = (v: number, of: number) => Math.round((100 * v) / Math.max(1, of));
  const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(n));
  const short = (name: string) => {
    const [last, first] = name.split(', ');
    return first ? `${last}, ${first[0]}.` : name;
  };
</script>

<div class="db">
  <div class="db-head">
    <span class="title">Moves</span>
    <div class="chips" role="group" aria-label="Player rating">
      {#each FLOORS as f (f)}
        <button class="chip" aria-pressed={floor === f} onclick={() => (floor = f)}>{f ? `${f}+` : 'All'}</button>
      {/each}
    </div>
  </div>
  <div class="progress" class:on={loading}></div>

  {#if total && !loading}
    <p class="total label">{total.toLocaleString('en-IN')} rated games reached this position{floor ? ` (players ${floor}+)` : ''}.</p>
  {/if}
  {#if topLines.length}
    <ol class="top" aria-label="The three most-played moves">
      {#each topLines as l (l.row.san)}
        <li>
          <button class="top-btn" onclick={() => onplay(l.row.move)} title="Play {l.row.san}">
            <span class="games-chip num">{compact(l.row.games)}</span>
            <span class="top-text num">{l.text}</span>
            <span class="top-score num label">{Math.round(l.row.score * 100)}%</span>
          </button>
        </li>
      {/each}
    </ol>
  {/if}

  {#if playedSan && !loading}
    <p class="you" class:off={!playedRow}>
      {#if playedRow}
        Your move <strong>{playedSan}</strong>: played in {pct(playedRow.games, total)}% of games, scoring {Math.round(playedRow.score * 100)}%.
      {:else}
        Your move <strong>{playedSan}</strong> wasn't played by rated players here{floor ? ` (${floor}+)` : ''}.
        {#if mostPlayed}They chose <strong>{mostPlayed}</strong> most often.{/if}
      {/if}
    </p>
  {/if}

  {#if !rows.length && !loading}
    <p class="label empty">No rated games reached this position{floor ? ` at ${floor}+` : ''}.</p>
  {:else}
    <table>
      <thead>
        <tr><th>Move</th><th>Games</th><th>White · Draw · Black</th></tr>
      </thead>
      <tbody>
        {#each showAll ? rows : rows.slice(0, TOP) as r (r.san)}
          <tr class:mine={same(r.move, played)} onclick={() => onplay(r.move)} tabindex="0" onkeydown={(e) => e.key === 'Enter' && onplay(r.move)}>
            <td class="san">
              <span class="title">{r.san}</span>
              {#if r.san === mostPlayed}<span class="tag main">Main</span>{/if}
              {#if r.san === bestScore && r.san !== mostPlayed}<span class="tag best">Best score</span>{/if}
            </td>
            <td class="num games">{compact(r.games)}<span class="share label">{pct(r.games, total)}%</span></td>
            <td>
              <div class="wdb" aria-label="White {pct(r.white, r.games)}%, draw {pct(r.draws, r.games)}%, Black {pct(r.black, r.games)}%">
                {#each [['w', r.white], ['d', r.draws], ['b', r.black]] as [k, val] (k)}
                  {#if Number(val) > 0}
                    <span class={String(k)} style="flex: {val}">{pct(Number(val), r.games) >= 14 ? `${pct(Number(val), r.games)}%` : ''}</span>
                  {/if}
                {/each}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if rows.length > TOP && !showAll}
      <button class="btn ghost more" onclick={() => (showAll = true)}>Show all {rows.length} moves</button>
    {/if}
  {/if}

  <div class="refs">
    <span class="title">Reference games</span>
    {#if refs === undefined}
      <p class="label">Looking for strong games from this position…</p>
    {:else if refsFailed}
      <p class="label">Reference games couldn't be loaded right now.</p>
    {:else if !refs.length}
      <p class="label">No strong games stored for this position.</p>
    {:else}
      <ul>
        {#each allRefs ? refs : refs.slice(0, REFS_SHOWN) as r (r.ref.gameId)}
          <li>
            <button class="ref" onclick={() => onopen?.(r.ref.gameId)} disabled={!onopen}>
              {#if r.h}
                <span class="players">
                  <span>{short(r.h.white)}{#if r.h.whiteElo}<span class="label"> {r.h.whiteElo}</span>{/if}</span>
                  <span>{short(r.h.black)}{#if r.h.blackElo}<span class="label"> {r.h.blackElo}</span>{/if}</span>
                </span>
                <span class="meta label">{[r.h.event, r.h.year || ''].filter(Boolean).join(' · ')}</span>
                <span class="res title">{r.h.result.replace('1/2-1/2', '½-½')}</span>
              {:else}
                <span class="players label">Game {r.ref.gameId}{r.ref.elo ? ` · average ${r.ref.elo}` : ''}</span>
              {/if}
              <span class="next">played <strong>{r.san}</strong></span>
            </button>
          </li>
        {/each}
      </ul>
      {#if refs.length > REFS_SHOWN && !allRefs}
        <button class="btn ghost more" onclick={() => (allRefs = true)}>Show all {refs.length} games</button>
      {/if}
    {/if}
  </div>
  <p class="label foot">Rated over-the-board games (CaissaBase, 5.4 million games; engine games left out of the reference list). Tap a move to play it, or a game to open it.</p>
</div>

<style>
  .total {
    margin: 6px 0 0;
    font-size: 13px;
  }
  .top {
    list-style: none;
    margin: 6px 0 8px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .top-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .top-btn:hover {
    background: var(--raised);
  }
  .games-chip {
    flex: none;
    min-width: 52px;
    text-align: center;
    padding: 2px 6px;
    border-radius: 5px;
    font-weight: 800;
    font-size: 13.5px;
    background: var(--brand);
    color: var(--on-action);
  }
  .top-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .top-score {
    flex: none;
    font-size: 12.5px;
  }
  .db {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .db-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .title {
    font-size: 17px;
  }
  .chips {
    display: flex;
    gap: 4px;
  }
  .chips .chip {
    height: 30px;
    padding: 0 10px;
    font-size: 13px;
  }
  .progress {
    height: 2px;
    border-radius: 2px;
  }
  .progress.on {
    background: linear-gradient(90deg, transparent, var(--brand), transparent);
    background-size: 50% 100%;
    animation: slide 0.9s linear infinite;
  }
  @keyframes slide {
    from {
      background-position: -50% 0;
    }
    to {
      background-position: 150% 0;
    }
  }
  .you {
    margin: 0;
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 14px;
    background: color-mix(in srgb, var(--win) 14%, var(--card));
  }
  .you.off {
    background: color-mix(in srgb, var(--engine) 16%, var(--card));
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14.5px;
  }
  th {
    text-align: left;
    font-weight: 500;
    font-size: 12px;
    color: var(--muted);
    padding: 0 6px 4px;
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover,
  tbody tr:focus-visible {
    background: var(--raised);
  }
  tbody tr.mine {
    background: color-mix(in srgb, var(--brand) 18%, transparent);
  }
  td {
    padding: 6px;
  }
  .san {
    white-space: nowrap;
  }
  .san .title {
    font-size: 16px;
  }
  .tag {
    margin-left: 6px;
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 999px;
    vertical-align: 2px;
  }
  .tag.main {
    background: color-mix(in srgb, var(--brand) 25%, transparent);
    color: var(--accent);
  }
  .tag.best {
    background: var(--gold-soft);
    color: var(--gold);
  }
  .games {
    width: 92px;
    white-space: nowrap;
    font-weight: 600;
  }
  .share {
    margin-left: 5px;
    font-size: 12px;
  }
  .wdb {
    display: flex;
    height: 22px;
    border-radius: 6px;
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    min-width: 120px;
  }
  .wdb span {
    display: grid;
    place-items: center;
    min-width: 2px;
  }
  .wdb .w {
    background: #f2f5fb;
    color: #1b1f2a;
  }
  .wdb .d {
    background: #8c9bbe;
    color: #fff;
  }
  .wdb .b {
    background: #1b1f2a;
    color: #fff;
  }
  .more {
    align-self: flex-start;
    min-height: 36px;
    padding: 0 6px;
    font-size: 14.5px;
  }
  .refs {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .refs ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ref {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border-soft);
    background: var(--bg);
    text-align: left;
    cursor: pointer;
  }
  .ref:hover:not(:disabled) {
    border-color: var(--brand);
  }
  .players {
    display: flex;
    flex-direction: column;
    font-weight: 600;
    font-size: 14px;
  }
  .meta {
    grid-column: 1;
    font-size: 12px;
  }
  .res {
    grid-column: 2;
    grid-row: 1;
    font-size: 15px;
    align-self: center;
  }
  .next {
    grid-column: 2;
    grid-row: 2;
    font-size: 12px;
    color: var(--muted);
  }
  .empty,
  .foot,
  .refs .label {
    margin: 0;
  }
  .foot {
    font-size: 12px;
  }
</style>

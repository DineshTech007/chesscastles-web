<script lang="ts">
  /**
   * The opening's tree, as Chessable's "browse tree": from any position, every
   * move players of this opening met at the opponent's turns (marked when the
   * trainer covers it) and the student's options at their own turns (their
   * repertoire move marked, "make it mine" to change it for the whole
   * opening). Train or play from the position shown.
   */
  import { onMount, untrack } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { NormalMove } from 'chessops/types';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { destsOf, fenOf, keyOf, moveFromKeys, moveToUci, playSans, sanOf } from '$lib/chess/position';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { parseSan } from 'chessops/san';
  import { playMoveSound } from '$lib/sound';
  import { loadChoices, saveChoice, STUDY_ALT_GAMES, STUDY_ALT_SHARE } from './choices';
  import { StudyBook } from './studyBook';
  import { maia, maiaProgress, maiaStatus } from '$lib/engine/maia';
  import { engine } from '$lib/engine/stockfish';
  import type { StudyOpening } from './openingStudy';

  let { opening, book, start }: { opening: StudyOpening; book: StudyBook; start?: string } = $props();

  /** Replies the trainer teaches (its "all common replies"). */
  const COVER_SHARE = 0.05;
  const SHOW_SHARE = 0.01;

  let path = $state<string[]>(untrack(() => (start ?? opening.root).split(' ').filter(Boolean)));
  let rows = $state<{ move: NormalMove; uci: string; san: string; games: number; share: number; score: number }[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let choices = $state<Record<string, string>>({});
  let token = 0;

  const pos = $derived<Chess>(playSans(path.join(' ')));
  const mine = $derived(pos.turn === opening.side);
  const key = $derived(polyglotKey(pos).toString(16));
  /** The student's move here: their choice, else the most played. */
  const myMove = $derived(mine ? (choices[key] ?? rows[0]?.uci) : undefined);

  onMount(() => {
    choices = loadChoices(untrack(() => opening.id));
    maia.autoLoad(0);
  });

  // Few games here: what a human at a chosen rating would play (Maia), each checked by Stockfish.
  const FEW = 30;
  let humanElo = $state(1600);
  let human = $state<{ move: NormalMove; san: string; p: number; eval?: number }[]>([]);
  let humanBusy = $state(false);
  $effect(() => {
    const p = pos;
    const elo = humanElo;
    human = [];
    if (loading || total >= FEW || p.isEnd()) return;
    const t = token;
    humanBusy = true;
    (async () => {
      if (!(await maia.whenReady(8000))) return;
      const policy = (await maia.policy(p, elo)).filter((x) => x.p >= 0.04).slice(0, 4);
      if (t !== token) return;
      human = policy.map((x) => ({ move: x.move, san: sanOf(p, x.move), p: x.p }));
      for (const [i, h] of human.entries()) {
        const after = p.clone();
        after.play(h.move);
        const info = await engine.evaluate(fenOf(after), 12, 1, 1200);
        if (t !== token) return;
        const white = info ? (info.mate !== undefined ? (info.mate > 0 ? 99 : -99) : (info.cp ?? 0) / 100) : 0;
        human[i] = { ...h, eval: p.turn === 'white' ? white : -white };
        human = [...human];
      }
    })().finally(() => t === token && (humanBusy = false));
  });

  $effect(() => {
    const p = pos;
    const t = ++token;
    loading = true;
    book
      .entries(p)
      .then((entries) => {
        if (t !== token) return;
        const legal = entries.filter((e) => p.isLegal(e.move));
        const sum = legal.reduce((s, e) => s + e.games, 0);
        total = sum;
        rows = legal
          .map((e) => ({ move: e.move, uci: moveToUci(e.move), san: sanOf(p, e.move), games: e.games, share: sum ? e.games / sum : 0, score: e.games ? (e.wins + e.draws / 2) / e.games : 0 }))
          .filter((r) => r.share >= SHOW_SHARE || r.games >= 20)
          .sort((a, b) => b.games - a.games);
      })
      .catch(() => (rows = []))
      .finally(() => t === token && (loading = false));
  });

  function go(r: { move: NormalMove; san: string }) {
    playMoveSound(pos, r.move);
    path = [...path, r.san];
  }
  function onmove(orig: Key, dest: Key) {
    const m = moveFromKeys(pos, orig, dest);
    if (!pos.isLegal(m)) return;
    playMoveSound(pos, m);
    path = [...path, sanOf(pos, m)];
  }
  function makeMine(uci: string) {
    choices = saveChoice(opening.id, key, uci);
  }
  const no = (i: number) => (i % 2 === 0 ? `${i / 2 + 1}.` : '');
  const moveNo = $derived(`${Math.floor(path.length / 2) + 1}${path.length % 2 === 0 ? '.' : '...'}`);
  const sansParam = $derived(encodeURIComponent(path.join(' ')));
  const last = $derived.by((): Key[] | undefined => {
    if (!path.length) return undefined;
    const m = parseSan(playSans(path.slice(0, -1).join(' ')), path[path.length - 1]);
    return m && 'from' in m ? [keyOf(m.from), keyOf(m.to)] : undefined;
  });
</script>

<div class="tree">
  <div class="board-col">
    <Board fen={fenOf(pos)} orientation={opening.side} turnColor={pos.turn} movable={pos.isEnd() ? undefined : 'both'} dests={destsOf(pos)} lastMove={last} {onmove} label="Opening tree" />
    <div class="nav">
      <button class="btn small" onclick={() => (path = [])} disabled={!path.length}><Icon name="first" size={16} />Start</button>
      <button class="btn small" onclick={() => (path = path.slice(0, -1))} disabled={!path.length}><Icon name="back" size={16} />Back</button>
      <button class="btn small" onclick={() => (path = opening.root.split(' '))}>{opening.name}</button>
    </div>
  </div>
  <div class="side">
    <p class="crumbs">
      {#each path as san, i (i)}
        <button class="crumb" onclick={() => (path = path.slice(0, i + 1))}>{no(i)}{san}</button>
      {/each}
      {#if !path.length}<span class="label">The starting position</span>{/if}
    </p>
    <p class="label who">
      {#if mine}
        <strong>Your move.</strong> Your repertoire move is marked; pick another to make it yours for the whole {opening.name}.
      {:else}
        <strong>Your opponent's move.</strong> Every move players tried here; the ones in your training are marked.
      {/if}
      {total ? ` ${total.toLocaleString('en-IN')} games.` : ''}
    </p>
    {#if !loading && total < FEW && !pos.isEnd()}
      <div class="human card">
        <span class="title">What a human would play here</span>
        <span class="label">Few games reached this position, so the human-like engine (Maia) predicts the moves players rated</span>
        <div class="segmented" role="group" aria-label="Rating">
          {#each [1200, 1600, 2000, 2400] as e (e)}<button aria-pressed={humanElo === e} onclick={() => (humanElo = e)}>{e}</button>{/each}
        </div>
        {#if $maiaStatus === 'downloading'}
          <span class="label">Loading the human-like engine… {Math.round($maiaProgress * 100)}%</span>
        {:else if $maiaStatus === 'no-cache' || $maiaStatus === 'idle'}
          <button class="btn small" onclick={() => maia.download()}>Load the human-like engine (once, about 46 MB)</button>
        {:else if humanBusy && !human.length}
          <span class="label">Thinking…</span>
        {/if}
        {#each human as h (h.san)}
          <div class="row">
            <button class="mv" onclick={() => go(h)}>{moveNo}{h.san}</button>
            <span class="bar"><span style="width: {Math.max(3, h.p * 100)}%"></span></span>
            <span class="num">{Math.round(h.p * 100)}%</span>
            <span class="label num" title="Stockfish, for the side that plays it">{h.eval === undefined ? '…' : `${h.eval > 0 ? '+' : ''}${Math.abs(h.eval) >= 99 ? 'mate' : h.eval.toFixed(1)}`}</span>
            <span></span><span></span>
          </div>
        {/each}
      </div>
    {/if}
    {#if loading && !rows.length}
      <p class="label">Loading…</p>
    {:else if !rows.length}
      <p class="label">No games of this opening reached this position. Go back, or train and play from here anyway.</p>
    {:else}
      <div class="rows">
        {#each rows as r (r.uci)}
          {@const isMine = mine && r.uci === myMove}
          {@const covered = !mine && r.share >= COVER_SHARE && r.games >= 8}
          {@const option = mine && r.share >= STUDY_ALT_SHARE && r.games >= STUDY_ALT_GAMES}
          <div class="row" class:mine={isMine}>
            <button class="mv" onclick={() => go(r)}>{moveNo}{r.san}</button>
            <span class="bar"><span style="width: {Math.max(3, r.share * 100)}%"></span></span>
            <span class="num">{Math.round(r.share * 100)}%</span>
            <span class="label num">{r.games.toLocaleString('en-IN')}</span>
            <span class="label num" title="Score of the side that played it">{Math.round(r.score * 100)}%</span>
            <span class="tag">
              {#if isMine}<span class="pill yours">Your move</span>
              {:else if option}<button class="link-btn" onclick={() => makeMine(r.uci)}>Make it mine</button>
              {:else if covered}<span class="pill cov">In your training</span>{/if}
            </span>
          </div>
        {/each}
      </div>
      <p class="label legend">Columns: how often it was played, games, and the score of the side that played it.</p>
    {/if}
    <div class="acts">
      <a class="btn primary" href="/learn/openings/st-{opening.id}?from={sansParam}"><Icon name="tree" size={16} />Train from here</a>
      <a class="btn" href="/learn/study/{opening.id}?tab=play&moves={sansParam}"><Icon name="play" size={16} />Play from here</a>
    </div>
  </div>
</div>

<style>
  .tree {
    display: grid;
    grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .board-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .crumbs {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .crumb {
    border: 0;
    background: var(--raised);
    color: var(--text);
    border-radius: 6px;
    padding: 2px 6px;
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .who {
    margin: 0;
    line-height: 1.5;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 420px;
    overflow-y: auto;
  }
  .row {
    display: grid;
    grid-template-columns: 74px minmax(40px, 1fr) 42px 56px 42px auto;
    gap: 8px;
    align-items: center;
    padding: 5px 8px;
    border-radius: 8px;
    background: var(--raised);
  }
  .row.mine {
    outline: 2px solid var(--brand);
  }
  .mv {
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--border-soft);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--brand);
  }
  .tag {
    min-width: 0;
  }
  .yours {
    font-size: 11px;
    color: var(--brand);
  }
  .cov {
    font-size: 11px;
    color: var(--win);
  }
  .link-btn {
    border: 0;
    background: none;
    color: var(--brand);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    padding: 0;
  }
  .human {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
  }
  .human .segmented {
    align-self: flex-start;
  }
  .legend {
    margin: 0;
    font-size: 12px;
  }
  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  @media (max-width: 800px) {
    .tree {
      grid-template-columns: 1fr;
    }
    .row {
      grid-template-columns: 64px minmax(30px, 1fr) 38px 50px 38px;
    }
    .tag {
      grid-column: 1 / -1;
    }
  }
</style>

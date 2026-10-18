<script lang="ts">
  import { playMoveSound } from '$lib/sound';
  import FeatureGate from '$lib/components/FeatureGate.svelte';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { CloudBook } from '$lib/book/book';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { destsOf, fenOf, keyOf, moveFromKeys, moveToUci, positionFromFen, uciToMove } from '$lib/chess/position';
  import { findOpening, removeCustomOpening } from '$lib/customOpenings';
  import {
    buildTree,
    deleteTree,
    dueCount,
    grade,
    learnedCount,
    loadTree,
    nextLine,
    sameMove,
    saveTree,
    turnOf,
    userNodes,
    type OpeningTree,
    type TreeEdge,
  } from '$lib/study/openingTree';
  import { Recall } from '$lib/study/srs';
  import { POINTS, study } from '$lib/study/progress';
  import { masterOf, masterOpening, RepertoireBook } from '$lib/masters/repertoire';
  import { studyById, studyOpening } from '$lib/study/openingStudy';
  import { gamesDb, type GameHeader } from '$lib/games/gamesDb';

  const MAX_TRIES = 3;
  const opening = findOpening(page.params.id!) ?? masterOpening(page.params.id!) ?? studyOpening(page.params.id!);
  /** Opened from the opening study section: back goes there. */
  const studied = studyOpening(page.params.id!)?.study;
  const backHref = studied ? `/learn/study/${studied}` : '/learn';
  const backLabel = studied ? (studyById(studied)?.name ?? 'Opening study') : 'Learn';
  /** A great player's repertoire ("m-carlsen-white"), built from their own games. */
  const master = masterOf(page.params.id!);
  const otherSide = master ? `/learn/openings/m-${master.teacher}-${master.side === 'white' ? 'black' : 'white'}` : '';

  // Building.
  let tree = $state<OpeningTree | undefined>();
  let side = $state<'white' | 'black'>(opening?.side ?? 'white');
  let depth = $state(12);
  let floor = $state(2000);
  let allLines = $state(true);
  let building = $state(false);
  let progress = $state({ done: 0, queued: 1 });
  let buildError = $state('');

  // Training.
  type Phase = 'their' | 'yours' | 'right' | 'retry' | 'reveal' | 'done';
  let phase = $state<Phase>('their');
  let line = $state<TreeEdge[]>([]);
  let index = $state(0);
  let pos = $state<Chess | undefined>();
  let shownFen = $state('');
  let last = $state<Key[] | undefined>();
  let tries = $state(0);
  let reveal = $state<TreeEdge | undefined>();
  let stats = $state({ right: 0, missed: 0, lines: 0 });
  /** Strong players' games that reached the end of the line just trained. */
  let models = $state<{ h: GameHeader; href: string }[]>([]);
  let confirmRemove = false;
  let v = $state(0);
  let thinkingSince = 0;
  let token = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void) => {
    const t = token;
    const id = setTimeout(() => {
      timers.delete(id);
      if (t === token) fn();
    }, ms);
    timers.add(id);
  };

  onMount(() => {
    if (!opening) return;
    tree = loadTree(opening.id);
    if (tree) startLine();
  });
  onDestroy(() => {
    token++;
    for (const t of timers) clearTimeout(t);
  });

  async function build() {
    if (!opening) return;
    building = true;
    buildError = '';
    try {
      const t = await buildTree({
        book: master ? new RepertoireBook(master.teacher, master.side) : new CloudBook(),
        openingId: opening.id,
        rootSans: opening.sans,
        userSide: master ? master.side : side,
        depth,
        ratingFloor: master ? 0 : floor,
        maxReplies: allLines ? 3 : 1,
        onProgress: (done, queued) => (progress = { done, queued }),
      });
      if (!userNodes(t).length) {
        buildError = master ? 'Not enough games to build this repertoire.' : 'Not enough games from that rating for this opening. Try a lower rating.';
        return;
      }
      saveTree(t);
      tree = t;
      startLine();
    } catch {
      buildError = 'The games could not be loaded. Check your connection and try again.';
    } finally {
      building = false;
    }
  }

  const nodeKey = (p: Chess) => polyglotKey(p).toString(16);

  function show(p: Chess, lastMove?: Key[]) {
    shownFen = fenOf(p);
    last = lastMove;
    v++;
  }

  function startLine() {
    if (!tree) return;
    token++;
    line = nextLine(tree, Date.now());
    index = 0;
    reveal = undefined;
    pos = positionFromFen(tree.nodes[tree.rootKey].fen);
    show(pos);
    advance();
  }

  function playEdge(e: TreeEdge) {
    const m = uciToMove(e.uci);
    if (!m || !pos) return;
    playMoveSound(pos, m);
    pos.play(m);
    show(pos, [keyOf(m.from), keyOf(m.to)]);
  }

  function advance() {
    if (!tree || !pos) return;
    if (index >= line.length) {
      phase = 'done';
      void loadModels(pos.clone());
      stats.lines++;
      study.log('trainer', POINTS.trainerLine, `${opening?.name} line`);
      return;
    }
    if (turnOf(fenOf(pos)) === tree.userSide) {
      tries = 0;
      thinkingSince = Date.now();
      phase = 'yours';
      v++;
    } else {
      phase = 'their';
      v++;
      // From memory; the pause is only so the eye can follow.
      later(380, () => {
        playEdge(line[index]);
        index++;
        advance();
      });
    }
  }

  async function loadModels(at: Chess) {
    const t = token;
    models = [];
    try {
      const refs = (await gamesDb.refs(at)).sort((a, b) => b.elo - a.elo).slice(0, 10);
      const key = polyglotKey(at).toString(16);
      const got = await Promise.all(refs.map(async (r) => ({ h: await gamesDb.header(r.gameId), href: `/analysis?db=${r.gameId}&key=${key}` })));
      // Classical games only: no blitz, rapid or online events.
      const fast = /blitz|rapid|bullet|armageddon|online|titled|\binv\b|invitational|speed|blind|960/i;
      if (t === token) models = got.filter((g): g is { h: GameHeader; href: string } => !!g.h && !fast.test(g.h.event)).slice(0, 3);
    } catch {
      /* offline: no games shown */
    }
  }

  function onmove(orig: Key, dest: Key) {
    if (!tree || !pos || (phase !== 'yours' && phase !== 'retry')) return;
    const edge = line[index];
    const key = nodeKey(pos);
    const m = moveFromKeys(pos, orig, dest);
    if (sameMove(fenOf(pos), moveToUci(m), edge.uci)) {
      const q = tries > 0 ? Recall.wrong : Date.now() - thinkingSince < 8000 ? Recall.easy : Recall.slow;
      grade(tree, key, q, Date.now());
      saveTree(tree);
      if (tries === 0) {
        stats.right++;
        study.log('trainer', POINTS.trainerRight, `${opening?.name}: ${edge.san}`);
      }
      playEdge(edge);
      index++;
      phase = 'right';
      later(450, advance);
      return;
    }
    tries++;
    if (tries === 1) stats.missed++;
    if (tries < MAX_TRIES) {
      // Show the wrong move a moment, then take it back.
      phase = 'retry';
      const back = pos;
      const backLast = last;
      if (pos.isLegal(m)) {
        const wrong = pos.clone();
        wrong.play(m);
        show(wrong, [orig, dest]);
      }
      later(650, () => show(back, backLast));
      return;
    }
    // Out of tries: show the move, then play it.
    grade(tree, key, Recall.wrong, Date.now());
    saveTree(tree);
    phase = 'reveal';
    reveal = edge;
    show(pos, last);
    later(1100, () => {
      playEdge(edge);
      index++;
      later(900, () => {
        reveal = undefined;
        advance();
      });
    });
  }

  function reset() {
    if (!opening) return;
    deleteTree(opening.id);
    if (opening.id.startsWith('custom-') && confirmRemove) {
      removeCustomOpening(opening.id);
      location.href = '/learn';
      return;
    }
    tree = undefined;
    token++;
  }

  const view = $derived.by(() => {
    void v;
    if (!pos || !tree) return undefined;
    // Not while a wrong move is on show.
    const interactive = (phase === 'yours' || phase === 'retry') && shownFen === fenOf(pos);
    const r = reveal ? uciToMove(reveal.uci) : undefined;
    return {
      fen: shownFen,
      turn: turnOf(shownFen),
      movable: interactive ? tree.userSide : undefined,
      dests: interactive ? destsOf(pos) : new Map(),
      shapes: r ? [{ orig: keyOf(r.from), dest: keyOf(r.to), brush: 'green' }] : [],
      due: dueCount(tree, Date.now()),
      learned: learnedCount(tree),
      total: userNodes(tree).length,
    };
  });

  const prompt = $derived.by((): { icon: 'learn' | 'check' | 'undo' | 'close' | 'trophy'; text: string; tone: string } => {
    switch (phase) {
      case 'yours':
        return { icon: 'learn', text: `Your move: what do you play as ${tree?.userSide}?`, tone: 'var(--accent)' };
      case 'their':
        return { icon: 'learn', text: 'Your opponent is moving…', tone: 'var(--muted)' };
      case 'right':
        return { icon: 'check', text: 'Correct!', tone: 'var(--win)' };
      case 'retry':
        return {
          icon: 'undo',
          text: `Not quite: try again (${MAX_TRIES - tries} ${MAX_TRIES - tries === 1 ? 'try' : 'tries'} left)`,
          tone: 'var(--engine)',
        };
      case 'reveal':
        return { icon: 'close', text: `The move is ${reveal?.san}`, tone: 'var(--loss)' };
      case 'done':
        return { icon: 'trophy', text: 'Line complete. Ready for the next one?', tone: 'var(--gold)' };
    }
  });
</script>

<svelte:head><title>{opening?.name ?? 'Opening'} · Opening trainer · Chess Castles</title></svelte:head>

<FeatureGate feature="opening" ref={page.params.id} back={backHref} {backLabel}>
{#if !opening}
  <div class="card missing">That opening isn't in the list. <a href="/learn">Back to Learn</a></div>
{:else if !tree}
  <div class="setup-wrap">
    <section class="panel setup" aria-labelledby="build-h">
      <a class="back" href={backHref}><Icon name="back" size={16} />{backLabel}</a>
      <h1 id="build-h" class="display">{opening.name}</h1>
      <p class="label sans">{opening.sans}</p>
      {#if master}
        <p class="intro">{opening.blurb}</p>
        <a class="label switch" href={otherSide} data-sveltekit-reload>Train the openings with {master.side === 'white' ? 'Black' : 'White'} instead</a>
      {:else}
        <p class="intro">{opening.blurb} Chess Castles builds this opening from 5.4 million tournament games: at your turns the move strong players chose most, at your opponent's turns their popular replies.</p>
      {/if}

      {#if !master}
      <div class="group">
        <h2 class="title h">You play</h2>
        <div class="segmented" role="group" aria-label="Your side">
          <button aria-pressed={side === 'white'} onclick={() => (side = 'white')}>White</button>
          <button aria-pressed={side === 'black'} onclick={() => (side = 'black')}>Black</button>
        </div>
      </div>
      {/if}
      <div class="group">
        <h2 class="title h">How deep</h2>
        <div class="segmented" role="group" aria-label="Depth">
          <button aria-pressed={depth === 8} onclick={() => (depth = 8)}>4 moves</button>
          <button aria-pressed={depth === 12} onclick={() => (depth = 12)}>6 moves</button>
          <button aria-pressed={depth === 16} onclick={() => (depth = 16)}>8 moves</button>
          <button aria-pressed={depth === 20} onclick={() => (depth = 20)}>10 moves</button>
        </div>
      </div>
      <div class="group">
        <h2 class="title h">Lines</h2>
        <div class="segmented" role="group" aria-label="Lines">
          <button aria-pressed={!allLines} onclick={() => (allLines = false)}>Main line (fast)</button>
          <button aria-pressed={allLines} onclick={() => (allLines = true)}>All common replies</button>
        </div>
        <p class="label hint">{allLines ? (master ? 'Every reply that came up often in these games: thorough.' : 'Every reply strong players often meet: thorough.') : 'Only the most popular reply at each turn: ready in seconds.'}</p>
      </div>
      {#if !master}
      <div class="group">
        <h2 class="title h">Learn from players rated</h2>
        <div class="segmented" role="group" aria-label="Rating">
          {#each [1800, 2000, 2200, 2500] as f (f)}
            <button aria-pressed={floor === f} onclick={() => (floor = f)}>{f}+</button>
          {/each}
        </div>
        {#if floor === 2500}<p class="label hint">Grandmaster level: only games where the player was rated 2500 or more.</p>{/if}
      </div>
      {/if}

      {#if building}
        <div class="building">
          <div class="meter"><span style="width: {Math.min(100, (100 * progress.done) / Math.max(1, progress.queued))}%"></span></div>
          <span class="label">Reading positions from the games database… {progress.done} of {progress.queued}</span>
        </div>
      {:else}
        <button class="btn primary big block" onclick={build}><Icon name="learn" size={18} />Build and start training</button>
      {/if}
      {#if buildError}<p class="error">{buildError}</p>{/if}
    </section>
  </div>
{:else if view}
  <div class="trainer">
    <section class="board-col" aria-label="Training board">
      <div class="prompt" style="--tone: {prompt.tone}">
        <Icon name={prompt.icon} size={20} color={prompt.tone} />
        <span>{prompt.text}</span>
      </div>
      <Board
        fen={view.fen}
        orientation={tree.userSide}
        turnColor={view.turn}
        movable={view.movable}
        dests={view.dests}
        lastMove={last}
        shapes={view.shapes}
        label="Opening trainer board"
        {onmove}
      />
    </section>

    <aside class="side">
      <div class="card">
        <a class="back" href={backHref}><Icon name="back" size={16} />{backLabel}</a>
        <h1 class="title t-title">{opening.name}</h1>
        <div class="stats">
          <div><strong class="num">{view.due}</strong><span class="label">due</span></div>
          <div><strong class="num">{view.learned}/{view.total}</strong><span class="label">learned</span></div>
          <div><strong class="num" style="color: var(--win)">{stats.right}</strong><span class="label">right</span></div>
          <div><strong class="num" style="color: var(--loss)">{stats.missed}</strong><span class="label">missed</span></div>
        </div>
        <div class="meter"><span style="width: {view.total ? (100 * view.learned) / view.total : 0}%"></span></div>
        <p class="line">
          <span class="label">{opening.sans}</span>
          {#each line as e, i (i)}
            <span class:played={i < index} class:next={i === index && phase !== 'done'}>{e.san}</span>
          {/each}
        </p>
        {#if phase === 'done'}
          {#if models.length}
            <div class="models">
              <span class="label">Strong players' games that reached this position:</span>
              {#each models as g (g.h.id)}
                <a class="model" href={g.href}>
                  <span>{g.h.white} – {g.h.black}</span>
                  <span class="label">{g.h.result.replace('1/2-1/2', '½-½')} · {!g.h.year || g.h.event.includes(String(g.h.year)) ? g.h.event : `${g.h.event}, ${g.h.year}`}</span>
                </a>
              {/each}
            </div>
          {/if}
          <button class="btn primary block" onclick={startLine}><Icon name="replay" size={18} />Next line</button>
        {/if}
      </div>
      <div class="card small">
        <p class="label">Lines come back when they are due: wrong answers in ten minutes, right ones after a day, then six days, then longer.</p>
        <button class="btn ghost" onclick={reset}><Icon name="trash" size={16} />Start this opening again</button>
        {#if opening.id.startsWith('custom-')}
          <button class="btn ghost" onclick={() => ((confirmRemove = true), reset())}><Icon name="trash" size={16} />Delete this line</button>
        {/if}
      </div>
    </aside>
  </div>
{/if}
</FeatureGate>

<style>
  .switch {
    display: inline-block;
    margin-top: -4px;
    color: var(--brand);
  }
  .models {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .model {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--raised);
    color: var(--text);
    text-decoration: none;
  }
  .model:hover {
    outline: 1px solid var(--brand);
    text-decoration: none;
  }
  .missing {
    max-width: 600px;
    margin: 20px auto;
  }
  .setup-wrap {
    max-width: 620px;
    margin: 8px auto 0;
  }
  .setup {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
    align-self: flex-start;
  }
  h1.display {
    font-size: 42px;
  }
  .sans {
    margin: -8px 0 0;
  }
  .intro {
    margin: 0;
    color: var(--text-2);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .h {
    font-size: 16px;
    color: var(--accent);
  }
  .building {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .meter {
    height: 8px;
    border-radius: 4px;
    background: var(--raised);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--brand);
    transition: width 0.3s;
  }
  .error {
    margin: 0;
    color: var(--loss);
  }
  .hint {
    margin: 0;
  }
  .trainer {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    max-width: 1240px;
    margin: 0 auto;
    justify-content: center;
    align-items: flex-start;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 200px), 720px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .prompt {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--tone) 14%, var(--card));
    border: 1px solid color-mix(in srgb, var(--tone) 50%, transparent);
    font-weight: 600;
  }
  .side {
    flex: 1 1 320px;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .side .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .t-title {
    font-size: 22px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    text-align: center;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    background: var(--raised);
    border-radius: var(--r-control);
    padding: 8px 4px;
  }
  .stats strong {
    font-family: var(--font-title);
    font-size: 20px;
  }
  .line {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    font-weight: 600;
    line-height: 1.6;
  }
  .line span:not(.label) {
    color: var(--muted);
  }
  .line .played {
    color: var(--text) !important;
  }
  .line .next {
    color: var(--accent) !important;
    text-decoration: underline;
  }
  .small p {
    margin: 0;
  }
  .small .btn {
    align-self: flex-start;
  }
</style>

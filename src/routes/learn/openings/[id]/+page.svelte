<script lang="ts">
  import { playMoveSound } from '$lib/sound';
  import FeatureGate from '$lib/components/FeatureGate.svelte';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import type { Chess } from 'chessops/chess';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import { promotionFor } from '$lib/chess/promotion';
  import Icon from '$lib/components/Icon.svelte';
  import { CloudBook } from '$lib/book/book';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { destsOf, fenOf, keyOf, moveFromKeys, moveToUci, positionFromFen, uciToMove } from '$lib/chess/position';
  import { findOpening, removeCustomOpening } from '$lib/customOpenings';
  import {
    buildTree,
    choicePoints,
    pathTo,
    shareOf,
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
    type TreeNode,
  } from '$lib/study/openingTree';
  import { Recall } from '$lib/study/srs';
  import { POINTS, study } from '$lib/study/progress';
  import { masterOf, masterOpening, RepertoireBook } from '$lib/masters/repertoire';
  import { studyById, studyOpening } from '$lib/study/openingStudy';
  import { HybridBook, StudyBook } from '$lib/study/studyBook';
  import { maia } from '$lib/engine/maia';
  import { get } from 'svelte/store';
  import { kfideAll } from '$lib/stores/me';
  import { loadChoices, setChoices, STUDY_ALT_GAMES, STUDY_ALT_SHARE } from '$lib/study/choices';
  import { engine, evalLabel, type EngineInfo } from '$lib/engine/stockfish';
  import DbPanel from '$lib/components/DbPanel.svelte';
  import { openingNotes } from '$lib/coach/facts';
  import { noteText } from '$lib/coach/explain';
  import { loadCoach } from '$lib/coach/progress';
  import { gamesDb, type GameHeader } from '$lib/games/gamesDb';

  const MAX_TRIES = 3;
  const baseOpening = findOpening(page.params.id!) ?? masterOpening(page.params.id!) ?? studyOpening(page.params.id!);
  /** "Train from here" in the opening study's tree: any position of the opening (its own progress, kept apart). */
  const fromSans = studyOpening(page.params.id!) ? page.url.searchParams.get('from')?.trim() : undefined;
  const hashOf = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  const opening = baseOpening && fromSans ? { ...baseOpening, sans: fromSans, id: `${baseOpening.id}@${hashOf(fromSans)}`, name: `${baseOpening.name}: from ${fromSans.split(' ').slice(-4).join(' ')}` } : baseOpening;
  /** Opened from the opening study section: back goes there. */
  const studied = studyOpening(page.params.id!)?.study;
  const backHref = studied ? `/learn/study/${studied}` : '/learn';
  const backLabel = studied ? (studyById(studied)?.name ?? 'Opening study') : 'Learn';
  /** A great player's repertoire ("m-carlsen-white"), built from their own games. */
  const master = masterOf(page.params.id!);
  const otherSide = master ? `/learn/openings/m-${master.teacher}-${master.side === 'white' ? 'black' : 'white'}` : '';

  // Building.
  let tree = $state<OpeningTree | undefined>();
  /** Study openings: continue lines with the engines where the opening's games run out. */
  let extend = $state(true);
  let hybrid: HybridBook | undefined;
  /** The rating Maia predicts the opponent's replies for: the player's CC Rating, else 1800. */
  const engineElo = () => {
    const r = Object.values(get(kfideAll)).find((x) => x.games)?.rating;
    return Math.min(2400, Math.max(1200, r ?? 1800));
  };
  let side = $state<'white' | 'black'>(opening?.side ?? 'white');
  // Study openings go deeper by default (10 moves), like a course.
  let depth = $state(studyOpening(page.params.id!) ? 20 : 12);
  let floor = $state(2000);
  let allLines = $state(true);
  let building = $state(false);
  let progress = $state({ done: 0, queued: 1 });
  let buildError = $state('');

  // Training.
  type Phase = 'their' | 'yours' | 'right' | 'retry' | 'reveal' | 'done' | 'alt';
  /** The player played another main move here: offer to make it theirs. */
  let altOffer = $state<{ key: string; edge: TreeEdge; usual: TreeEdge; share: number } | undefined>();
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
    // The human-like engine continues study lines where the games run out.
    if (studied) maia.autoLoad(0);
    tree = loadTree(opening.id);
    if (tree) startLine();
  });
  onDestroy(() => {
    token++;
    for (const t of timers) clearTimeout(t);
  });

  /** Builds the tree; with `choices` (the player's own moves) a rebuild keeps the settings and what was learnt. */
  async function build(choices?: Record<string, string>) {
    if (!opening) return;
    const old = choices ? tree : undefined;
    building = true;
    buildError = '';
    try {
      const t = await buildTree({
        // A study opening learns from its own games (and every reply its opponents tried), continued by our engines where
        // the games run out; a master's repertoire from their games.
        book: studied ? (hybrid = extend ? new HybridBook(new StudyBook(studied), opening.side, engineElo()) : undefined) ?? new StudyBook(studied) : master ? new RepertoireBook(master.teacher, master.side) : new CloudBook(),
        openingId: opening.id,
        rootSans: opening.sans,
        userSide: old?.userSide ?? (master ? master.side : side),
        depth: old?.depth ?? depth,
        ratingFloor: old?.ratingFloor ?? (master || studied ? 0 : floor),
        maxReplies: old?.maxReplies ?? (allLines ? (studied ? 4 : 3) : 1),
        minShare: studied ? 0.05 : undefined,
        // A study opening: the student's repertoire choices, kept for the whole opening.
        choices: choices ?? (studied ? loadChoices(studied) : {}),
        altShare: studied ? STUDY_ALT_SHARE : undefined,
        altMinGames: studied ? STUDY_ALT_GAMES : undefined,
        onProgress: (done, queued) => (progress = { done, queued }),
      });
      if (old) t.cards = old.cards;
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
    why = '';
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
      explored = engineOn || dbOn;
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

  /** Makes another main move the player's own at a position, and rebuilds the rest of the line from it. */
  /** Earlier sets of choices, for Undo. */
  let history = $state<Record<string, string>[]>([]);
  /** Rebuilds the tree with these choices (kept for the whole opening in a study). */
  async function applyChoices(all: Record<string, string>) {
    if (!tree) return;
    token++;
    altOffer = undefined;
    history = [...history.slice(-9), { ...(tree.choices ?? {}) }];
    if (studied) setChoices(studied, all);
    await build(all);
  }
  const choose = (key: string, uci: string) => applyChoices({ ...(tree?.choices ?? {}), [key]: uci });
  /** Back to the most played move at a position. */
  function mostPlayed(key: string) {
    const all = { ...(tree?.choices ?? {}) };
    delete all[key];
    void applyChoices(all);
  }
  async function undoChoice() {
    const prev = history[history.length - 1];
    if (!prev || !tree) return;
    history = history.slice(0, -1);
    token++;
    if (studied) setChoices(studied, prev);
    await build(prev);
  }
  /** The options at a choice point: the current move and the most played others, three at most, most played first. */
  function optionsAt(n: TreeNode): TreeEdge[] {
    const all = [...n.next, ...(n.alts ?? [])].sort((a, b) => b.games - a.games);
    const top = all.slice(0, 3);
    return top.includes(n.next[0]) ? top : [...top.slice(0, 2), n.next[0]];
  }
  /** Show every choice point, or (default) only those on the line being trained. */
  let allChoicePoints = $state(false);
  const sortedChoices = $derived.by(() => {
    if (!tree) return [];
    const onLine = new Set([tree.rootKey, ...line.map((e) => e.child)]);
    const all = choicePoints(tree).sort((a, b) => Number(onLine.has(b.key)) - Number(onLine.has(a.key)) || a.ply - b.ply);
    return allChoicePoints ? all : all.filter((n) => onLine.has(n.key));
  });
  const choiceCount = $derived(tree ? choicePoints(tree).length : 0);
  const lineKeys = $derived(new Set(tree ? [tree.rootKey, ...line.map((e) => e.child)] : []));
  /** The engine's score for each option at a choice point (for the side choosing), in pawns. */
  let evals = $state<Record<string, number | 'busy'>>({});
  // Explore: the engine and the database on the position, to understand the move before learning it.
  let engineOn = $state(false);
  let dbOn = $state(false);
  let explored = false;
  let evalInfo = $state<EngineInfo | undefined>();
  /** Why the move just learnt is good: checked facts and how strong players chose and scored with it. */
  let why = $state('');
  const exploreBook = $derived(studied ? new StudyBook(studied) : master ? new RepertoireBook(master.teacher, master.side) : new CloudBook());

  $effect(() => {
    void v;
    const p = pos;
    evalInfo = undefined;
    if (!engineOn || !p || p.isEnd()) {
      engine.stopAnalysis();
      return;
    }
    const f = fenOf(p);
    void engine.analyse(f, (i) => {
      if (i.fen === f) evalInfo = i;
    }, 18);
  });
  // Looking at the engine or the database before answering counts as a hint.
  $effect(() => {
    if ((engineOn || dbOn) && (phase === 'yours' || phase === 'retry')) explored = true;
  });

  function explain(before: Chess, e: TreeEdge) {
    const m = uciToMove(e.uci);
    if (!m || !tree) return;
    const lang = loadCoach().lang;
    const notes = openingNotes(before, m).slice(0, 2).map((n) => noteText(n, lang));
    const node = tree.nodes[nodeKey(before)];
    const share = node ? shareOf(node, e) : 0;
    const byEngine = hybrid?.engineKeys.has(nodeKey(before));
    const stat = byEngine
      ? `Few games reached this position, so this move is the engine's choice (Stockfish for your moves, the human-like engine for your opponent's).`
      : e.games
        ? `Strong players chose ${e.san} in ${Math.round(share * 100)}% of ${e.games.toLocaleString('en-IN')} games${e.score !== undefined ? ` and scored ${Math.round(e.score * 100)}%` : ''}.`
        : '';
    why = [...notes, stat].filter(Boolean).join(' ');
  }
  async function checkWithEngine(n: TreeNode) {
    for (const e of [...n.next, ...(n.alts ?? [])]) {
      const k = `${n.key}:${e.uci}`;
      if (evals[k] !== undefined) continue;
      evals = { ...evals, [k]: 'busy' };
      const p = positionFromFen(n.fen);
      const m = uciToMove(e.uci);
      if (!m || !p.isLegal(m)) continue;
      const mover = p.turn;
      p.play(m);
      const info = await engine.evaluate(fenOf(p), 14, 1, 2500);
      const white = info ? (info.mate !== undefined ? (info.mate > 0 ? 99 : -99) : (info.cp ?? 0) / 100) : 0;
      evals = { ...evals, [k]: mover === 'white' ? white : -white };
    }
  }
  const evalText = (v: number | 'busy' | undefined) => (v === undefined ? '' : v === 'busy' ? '…' : Math.abs(v) >= 99 ? (v > 0 ? 'mates' : 'loses') : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);

  function keepUsual() {
    altOffer = undefined;
    phase = 'yours';
    v++;
  }

  async function onmove(orig: Key, dest: Key) {
    if (!tree || !pos || (phase !== 'yours' && phase !== 'retry')) return;
    const edge = line[index];
    const key = nodeKey(pos);
    const promotion = await promotionFor(pos, orig, dest, uciToMove(edge.uci));
    if (promotion === null) return board?.resync();
    const m = moveFromKeys(pos, orig, dest, promotion);
    // Another main move of strong players: not a mistake, the player may make it theirs.
    const node = tree.nodes[key];
    const alt = node?.alts?.find((a) => sameMove(fenOf(pos!), moveToUci(m), a.uci));
    if (alt && node) {
      altOffer = { key, edge: alt, usual: edge, share: shareOf(node, alt) };
      phase = 'alt';
      v++;
      return;
    }
    if (sameMove(fenOf(pos), moveToUci(m), edge.uci)) {
      const q = tries > 0 ? Recall.wrong : explored ? Recall.slow : Date.now() - thinkingSince < 8000 ? Recall.easy : Recall.slow;
      explain(pos.clone(), edge);
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
    explain(pos.clone(), edge);
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
      case 'alt':
        return { icon: 'check', text: `${altOffer?.edge.san} is also a main move here`, tone: 'var(--live)' };
      case 'done':
        return { icon: 'trophy', text: 'Line complete. Ready for the next one?', tone: 'var(--gold)' };
    }
  });
  let board: Board | undefined = $state();
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
      {:else if studied}
        <p class="intro">{opening.blurb} Built from the real games of this opening only: at your turns the move its players choose most (you can make another main move yours as you train), at your opponent's turns every reply that comes up in 5% of games or more.</p>
      {:else}
        <p class="intro">{opening.blurb} Chess Castles builds this opening from 5.4 million tournament games: at your turns the move strong players chose most, at your opponent's turns their popular replies.</p>
      {/if}

      {#if !master && !studied}
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
          {#if studied}<button aria-pressed={depth === 26} onclick={() => (depth = 26)}>13 moves</button>{/if}
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
      {#if studied}
      <div class="group">
        <label class="toggle"><input type="checkbox" bind:checked={extend} /><span>Continue with our engines where the games run out</span></label>
        <p class="label hint">Stockfish chooses your moves and Maia, the human-like engine, the replies players at your level make: deeper lines, like a course author's analysis.</p>
      </div>
      {/if}
      {#if !master && !studied}
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
        <button class="btn primary big block" onclick={() => build()}><Icon name="learn" size={18} />Build and start training</button>
      {/if}
      {#if buildError}<p class="error">{buildError}</p>{/if}
    </section>
  </div>
{:else if view}
  <div class="trainer">
    <section class="board-col" aria-label="Training board">
      <div class="prompt" style="--tone: {prompt.tone}">
        <Icon name={prompt.icon} size={20} color={prompt.tone} />
        <span>{building ? 'Building your line…' : prompt.text}</span>
      </div>
      {#if altOffer && phase === 'alt'}
        <div class="card alt-offer">
          <p>
            <strong>{altOffer.edge.san}</strong> is also a main move here: strong players chose it in {Math.round(altOffer.share * 100)}% of games
            ({altOffer.edge.games.toLocaleString('en-IN')}). This trainer has been teaching <strong>{altOffer.usual.san}</strong>. Which do you play?
          </p>
          <div class="alt-btns">
            <button class="btn primary" onclick={() => choose(altOffer!.key, altOffer!.edge.uci)} disabled={building}>I play {altOffer.edge.san}: make it my move</button>
            <button class="btn" onclick={keepUsual}>Keep {altOffer.usual.san}</button>
          </div>
        </div>
      {/if}
      <Board bind:this={board}
        fen={view.fen}
        orientation={tree.userSide}
        turnColor={view.turn}
        movable={view.movable}
        dests={view.dests}
        lastMove={last}
        shapes={engineOn && evalInfo?.pv[0] && uciToMove(evalInfo.pv[0]) ? [...view.shapes, { orig: keyOf(uciToMove(evalInfo.pv[0])!.from), dest: keyOf(uciToMove(evalInfo.pv[0])!.to), brush: 'blue' }] : view.shapes}
        label="Opening trainer board"
        {onmove}
      />
      <div class="explore">
        <label class="toggle"><input type="checkbox" bind:checked={engineOn} /><span>Engine{engineOn && evalInfo ? ` ${evalLabel(evalInfo)}` : ''}</span></label>
        <label class="toggle"><input type="checkbox" bind:checked={dbOn} /><span>Database</span></label>
        <span class="label">Looking before you answer counts as a hint.</span>
      </div>
      {#if why}<p class="why"><strong>Why:</strong> {why}</p>{/if}
      {#if dbOn && pos}
        <div class="card db-card">
          {#key fenOf(pos)}
            <DbPanel pos={pos} book={exploreBook} onplay={(m) => onmove(keyOf(m.from), keyOf(m.to))} />
          {/key}
        </div>
      {/if}
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
      {#if choiceCount}
        <div class="card small choices">
          <div class="choices-head">
            <span class="title">Your choices</span>
            <span class="choices-btns">
              <button class="link-btn label" onclick={undoChoice} disabled={!history.length || building}>Undo</button>
              {#if Object.keys(tree.choices ?? {}).length}<button class="link-btn label" onclick={() => applyChoices({})} disabled={building}>Reset all</button>{/if}
            </span>
          </div>
          <span class="label">Where players have more than one main move, pick the one from your own preparation.</span>
          <div class="segmented scope" role="group" aria-label="Which choices">
            <button aria-pressed={!allChoicePoints} onclick={() => (allChoicePoints = false)}>This line</button>
            <button aria-pressed={allChoicePoints} onclick={() => (allChoicePoints = true)}>All ({choiceCount})</button>
          </div>
          {#if !sortedChoices.length}<span class="label">No other main moves on this line.</span>{/if}
          <div class="choice-list">
            {#each sortedChoices as n (n.key)}
              {@const path = pathTo(tree, n.key)}
              {@const no = `${Math.floor(n.ply / 2) + 1}${n.ply % 2 === 0 ? '.' : '...'}`}
              {@const opts = optionsAt(n)}
              {@const top = [...n.next, ...(n.alts ?? [])].sort((x, y) => y.games - x.games)[0]}
              <div class="choice" class:current={lineKeys.has(n.key)}>
                <span class="choice-h">
                  <span class="label ctx">After {[...tree.rootSans.split(' ').filter(Boolean), ...path].slice(-6).join(' ') || 'the start'}</span>
                  <button class="link-btn label" onclick={() => checkWithEngine(n)}>Engine</button>
                </span>
                <span class="opts">
                  {#each opts as e (e.uci)}
                    {@const ev = evals[`${n.key}:${e.uci}`]}
                    <button class="chip opt" aria-pressed={e.uci === n.next[0].uci} disabled={building || e.uci === n.next[0].uci} onclick={() => choose(n.key, e.uci)}
                      title="{e.games} games{e.score !== undefined ? `, scored ${Math.round(e.score * 100)}%` : ''}">
                      {no}{e.san}
                      <span class="opt-meta">{e === top ? 'most played · ' : ''}{Math.round(shareOf(n, e) * 100)}%{e.score !== undefined ? ` · ${Math.round(e.score * 100)}% score` : ''}{ev !== undefined ? ` · ${evalText(ev)}` : ''}</span>
                    </button>
                  {/each}
                </span>
                {#if tree.choices?.[n.key] && n.next[0].uci !== top.uci}
                  <button class="link-btn label" onclick={() => mostPlayed(n.key)} disabled={building}>Back to the most played ({no}{top.san})</button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
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
  .explore {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
  }
  .toggle {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    cursor: pointer;
  }
  .why {
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--raised);
    line-height: 1.5;
  }
  .db-card {
    padding: 12px;
    max-height: 420px;
    overflow-y: auto;
  }
  .alt-offer {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-color: color-mix(in srgb, var(--live) 50%, var(--border));
  }
  .alt-offer p {
    margin: 0;
    line-height: 1.5;
  }
  .alt-btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .choices-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .choices-btns {
    display: flex;
    gap: 12px;
  }
  .scope {
    align-self: flex-start;
  }
  .choice-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 340px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .choice.current {
    border-left: 3px solid var(--brand);
    padding-left: 8px;
  }
  .ctx {
    font-size: 12px;
  }
  .link-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .choice-h {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .link-btn {
    border: 0;
    background: none;
    color: var(--brand);
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  .opt {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    height: auto;
    padding: 5px 10px;
  }
  .opt-meta {
    font-size: 11px;
    opacity: 0.8;
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .choice {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
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

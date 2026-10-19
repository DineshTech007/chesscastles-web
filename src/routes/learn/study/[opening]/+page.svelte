<script lang="ts">
  /**
   * One opening to study: its lines and the middlegame plans of each, the
   * trainer, model games, puzzles from real games (middlegame and endgame,
   * three levels) and play against a FIDE-rated opponent, all filtered by line.
   */
  import { onMount, untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PuzzleBoard from '$lib/components/PuzzleBoard.svelte';
  import LimitReached from '$lib/components/LimitReached.svelte';
  import GameViewer from '$lib/study/GameViewer.svelte';
  import ChoicePicker from '$lib/study/ChoicePicker.svelte';
  import RepertoireTree from '$lib/study/RepertoireTree.svelte';
  import StrategyFacts from '$lib/study/StrategyFacts.svelte';
  import { StudyBook } from '$lib/study/studyBook';
  import { fenOf, playSans } from '$lib/chess/position';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { LANGS, tr, type Lang } from '$lib/coach/i18n';
  import { loadCoach, updateCoach } from '$lib/coach/progress';
  import { dueCount, learnedCount, loadTree, userNodes, type OpeningTree } from '$lib/study/openingTree';
  import { curatedFor, planOf, PLANS, studyById, studyTrainerId, type StudyLine } from '$lib/study/openingStudy';
  import { eventYear, LEVELS, loadMiddlegame, loadSolved, loadStudy, puzzleId, saveSolved, type MiddlegameLesson, type ModelGame, type StudyData, type StudyPuzzle } from '$lib/study/studyData';
  import { loadStars } from '$lib/masters/data';
  import { playerName } from '$lib/masters/content';
  import { POINTS, study } from '$lib/study/progress';
  import { TIME_CONTROLS, TIME_CONTROL_ORDER, tcLabel } from '$lib/game/fideGame';
  import { kfideAll } from '$lib/stores/me';
  import { speedOf } from '$lib/kfide';
  import { hasGate, requireGate, useFeature } from '$lib/plans';
  import { loadInsights } from '$lib/insights/store';
  import { isWeak, resultText, savedAsImported, studyStats, type StudyLineStat } from '$lib/study/fromGames';
  import { shownGames } from '$lib/stores/me';
  import type { ImportedGame } from '$lib/insights/games';
  import type { AnalyzedGame } from '$lib/insights/analysis';

  type Tab = 'plans' | 'tree' | 'trainer' | 'games' | 'middlegame' | 'puzzles' | 'play';
  const TABS: { id: Tab; label: string; icon: 'learn' | 'tree' | 'book' | 'puzzle' | 'play' | 'crown' }[] = [
    { id: 'plans', label: 'Lines & plans', icon: 'learn' },
    { id: 'tree', label: 'Browse tree', icon: 'tree' },
    { id: 'trainer', label: 'Trainer', icon: 'tree' },
    { id: 'games', label: 'Model games', icon: 'book' },
    { id: 'middlegame', label: 'Middlegame', icon: 'crown' },
    { id: 'puzzles', label: 'Puzzles', icon: 'puzzle' },
    { id: 'play', label: 'Play it', icon: 'play' },
  ];

  const opening = studyById(page.params.opening!);
  /** The opening's own book, for the "your move here" pickers. */
  const ownBook = new StudyBook(page.params.opening!);
  const plans = opening ? PLANS[opening.id] : undefined;
  const q = page.url.searchParams;

  let tab = $state<Tab>(TABS.some((t) => t.id === q.get('tab')) ? (q.get('tab') as Tab) : 'plans');
  let line = $state<string>(q.get('line') ?? 'all');
  let lang = $state<Lang>('en');
  let data = $state<StudyData | undefined>();
  let failed = $state(false);
  let trees = $state<Record<string, OpeningTree | undefined>>({});
  let mg = $state<MiddlegameLesson[]>([]);
  let mgStars = $state<Record<string, number>>({});
  /** The player's own results in this opening's lines (from the games imported for Insights). */
  /** The player's games from chess.com or Lichess (Game Insights), and where they came from. */
  let onlineGames = $state<(ImportedGame | AnalyzedGame)[]>([]);
  /** The player's own games for the "lines from your games" section: Chess Castles, chess.com/Lichess, or both. */
  let mineSource = $state<'all' | 'cc' | 'online'>('all');
  const ccGames = $derived($shownGames.map(savedAsImported).filter((g): g is ImportedGame => !!g));
  const mine = $derived.by((): StudyLineStat[] => {
    if (!opening) return [];
    const games = mineSource === 'cc' ? ccGames : mineSource === 'online' ? onlineGames : [...ccGames, ...onlineGames];
    return studyStats(games).filter((x) => x.opening === opening.id);
  });
  /** Whether each source has games in this opening at all (the switch shows only when both do). */
  const ccHas = $derived(!!opening && studyStats(ccGames).some((x) => x.opening === opening.id));
  const onlineHas = $derived(!!opening && studyStats(onlineGames).some((x) => x.opening === opening.id));
  let mineFrom = $state('');

  // Model games.
  let viewing = $state<ModelGame | undefined>();
  // Puzzles.
  let puzzlePhase = $state<'middlegame' | 'endgame'>('middlegame');
  let level = $state<1 | 2 | 3>(1);
  let solved = $state<Record<string, boolean>>({});
  let puzzle = $state<StudyPuzzle | undefined>();
  let puzzleResult = $state<boolean | undefined>();
  let puzzleLimited = $state(false);
  let puzzleRound = $state(0);
  // Play.
  let rating = $state(1600);
  let tc = $state(2);
  /** Start at the line's position (its moves already played), or play the line's moves yourself from the start. */
  let fromPosition = $state(true);

  onMount(async () => {
    lang = loadCoach().lang;
    solved = loadSolved();
    const ins = loadInsights();
    if (ins && opening) {
      onlineGames = ins.games;
      mineFrom = `${ins.site === 'chesscom' ? 'chess.com' : 'Lichess'} (${ins.username})`;
    }
    try {
      const s = JSON.parse(localStorage.getItem('k24.playSetup') ?? '{}');
      if (typeof s.rating === 'number') rating = Math.min(2800, Math.max(1400, s.rating));
      if (Number.isInteger(s.tc)) tc = Math.min(TIME_CONTROLS.length - 1, Math.max(0, s.tc));
    } catch {
      /* defaults */
    }
    if (!opening) return;
    const t: Record<string, OpeningTree | undefined> = { [studyTrainerId(opening.id)]: loadTree(studyTrainerId(opening.id)) };
    for (const l of opening.lines) t[studyTrainerId(opening.id, l.id)] = loadTree(studyTrainerId(opening.id, l.id));
    trees = t;
    mgStars = loadStars();
    void loadMiddlegame(opening.id).then((l) => (mg = l), () => {});
    try {
      data = await loadStudy(opening.id);
    } catch {
      failed = true;
    }
  });

  function setLang(l: Lang) {
    lang = l;
    updateCoach({ lang: l });
  }
  function show(t: Tab, l?: string) {
    tab = t;
    if (l) line = l;
    viewing = undefined;
    document.querySelector('.tabs')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  const lineName = (id: string) => opening?.lines.find((l) => l.id === id)?.name ?? 'Other lines';
  const lineSans = (l: StudyLine) => l.sans.split(' ').slice(opening!.root.split(' ').length).join(' ');
  /** The position at the end of a line (or the opening), and its key (where model games open). */
  const endOf = (sans: string) => {
    const p = playSans(sans);
    return { fen: fenOf(p), key: polyglotKey(p).toString(16) };
  };
  const shownLines = $derived(opening ? opening.lines.filter((l) => line === 'all' || l.id === line) : []);
  const totalVariations = $derived(opening ? opening.lines.reduce((s, l) => s + (l.variations ?? 0), 0) : 0);

  // Model games for the chosen line(s).
  const models = $derived.by(() => {
    if (!data || !opening) return [] as ModelGame[];
    const ids = line === 'all' ? [...opening.lines.map((l) => l.id), 'other'] : [line];
    return ids.flatMap((id) => (data!.models[id] ?? []).map((g) => ({ ...g, line: id })));
  });
  const lineEndKey = (id: string) => endOf(opening!.lines.find((l) => l.id === id)?.sans ?? opening!.root).key;

  // Puzzles for the chosen line, phase and level; unsolved ones first.
  const linePool = $derived((data?.puzzles ?? []).filter((p) => (line === 'all' || p.line === line) && p.phase === puzzlePhase && p.level === level));
  /** No puzzles for this line at this level: the whole opening's instead. */
  const widened = $derived(line !== 'all' && !linePool.length);
  const pool = $derived(widened ? (data?.puzzles ?? []).filter((p) => p.phase === puzzlePhase && p.level === level) : linePool);
  const countOf = (ph: 'middlegame' | 'endgame', lv?: number) => {
    const all = (data?.puzzles ?? []).filter((p) => p.phase === ph && (lv === undefined || p.level === lv));
    const mine = all.filter((p) => line === 'all' || p.line === line).length;
    return mine || all.length;
  };
  const solvedHere = $derived(pool.filter((p) => solved[puzzleId(p)]).length);

  async function nextPuzzle() {
    puzzleResult = undefined;
    const fresh = pool.filter((p) => !solved[puzzleId(p)] && p !== puzzle);
    const from = fresh.length ? fresh : pool.filter((p) => p !== puzzle);
    const pick = from[Math.floor(Math.random() * from.length)] ?? pool[0];
    if (!pick) return void (puzzle = undefined);
    if (!(await useFeature('puzzle', `study-${puzzleId(pick)}`))) return void (puzzleLimited = true);
    puzzle = pick;
    puzzleRound++;
  }
  // A new set of puzzles (line, phase or level changed): start one.
  $effect(() => {
    void pool;
    if (tab === 'puzzles' && data && !puzzleLimited) untrack(() => void nextPuzzle());
  });
  function onPuzzle(ok: boolean) {
    puzzleResult = ok;
    if (ok && puzzle) {
      saveSolved(puzzleId(puzzle));
      solved = { ...solved, [puzzleId(puzzle)]: true };
      study.log('puzzle', POINTS.puzzleSolved, `Opening puzzle: ${opening?.name}, ${puzzle.line === 'other' ? 'other lines' : lineName(puzzle.line)}`);
    }
  }

  // Play.
  const playLine = $derived(line === 'all' || line === 'other' ? undefined : line);
  /** "Play from here" in the tree: these moves instead of a line. */
  const fromMoves = q.get('moves') ?? '';
  function play() {
    if (!opening || !requireGate('bot_opening')) return;
    const mine = $kfideAll[speedOf(tcLabel(TIME_CONTROLS[tc]))];
    const me = mine.games ? `&me=${mine.rating}` : '';
    try {
      const s = JSON.parse(localStorage.getItem('k24.playSetup') ?? '{}');
      localStorage.setItem('k24.playSetup', JSON.stringify({ ...s, rating, tc }));
    } catch {
      /* private mode */
    }
    const moves = fromMoves && line === 'all' ? `&moves=${encodeURIComponent(fromMoves)}` : '';
    goto(`/play/fide?r=${rating}&tc=${tc}&c=${opening.side}${me}&o=${studyTrainerId(opening.id, moves ? undefined : playLine)}${moves}${fromPosition ? '&start=line' : ''}`);
  }
  const treeOf = (id: string) => trees[id];
  /** Opens a model game (and counts it for Guru's weekly plan). */
  function openGame(g: ModelGame) {
    viewing = g;
    document.querySelector('.tabs')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    study.log('analysis', POINTS.gameAnalysed, `Model game: ${opening?.name}, ${g.line === 'other' ? 'other lines' : lineName(g.line)}`);
  }
  /** How many moves the solver plays. */
  const solverMoves = (p: StudyPuzzle) => Math.ceil((p.moves.length - 1) / 2);
</script>

<svelte:head>
  <title>{opening?.name ?? 'Opening'} · Opening study · Chess Castles</title>
</svelte:head>

<div class="page">
  <a class="back" href="/learn/study"><Icon name="back" size={16} />Opening study</a>
  {#if !opening || !plans}
    <div class="card note">That opening isn't in the study section. <a href="/learn/study">See all openings</a></div>
  {:else}
    <header class="card head">
      <div class="head-board" aria-hidden="true">
        <Board fen={endOf(opening.root).fen} orientation={opening.side} viewOnly coordinates={false} label="{opening.name} position" />
      </div>
      <div class="head-text">
        <span class="pill side-pill">You play {opening.side === 'white' ? 'White' : 'Black'}</span>
        <h1 class="display">{opening.name}</h1>
        <p class="label sans">{opening.root}</p>
        <p class="overview">{tr(plans.overview, lang)}</p>
        <div class="segmented langs" role="group" aria-label="Language of the explanations">
          {#each LANGS as l (l.id)}<button aria-pressed={lang === l.id} onclick={() => setLang(l.id)}>{l.name}</button>{/each}
        </div>
      </div>
    </header>

    {#if mine.length}
      <section class="card mine" aria-labelledby="mine-h">
        <div class="mine-head">
          <h2 id="mine-h" class="title">Lines from your games</h2>
          {#if ccHas && onlineHas}
            <div class="segmented src" role="group" aria-label="Which games">
              <button aria-pressed={mineSource === 'all'} onclick={() => (mineSource = 'all')}>All my games</button>
              <button aria-pressed={mineSource === 'cc'} onclick={() => (mineSource = 'cc')}>Chess Castles</button>
              <button aria-pressed={mineSource === 'online'} onclick={() => (mineSource = 'online')}>{mineFrom.split(' (')[0]}</button>
            </div>
          {/if}
        </div>
        <p class="label from">From {mineSource === 'cc' || !onlineHas ? 'your games on Chess Castles' : mineSource === 'online' || !ccHas ? `your ${mineFrom} games` : `your games on Chess Castles and ${mineFrom}`}.</p>
        <p class="label">
          For reference: the lines of the {opening.name} that came up in your own games. Everything you learn here (trainer, model games and
          puzzles) comes from the database of strong players' games.
        </p>
        <ul class="mine-list">
          {#each [...mine].sort((a, b) => b.games - a.games) as m (m.line)}
            <li class:weak={isWeak(m)}>
              <div class="mine-top">
                <span class="title">{lineName(m.line)}</span>
                <span class="label">{m.games} {m.games === 1 ? 'game' : 'games'} · {m.wins}-{m.draws}-{m.losses} · {Math.round(m.score * 100)}%</span>
                {#if isWeak(m)}<span class="pill bad">You keep losing here</span>{/if}
              </div>
              {#if m.usual}<span class="label">Usually continued: {m.usual.sans}{m.usual.games > 1 ? ` (${m.usual.games} games)` : ''}{m.firstSlip ? ` · your first mistake around move ${m.firstSlip}` : ''}</span>{/if}
              <div class="acts">
                {#if m.line !== 'other'}<a class="btn small-btn" href="/learn/openings/{studyTrainerId(opening.id, m.line)}">Train</a>{/if}
                <button class="btn small-btn" onclick={() => show('games', m.line)}>Model games</button>
                <button class="btn small-btn" onclick={() => show('puzzles', m.line)}>Puzzles</button>
                <button class="btn small-btn" onclick={() => show('play', m.line)}>Play it</button>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="picker">
      <label class="pick">
        <span class="title">Line</span>
        <select bind:value={line} aria-label="Line">
          <option value="all">All lines ({opening.lines.length}{totalVariations ? ` chapters · ${totalVariations} variations` : ''})</option>
          {#each opening.lines as l (l.id)}
            <option value={l.id}>{l.name}{l.games ? ` · ${l.games.toLocaleString('en-IN')} games` : ''}</option>
          {/each}
        </select>
      </label>
      <div class="lines" role="group" aria-label="Main lines">
        <button class="chip" aria-pressed={line === 'all'} onclick={() => (line = 'all')}>All lines</button>
        {#each opening.lines.slice(0, 6) as l (l.id)}
          <button class="chip" aria-pressed={line === l.id} onclick={() => (line = l.id)}>{l.title ?? l.name}</button>
        {/each}
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="Study">
      {#each TABS as t (t.id)}
        <button role="tab" aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => show(t.id)}><Icon name={t.icon} size={17} />{t.label}</button>
      {/each}
    </div>

    {#if tab === 'plans'}
      <div class="line-list">
        {#each shownLines as l (l.id)}
          {@const written = curatedFor(opening, l).filter((c) => planOf(opening, c))}
          {@const end = endOf(l.sans)}
          <article class="card line-card">
            <div class="mini" aria-hidden="true"><Board fen={end.fen} orientation={opening.side} viewOnly coordinates={false} label={l.name} /></div>
            <div class="line-text">
              <h2 class="title">{l.title ?? l.name}{#if l.openingName}<span class="oname"> · {l.openingName}</span>{/if}</h2>
              <p class="label sans">{l.sans}</p>
              {#if l.games}
                <p class="label stats">
                  {l.games.toLocaleString('en-IN')} games · {opening.side === 'white' ? 'White' : 'Black'} scores {Math.round((l.score ?? 0) * 100)}%{l.variations ? ` · ${l.variations} variations, about ${l.depth} of your moves each` : ''}
                </p>
              {:else if l.sideline}
                <p class="label stats">A rare reply: only a few games in the database, so the trainer continues it with our engines (Stockfish for your moves, the human-like engine for your opponent's).</p>
              {/if}
              {#each written as c (c.id)}
                {@const p = planOf(opening, c)!}
                {@const yours = !!c.option}
                {#if yours || written.length > 1}<p class="sub-h title">{yours ? `If you play ${c.name}` : c.name}</p>{/if}
                <ul class="plans">
                  {#each p.plans as item, i (i)}<li>{tr(item, lang)}</li>{/each}
                  {#if p.watch}<li class="watch"><strong>Watch out:</strong> {tr(p.watch, lang)}</li>{/if}
                </ul>
              {/each}
              {#if !written.length}
                <p class="label">The general ideas of the {opening.name} (above) apply here; its model games show how strong players handle the middlegame.</p>
              {/if}
              {#key l.id}<ChoicePicker opening={opening.id} sans={l.sans} side={opening.side} book={ownBook} />{/key}
              {#if data?.strategy?.[l.id]}<StrategyFacts facts={data.strategy[l.id]} side={opening.side} {lang} />{/if}
              <div class="acts">
                <a class="btn primary" href="/learn/openings/{studyTrainerId(opening.id, l.id)}"><Icon name="tree" size={16} />Train this line</a>
                <button class="btn" onclick={() => show('games', l.id)}><Icon name="book" size={16} />Model games</button>
                <button class="btn" onclick={() => show('puzzles', l.id)}><Icon name="puzzle" size={16} />Puzzles</button>
                <button class="btn" onclick={() => show('play', l.id)}><Icon name="play" size={16} />Play it</button>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else if tab === 'tree'}
      {#key line}
        <RepertoireTree {opening} book={ownBook} start={line !== 'all' && line !== 'other' ? opening.lines.find((l) => l.id === line)?.sans : undefined} />
      {/key}
    {:else if tab === 'trainer'}
      <p class="label intro">Learn the moves by heart with spaced repetition: at your turns the move strong players chose most, at your opponent's turns their popular replies. Lines come back when they are due.</p>
      <div class="t-grid">
        {#each [{ id: studyTrainerId(opening.id), name: `The whole ${opening.name}`, sans: opening.root }, ...shownLines.map((l) => ({ id: studyTrainerId(opening.id, l.id), name: l.name, sans: l.sans }))] as t (t.id)}
          {@const tree = treeOf(t.id)}
          {@const total = tree ? userNodes(tree).length : 0}
          {@const learned = tree ? learnedCount(tree) : 0}
          {@const due = tree ? dueCount(tree, Date.now()) : 0}
          {#if line === 'all' || t.id !== studyTrainerId(opening.id)}
            <a class="o-card" href="/learn/openings/{t.id}">
              <span class="title">{t.name}</span>
              <span class="label sans">{t.sans}</span>
              {#if tree}
                <span class="meter small"><span style="width: {total ? (100 * learned) / total : 0}%"></span></span>
                <span class="label">{learned}/{total} learned{due ? ` · ${due} due` : ''}</span>
              {:else}
                <span class="label start">Start learning <Icon name="chevron" size={14} /></span>
              {/if}
            </a>
          {/if}
        {/each}
      </div>
    {:else if tab === 'games'}
      {#if viewing}
        <section class="card viewer-card" aria-label="Model game">
          {#key viewing.id}
            <GameViewer gameId={viewing.id} lineEnd={lineEndKey(viewing.line)} orientation={opening.side} onclose={() => (viewing = undefined)} />
          {/key}
        </section>
      {/if}
      {#if failed}
        <div class="card note">The games could not be loaded. Check your connection and try again.</div>
      {:else if !data}
        <div class="card note">Loading model games…</div>
      {:else if !models.length}
        <div class="card note">No model games for this line yet.</div>
      {:else}
        <p class="label intro">Classical games between strong players, with your side ({opening.side}) winning first. A game opens where the line ends.</p>
        <div class="g-grid">
          {#each models as g (g.id)}
            <button class="g-card" class:on={viewing?.id === g.id} onclick={() => openGame(g)}>
              <span class="g-top"><span class="pill">{lineName(g.line)}</span><span class="res">{g.result.replace('1/2-1/2', '½-½')}</span></span>
              <span class="title g-names">{g.white} <span class="label">{g.we}</span></span>
              <span class="title g-names">{g.black} <span class="label">{g.be}</span></span>
              <span class="label">{eventYear(g)}</span>
            </button>
          {/each}
        </div>
      {/if}
    {:else if tab === 'middlegame'}
      {@const shownMg = mg.filter((l) => line === 'all' || l.chapter === line)}
      {#if line !== 'all' && data?.strategy?.[line]}<StrategyFacts facts={data.strategy[line]} side={opening.side} {lang} />{/if}
      <p class="label intro">
        Take over a model game right after the opening and play the middlegame like the strong player did: find each move, and Guru explains the idea.
        Moves the engine rates as just as good count too.
      </p>
      {#if !shownMg.length}
        <div class="card note">No middlegame lessons for this line yet. Try "All lines".</div>
      {:else}
        <div class="g-grid">
          {#each shownMg as l (l.game)}
            {@const got = mgStars[`study-${opening.id}/${l.game}`] ?? 0}
            <a class="g-card" href="/learn/study/{opening.id}/middlegame/{l.game}">
              <span class="g-top"><span class="pill">{lineName(l.chapter)}</span><span class="label">{l.plies.filter((p) => p.e !== undefined).length} moves</span></span>
              <span class="title g-names">Play as {playerName(l.color === 'white' ? l.white : l.black)}</span>
              <span class="label">vs {playerName(l.color === 'white' ? l.black : l.white)} · {eventYear(l)}</span>
              <span class="stars" aria-label="{got} of 3 stars">
                {#each [1, 2, 3] as st (st)}<Icon name="star" size={14} color={st <= got ? 'var(--gold)' : 'var(--border)'} />{/each}
              </span>
            </a>
          {/each}
        </div>
      {/if}
    {:else if tab === 'puzzles'}
      <div class="p-filters">
        <div class="segmented" role="group" aria-label="Part of the game">
          <button aria-pressed={puzzlePhase === 'middlegame'} onclick={() => (puzzlePhase = 'middlegame')}>Middlegame ({countOf('middlegame')})</button>
          <button aria-pressed={puzzlePhase === 'endgame'} onclick={() => (puzzlePhase = 'endgame')}>Endgame ({countOf('endgame')})</button>
        </div>
        <div class="segmented" role="group" aria-label="Level">
          {#each LEVELS as lv (lv.id)}
            <button aria-pressed={level === lv.id} onclick={() => (level = lv.id)}>{lv.name} ({countOf(puzzlePhase, lv.id)})</button>
          {/each}
        </div>
      </div>
      {#if failed}
        <div class="card note">The puzzles could not be loaded. Check your connection and try again.</div>
      {:else if !data}
        <div class="card note">Loading puzzles…</div>
      {:else if puzzleLimited}
        <LimitReached feature="puzzle" back="/learn/study/{opening.id}" backLabel={opening.name} />
      {:else if !pool.length}
        <div class="card note">No puzzles at this level for this line yet. Try another level or "All lines".</div>
      {:else if puzzle}
        <div class="puzzle">
          <div class="pz-board">
            {#key puzzleRound}
              <PuzzleBoard fen={puzzle.fen} moves={puzzle.moves} tries={2} onresult={onPuzzle} />
            {/key}
          </div>
          <aside class="card pz-side">
            <span class="pill">{lineName(puzzle.line)} · {LEVELS[puzzle.level - 1].name}{puzzle.rating ? ` · rated ${puzzle.rating}` : ''}</span>
            {#if widened}<p class="label">No puzzles for the {lineName(line)} at this level yet, so these come from the whole {opening.name}.</p>{/if}
            <p>
              The opponent has just played a move. {puzzle.side === 'white' ? 'White' : 'Black'} to move: find the winning
              {puzzle.mate ? `checkmate (mate in ${puzzle.mate})` : solverMoves(puzzle) > 1 ? `line (${solverMoves(puzzle)} moves)` : 'move'}.
            </p>
            {#if puzzleResult !== undefined}
              {#if puzzle.game}
                <p class="from label">From {puzzle.white} ({puzzle.we}) – {puzzle.black} ({puzzle.be}), {eventYear({ event: puzzle.event ?? '', year: puzzle.year ?? 0 })}.</p>
              {:else}
                <p class="from label">From a real game played on Lichess, in the {lineName(puzzle.line) === 'Other lines' ? opening.name : lineName(puzzle.line)}.</p>
              {/if}
              <div class="acts">
                <button class="btn primary" onclick={nextPuzzle}>Next puzzle<Icon name="chevron" size={16} /></button>
                {#if puzzle.game}<a class="btn ghost" href="/analysis?db={puzzle.game}">See the game</a>{/if}
              </div>
            {/if}
            <span class="label">{solvedHere} of {pool.length} solved at this level</span>
          </aside>
        </div>
      {/if}
    {:else if tab === 'play'}
      <section class="card play">
        <h2 class="title">Play {fromMoves && line === 'all' ? 'from your position' : playLine ? lineName(playLine) : `the ${opening.name}`} against a FIDE-rated opponent</h2>
        {#if fromMoves && line === 'all'}<p class="label sans">Position from the tree: {fromMoves}</p>{/if}
        <p class="label">
          You play {opening.side}. From the line, the opponent plays like a real FIDE-rated player at the rating you choose.
        </p>
        <div class="group">
          <span class="title h">Line</span>
          <select bind:value={line} aria-label="Line to play">
            <option value="all">Whole opening</option>
            {#each opening.lines as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
          </select>
        </div>
        <div class="group">
          <span class="title h">Start</span>
          <div class="segmented" role="group" aria-label="Start">
            <button aria-pressed={fromPosition} onclick={() => (fromPosition = true)}>From the line's position</button>
            <button aria-pressed={!fromPosition} onclick={() => (fromPosition = false)}>From move 1</button>
          </div>
          <span class="label sans">{fromPosition ? `The game begins after ${(playLine ? opening.lines.find((l) => l.id === playLine)?.sans : opening.root) ?? ''}.` : "You play the line's moves yourself; the opponent follows the line while you do."}</span>
        </div>
        <div class="group">
          <span class="title h">Opponent rating: <span class="num">{rating}</span> FIDE</span>
          <input type="range" min="1400" max="2800" step="25" bind:value={rating} aria-label="Opponent rating" />
          <div class="lines">
            {#each [1400, 1600, 1800, 2000, 2200, 2500] as r (r)}<button class="chip" aria-pressed={rating === r} onclick={() => (rating = r)}>{r}</button>{/each}
          </div>
        </div>
        <div class="group">
          <span class="title h">Time control</span>
          <div class="lines">
            {#each TIME_CONTROL_ORDER as i (i)}{@const t = TIME_CONTROLS[i]}<button class="chip" aria-pressed={tc === i} onclick={() => (tc = i)}>{tcLabel(t)} {t.kind}</button>{/each}
          </div>
        </div>
        <button class="btn primary big" onclick={play}><Icon name="play" size={18} />Play {rating} · {tcLabel(TIME_CONTROLS[tc])}</button>
        {#if !hasGate('bot_opening')}<p class="label">Choosing the opponent's opening comes with Premium.</p>{/if}
        <p class="label fine">A computer opponent in the style of a FIDE {rating} player. Not affiliated with FIDE.</p>
      </section>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 1140px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 14px;
    width: fit-content;
  }
  .note {
    padding: 14px 16px;
  }
  .head {
    display: flex;
    gap: 20px;
    padding: 18px;
    align-items: flex-start;
  }
  .head-board {
    width: 220px;
    flex: none;
  }
  .head-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    align-items: flex-start;
  }
  .head-text h1 {
    margin: 0;
    font-size: 40px;
  }
  .side-pill {
    font-size: 12px;
  }
  .sans {
    margin: 0;
    word-break: break-word;
  }
  .overview {
    margin: 4px 0;
    line-height: 1.55;
    max-width: 720px;
  }
  .mine-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .mine-head h2 {
    margin: 0;
  }
  .mine-head .src {
    min-width: min(100%, 420px);
  }
  .mine {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mine p {
    margin: 0;
    line-height: 1.5;
  }
  .mine h2 {
    margin: 0;
    font-size: 18px;
  }
  .mine-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mine-list li {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--raised);
  }
  .mine-list li.weak {
    outline: 1px solid color-mix(in srgb, var(--loss) 55%, transparent);
  }
  .mine-top {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .pill.bad {
    color: var(--loss);
    font-size: 12px;
  }
  .small-btn {
    height: 34px;
    padding: 0 12px;
    font-size: 14px;
  }
  .picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pick {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  select {
    font: inherit;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    max-width: 100%;
    min-width: 0;
    flex: 1;
  }
  .oname {
    color: var(--muted);
    font-weight: 500;
    font-size: 15px;
  }
  .stats {
    margin: 0;
  }
  .sub-h {
    margin: 6px 0 0;
    font-size: 15px;
  }
  .lines {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
    scroll-margin-top: 12px;
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--muted);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .tabs button.on {
    color: var(--text);
    border-bottom-color: var(--brand);
  }
  .intro {
    margin: 0;
    max-width: 760px;
    line-height: 1.5;
  }
  .line-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .line-card {
    display: flex;
    gap: 18px;
    padding: 16px;
    align-items: flex-start;
  }
  .mini {
    width: 200px;
    flex: none;
  }
  .line-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .line-text h2 {
    margin: 0;
    font-size: 20px;
  }
  .plans {
    margin: 4px 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    line-height: 1.5;
  }
  .watch {
    color: var(--engine);
  }
  .watch strong {
    color: var(--engine);
  }
  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .t-grid,
  .g-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
    gap: 12px;
  }
  .o-card,
  .g-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border-radius: var(--r-card);
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .o-card:hover,
  .g-card:hover,
  .g-card.on {
    border-color: var(--brand);
    text-decoration: none;
  }
  .g-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .g-top .pill {
    font-size: 11px;
  }
  .res {
    font-weight: 700;
  }
  .stars {
    display: flex;
    gap: 2px;
  }
  .g-names {
    font-size: 15px;
  }
  .viewer-card {
    padding: 16px;
  }
  .p-filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .puzzle {
    display: grid;
    grid-template-columns: minmax(0, 560px) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .pz-side {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    align-items: flex-start;
  }
  .pz-side p {
    margin: 0;
    line-height: 1.5;
  }
  .play {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    max-width: 760px;
  }
  .play h2 {
    margin: 0;
  }
  .play p {
    margin: 0;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .group .h {
    font-size: 15px;
  }
  .group input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }
  .big {
    height: 50px;
    font-size: 17px;
  }
  .fine {
    font-size: 12px;
  }
  @media (max-width: 760px) {
    .head,
    .line-card {
      flex-direction: column;
    }
    .head-board {
      width: 100%;
      max-width: 320px;
    }
    .mini {
      width: 100%;
      max-width: 300px;
    }
    .puzzle {
      grid-template-columns: 1fr;
    }
    .tabs button {
      padding: 8px 10px;
    }
  }
</style>

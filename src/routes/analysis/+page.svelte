<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import { Chess } from 'chessops/chess';
  import type { NormalMove, Role } from 'chessops/types';
  import type { Key } from '@lichess-org/chessground/types';
  import Board from '$lib/components/Board.svelte';
  import DbPanel from '$lib/components/DbPanel.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ShareGame from '$lib/components/ShareGame.svelte';
  import MoveTree, { type TNode } from '$lib/components/MoveTree.svelte';
  import MoveNav from '$lib/components/MoveNav.svelte';
  import BoardEditor from '$lib/components/BoardEditor.svelte';
  import { CloudBook } from '$lib/book/book';
  import { START_FEN, destsOf, fenOf, isPromotion, keyOf, moveFromKeys, moveToUci, positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
  import PromotionPicker from '$lib/components/PromotionPicker.svelte';
  import { autoQueen } from '$lib/preferences';
  import { engine, evalLabel, whiteChances, type EngineInfo } from '$lib/engine/stockfish';
  import { myGames, type SavedGame } from '$lib/stores/myGames';
  import { POINTS, study } from '$lib/study/progress';
  import { readPgn } from '$lib/chess/pgn';
  import { afterNavigate, goto } from '$app/navigation';
  import { polyglotKey } from '$lib/chess/polyglot';
  import { gamesDb } from '$lib/games/gamesDb';
  import { playMoveSound } from '$lib/sound';
  import { analyseGame, type GameReview } from '$lib/coach/review';
  import { quota, reviewKey, useFeature } from '$lib/plans';
  import { track } from '$lib/analytics';
  import { BADGE_ORDER, BADGES, boardBadge, type MoveClass } from '$lib/review/badges';
  import MoveBadge from '$lib/review/MoveBadge.svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';

  interface Ply {
    move: NormalMove;
    san: string;
    after: Chess;
  }

  const book = new CloudBook();
  /**
   * The analysis is a tree of moves: the first child of each move is the
   * main line, the others are variations. `path` is the line being looked
   * at (from the start, then on along its main continuation) and `cursor`
   * how far along it the board is. The tree is not reactive; `tv` counts
   * its changes.
   */
  let nextId = 1;
  let root = $state.raw<TNode>({ id: 0, san: '', after: Chess.default(), children: [] });
  let path = $state.raw<TNode[]>([]);
  let tv = $state(0);
  let cursor = $state(0);
  const start = $derived(root.after);
  const line = $derived<Ply[]>(path.map((n) => ({ move: n.move!, san: n.san, after: n.after })));

  /** A node and its main continuation. */
  const follow = (n: TNode | undefined): TNode[] => {
    const out: TNode[] = [];
    for (let x = n; x; x = x.children[0]) out.push(x);
    return out;
  };
  const mainline = () => follow(root.children[0]);
  /** The nodes from the start to `n`. */
  const pathTo = (n: TNode): TNode[] => {
    const out: TNode[] = [];
    for (let x: TNode | undefined = n; x && x !== root; x = x.parent) out.unshift(x);
    return out;
  };
  const current = $derived(cursor ? path[cursor - 1] : root);

  /** A fresh board starting from `from`. */
  function reset(from: Chess) {
    root = { id: 0, san: '', after: from, children: [] };
    path = [];
    cursor = 0;
    tv++;
    headers = new Map();
    importNote = '';
  }

  /** Goes to a move anywhere in the tree (and on along its line). */
  function select(n: TNode) {
    const to = pathTo(n);
    const from = cursor;
    path = [...to, ...follow(n.children[0])];
    cursor = to.length;
    if (cursor === from + 1 && n.move) playMoveSound(n.parent!.after, n.move);
  }

  /** The variation the current move is in: the nearest move (from here back) that is not its parent's main line. */
  const branch = $derived.by(() => {
    void tv;
    for (let x: TNode | undefined = current; x && x !== root; x = x.parent) if (x.parent && x.parent.children[0] !== x) return x;
    return undefined;
  });

  /** Makes the current variation the main line (one level up each time). */
  function promote() {
    const b = branch;
    if (!b?.parent) return;
    const kids = b.parent.children;
    kids.splice(kids.indexOf(b), 1);
    kids.unshift(b);
    tv++;
    select(current);
  }

  /** Deletes the current variation and goes back to where it started. */
  function deleteVariation() {
    const b = branch;
    if (!b?.parent) return;
    b.parent.children.splice(b.parent.children.indexOf(b), 1);
    tv++;
    select(b.parent === root ? root : b.parent);
    if (b.parent === root) {
      path = mainline();
      cursor = 0;
    }
  }
  let orientation = $state<'white' | 'black'>('white');
  let title = $state('Analysis board');
  let engineOn = $state(true);
  /** The engine (1 MB) starts once the page is on screen, so a slow phone shows the board first. */
  let pageDrawn = $state(false);
  onMount(() => {
    const ready = () => (pageDrawn = true);
    const t = setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(ready, { timeout: 1000 }) : ready()), 400);
    return () => clearTimeout(t);
  });
  let info = $state<EngineInfo | undefined>();
  /** The engine's three best lines in this position. */
  let lines = $state<EngineInfo[]>([]);
  let tab = $state<'engine' | 'database' | 'guru'>('engine');
  /** The saved game on the board (My games), for a Guru review. */
  let savedId = $state<string | undefined>();
  let copied = $state('');
  /** Every move's badge (brilliant … blunder), for the line it was worked out on. */
  let review = $state<{ ucis: string[]; result: GameReview } | undefined>();
  /** Progress of the move review, 0..1, while it runs. */
  let reviewing = $state<number | undefined>();
  let reviewRun = 0;

  // Runs on first load and whenever the address changes (opening a reference game).
  afterNavigate(() => void loadFromUrl());
  let dbNote = $state('');

  async function loadFromUrl() {
    const q = page.url.searchParams;
    // Opened from the menu's "5M game database": straight to the database tab.
    if (q.get('tab') === 'database') tab = 'database';
    else if (q.get('tab') === 'guru') tab = 'guru';
    savedId = undefined;
    const id = q.get('game');
    const fen = q.get('fen');
    const dbId = Number(q.get('db'));
    dbNote = '';
    if (dbId) {
      try {
        const g = await gamesDb.game(dbId);
        if (!g) throw new Error();
        load(g.start, g.moves.map(moveToUci), q.has('review'));
        title = `${g.white} – ${g.black}`;
        dbNote = [g.event, g.site, g.date?.replace(/\.\?\?/g, ''), g.result.replace('1/2-1/2', '½-½')].filter(Boolean).join(' · ');
        // Open at the position the game was chosen from.
        const want = q.get('key');
        cursor = line.length;
        if (want) {
          const at = [start, ...line.map((l) => l.after)].findIndex((p) => polyglotKey(p).toString(16) === want);
          if (at >= 0) cursor = at;
        }
        tab = 'database';
      } catch {
        dbNote = 'That game could not be loaded.';
      }
    } else if (id) {
      const g = myGames.get(id);
      if (g) {
        load(positionFromFen(g.startFen), g.uci, q.has('review'));
        orientation = g.userSide;
        title = `${g.white} – ${g.black}`;
        cursor = 0;
        savedId = g.id;
        creditAnalysis(g.id, title);
      }
    } else if (q.get('import')) {
      try {
        const [g] = readPgn(sessionStorage.getItem('k24.importPgn') ?? '');
        if (g) {
          load(g.start, g.plies.map((p) => moveToUci(p.move)), q.has('review'));
          title = `${g.headers.get('White') ?? 'White'} – ${g.headers.get('Black') ?? 'Black'}`;
          cursor = Math.min(line.length, Number(q.get('ply')) || line.length);
        }
      } catch {
        /* nothing to import */
      }
    } else if (fen) {
      try {
        const start = positionFromFen(fen);
        reset(start);
      } catch {
        /* keep the start position */
      }
    }
  }
  onDestroy(() => engine.stopAnalysis());

  function openDbGame(gameId: number) {
    goto(`/analysis?db=${gameId}&key=${polyglotKey(pos).toString(16)}`);
  }

  /** Five study points the first time each of your games is analysed. */
  function creditAnalysis(id: string, label: string) {
    try {
      const seen: string[] = JSON.parse(localStorage.getItem('k24.analysed') ?? '[]');
      if (seen.includes(id)) return;
      localStorage.setItem('k24.analysed', JSON.stringify([...seen, id].slice(-1000)));
      study.log('analysis', POINTS.gameAnalysed, `Analysed ${label}`);
    } catch {
      /* storage blocked */
    }
  }

  /** The game on the board (its main line), to share by link. */
  function boardGame(): SavedGame | undefined {
    const moves = mainline();
    if (!moves.length) return undefined;
    const [w, b] = title.includes(' – ') ? title.split(' – ') : ['White', 'Black'];
    return {
      id: `a${Date.now().toString(36)}`,
      playedAt: Date.now(),
      kind: 'analysis' as SavedGame['kind'],
      white: w,
      black: b,
      userSide: orientation,
      result: '*',
      reason: '',
      timeControl: '',
      startFen: fenOf(start),
      uci: moves.map((n) => moveToUci(n.move!)),
    };
  }

  /** Setting up a position on an empty (or any) board. */
  let editing = $state(false);

  // ---------- import: PGN, FEN, or a Lichess game link ----------
  let importing = $state(false);
  let importText = $state('');
  let importError = $state('');
  let importBusy = $state(false);
  /** After an import that stopped early: where and why. */
  let importNote = $state('');
  /** The tags of the imported game (Event, players, result…), kept for Copy PGN. */
  let headers = $state(new Map<string, string>());

  async function doImport() {
    track('feature', 'analysis_import');
    importError = '';
    importNote = '';
    let text = importText.trim();
    if (!text) return;
    importBusy = true;
    try {
      // A Lichess game link: its PGN from Lichess.
      const id = /lichess\.org\/([A-Za-z0-9]{8})/.exec(text)?.[1];
      if (id) {
        const res = await fetch(`https://lichess.org/game/export/${id}?clocks=false&evals=false`, { headers: { Accept: 'application/x-chess-pgn' } });
        if (!res.ok) throw new Error('That Lichess game could not be found.');
        text = await res.text();
      }
      // A position (FEN).
      if (/^[pnbrqkPNBRQK1-8]+(\/[pnbrqkPNBRQK1-8]+){7}(\s|$)/.test(text)) {
        let pos: Chess;
        try {
          pos = positionFromFen(text);
        } catch {
          throw new Error('That position (FEN) is not possible: check the kings, the side to move and the castling rights.');
        }
        reset(pos);
        title = 'Position';
        headers = new Map();
      } else {
        const [g] = readPgn(text);
        if (!g && /\[FEN /.test(text)) throw new Error('The starting position in this PGN (its FEN) is not possible.');
        if (!g || (!g.plies.length && !g.illegal && !/\[FEN /.test(text))) throw new Error("That doesn't look like a PGN, a FEN or a Lichess game link.");
        if (g.illegal && !g.plies.length) throw new Error(`The first move, ${g.illegal}, is not legal in this position.`);
        load(g.start, g.plies.map((p) => moveToUci(p.move)));
        title = `${g.headers.get('White') ?? 'White'} – ${g.headers.get('Black') ?? 'Black'}`;
        headers = g.headers;
        cursor = 0;
        if (g.illegal) {
          const n = g.plies.length;
          const at = g.plies[n - 1].after;
          const no = `${at.fullmoves}${at.turn === 'white' ? '.' : '...'}`;
          importNote = `Loaded ${n} moves. Move ${no} ${g.illegal} is not legal, so the game stops there.`;
        }
      }
      importing = false;
      importText = '';
    } catch (e) {
      importError = e instanceof Error ? e.message : 'That could not be imported.';
    } finally {
      importBusy = false;
    }
  }

  /** Shows a game; `autoReview`: start the move-by-move review at once (the page was opened to review it). */
  function load(from: Chess, ucis: string[], autoReview = false) {
    reset(from);
    const pos = from.clone();
    let parent = root;
    for (const u of ucis) {
      const m = uciToMove(u);
      if (!m || !pos.isLegal(m)) break;
      const san = sanOf(pos, m);
      pos.play(m);
      const n: TNode = { id: nextId++, move: m, san, after: pos.clone(), parent, children: [] };
      parent.children.push(n);
      parent = n;
    }
    path = mainline();
    cursor = path.length;
    tv++;
    review = undefined;
    // The game shows at once; the move-by-move review runs when the player asks for it
    // (or straight away when they came here to review it: ?review=1).
    if (path.length >= 4 && autoReview) void reviewMoves();
  }

  /** Grades every move of the line with the engine and shows a badge on each. */
  async function reviewMoves() {
    const run = ++reviewRun;
    const ucis = mainline().map((n) => moveToUci(n.move!));
    // One Game Review of the plan's reviews a day (the same moves reviewed again are free).
    if (!(await useFeature('review', reviewKey(fenOf(start), ucis)))) return;
    reviewing = 0;
    try {
      const result = await analyseGame(
        { id: 'analysis', playedAt: 0, kind: 'computer', white: 'White', black: 'Black', userSide: orientation, result: '*', reason: '', timeControl: '', startFen: fenOf(start), uci: ucis },
        (p) => run === reviewRun && (reviewing = p),
        quota('review_depth'),
        () => run !== reviewRun,
      );
      if (run === reviewRun) review = { ucis, result };
    } catch {
      /* stopped, or the engine can't run */
    } finally {
      if (run === reviewRun) reviewing = undefined;
    }
  }
  onDestroy(() => reviewRun++);

  /** Badges for the moves still on the reviewed line. */
  const badges = $derived.by((): (MoveClass | undefined)[] => {
    if (!review) return [];
    const out: (MoveClass | undefined)[] = [];
    for (let i = 0; i < line.length && i < review.ucis.length; i++) {
      if (moveToUci(line[i].move) !== review.ucis[i]) break;
      out.push(review.result.all.find((m) => m.ply === i)?.cls);
    }
    return out;
  });
  /** Badges on the main line's moves, for the move list. */
  const badgeMap = $derived.by(() => {
    void tv;
    const out = new Map<number, MoveClass>();
    if (!review) return out;
    mainline().every((n, i) => {
      if (moveToUci(n.move!) !== review!.ucis[i]) return false;
      const c = review!.result.all.find((m) => m.ply === i)?.cls;
      if (c) out.set(n.id, c);
      return true;
    });
    return out;
  });
  const reviewStale = $derived.by(() => {
    void tv;
    return !!review && (mainline().length !== review.ucis.length || mainline().some((n, i) => moveToUci(n.move!) !== review!.ucis[i]));
  });

  const pos = $derived(cursor === 0 ? start.clone() : line[cursor - 1].after.clone());
  const fen = $derived(fenOf(pos));

  function play(m: NormalMove) {
    const p = pos;
    if (!p.isLegal(m)) return;
    playMoveSound(p, m);
    const here = current;
    // A move already in the tree: go there (and on along its line).
    const known = here.children.find((c) => c.move!.from === m.from && c.move!.to === m.to && c.move!.promotion === m.promotion);
    if (known) {
      path = [...path.slice(0, cursor), ...follow(known)];
      cursor++;
      return;
    }
    // A new move: a new variation (or the main line, if nothing follows here yet). The rest of the game stays.
    const san = sanOf(p, m);
    p.play(m);
    const n: TNode = { id: nextId++, move: m, san, after: p.clone(), parent: here, children: [] };
    here.children.push(n);
    tv++;
    path = [...path.slice(0, cursor), n];
    cursor = path.length;
  }

  let board: Board | undefined = $state();
  let promoting = $state<{ orig: Key; dest: Key } | undefined>();
  function onmove(orig: Key, dest: Key) {
    if (!$autoQueen && isPromotion(pos, orig, dest)) {
      promoting = { orig, dest };
      return;
    }
    play(moveFromKeys(pos, orig, dest));
  }
  function pickPromotion(role: Role) {
    if (!promoting) return;
    const { orig, dest } = promoting;
    promoting = undefined;
    play(moveFromKeys(pos, orig, dest, role));
  }
  function cancelPromotion() {
    promoting = undefined;
    board?.resync();
  }
  const go = (ply: number) => {
    const to = Math.max(0, Math.min(line.length, ply));
    if (to === cursor + 1) playMoveSound(cursor ? line[cursor - 1].after : start, line[cursor].move);
    // Going back: forward from there follows the main continuation again (back to the game's
    // own move after trying a variation), not the side line just looked at.
    if (to < cursor) {
      const node = to ? path[to - 1] : root;
      path = [...path.slice(0, to), ...follow(node.children[0])];
    }
    cursor = to;
  };

  $effect(() => {
    const f = fen;
    info = undefined;
    if (!engineOn || pos.isEnd()) {
      engine.stopAnalysis();
      return;
    }
    lines = [];
    if (!pageDrawn) return;
    void engine.analyse(
      f,
      (i) => {
        if (i.fen === f) info = i;
      },
      22,
      undefined,
      3,
      (l) => {
        if (l[0]?.fen === f) lines = l;
      },
    );
  });

  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') go(cursor - 1);
    else if (e.key === 'ArrowRight') go(cursor + 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(line.length);
    else if (e.key === 'f') orientation = orientation === 'white' ? 'black' : 'white';
    else return;
    e.preventDefault();
  }

  const best = $derived.by(() => {
    const m = info?.pv[0] ? uciToMove(info.pv[0]) : undefined;
    // The engine may still be reporting on the previous position.
    return m && pos.isLegal(m) ? m : undefined;
  });
  /** Each line in SAN with move numbers ("1... e5 2. Nf3 Nc6"), and its first move. */
  const lineTexts = $derived.by(() =>
    lines.map((l) => {
      const p = pos.clone();
      const parts: string[] = [];
      let first: NormalMove | undefined;
      for (const u of l.pv.slice(0, 12)) {
        const m = uciToMove(u);
        if (!m || !p.isLegal(m)) break;
        first ??= m;
        const no = p.turn === 'white' ? `${p.fullmoves}. ` : !parts.length ? `${p.fullmoves}... ` : '';
        parts.push(no + sanOf(p, m));
        p.play(m);
      }
      return { info: l, text: parts.join(' '), first, whiteAhead: (l.mate ?? l.cp ?? 0) >= 0 };
    }),
  );
  const pvSans = $derived.by(() => {
    if (!info) return [];
    const p = pos.clone();
    const out: string[] = [];
    for (const u of info.pv.slice(0, 10)) {
      const m = uciToMove(u);
      if (!m || !p.isLegal(m)) break;
      out.push(sanOf(p, m));
      p.play(m);
    }
    return out;
  });
  const chances = $derived(info ? whiteChances(info) : 0.5);

  /** The whole tree as PGN movetext: the main line with variations in brackets. */
  function pgn(): string {
    const num = (n: TNode, force: boolean) => {
      const b = n.parent!.after;
      return b.turn === 'white' ? `${b.fullmoves}. ` : force ? `${b.fullmoves}... ` : '';
    };
    const lineText = (first: TNode | undefined, force: boolean): string => {
      const parts: string[] = [];
      let needNo = force;
      for (let n = first; n; n = n.children[0]) {
        parts.push(num(n, needNo) + n.san);
        needNo = false;
        for (const alt of n.parent!.children.slice(1)) {
          if (n.parent!.children[0] !== n) break;
          parts.push(`(${lineText(alt, true)})`);
          needNo = true;
        }
      }
      return parts.join(' ');
    };
    const moves = lineText(root.children[0], true);
    // The tags first (the Seven Tag Roster, then the rest), and the result at the end.
    const tags = new Map(headers);
    const [w, b] = title.includes(' – ') ? title.split(' – ') : ['?', '?'];
    const result = tags.get('Result') ?? '*';
    const roster: [string, string][] = [
      ['Event', tags.get('Event') ?? 'Analysis'],
      ['Site', tags.get('Site') ?? 'chesscastles.com'],
      ['Date', tags.get('Date') ?? new Date().toISOString().slice(0, 10).replaceAll('-', '.')],
      ['Round', tags.get('Round') ?? '-'],
      ['White', tags.get('White') ?? w],
      ['Black', tags.get('Black') ?? b],
      ['Result', result],
    ];
    for (const [k] of roster) tags.delete(k);
    const fen = fenOf(start);
    if (fen !== START_FEN) {
      tags.set('SetUp', '1');
      tags.set('FEN', fen);
    }
    const quote = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const head = [...roster, ...tags].map(([k, v]) => `[${k} "${quote(v)}"]`).join('\n');
    return `${head}\n\n${moves ? `${moves} ` : ''}${result}\n`;
  }

  async function copy(what: 'fen' | 'pgn') {
    try {
      await navigator.clipboard.writeText(what === 'fen' ? fen : pgn());
      copied = what;
      setTimeout(() => (copied = ''), 1500);
    } catch {
      copied = '';
    }
  }
</script>

<svelte:head><title>{title} · Chess Castles</title></svelte:head>

{#if promoting}
  <PromotionPicker color={pos.turn} onpick={pickPromotion} oncancel={cancelPromotion} />
{/if}
<svelte:window onkeydown={onkey} />

{#if editing}
  <section class="card setup-card">
    <h1 class="title">Set up a position</h1>
    <BoardEditor
      fen={fenOf(pos)}
      onapply={(f) => {
        reset(positionFromFen(f));
        title = 'Position';
        editing = false;
      }}
      oncancel={() => (editing = false)}
    />
  </section>
{:else}
<div class="analysis">
  <section class="board-col" aria-label="Board">
    <div class="board-row">
      {#if engineOn}
        <div class="evalbar" aria-label="Evaluation {info ? evalLabel(info) : 'pending'}" class:flipped={orientation === 'black'}>
          <div class="white-share" style="height: {chances * 100}%"></div>
          <span class="eval-text num">{info ? evalLabel(info) : ''}</span>
        </div>
      {/if}
      <div class="board-box">
        <Board
          bind:this={board}
          {fen}
          {orientation}
          turnColor={pos.turn}
          movable="both"
          dests={destsOf(pos)}
          lastMove={cursor ? [keyOf(line[cursor - 1].move.from), keyOf(line[cursor - 1].move.to)] : undefined}
          check={pos.isCheck()}
          shapes={[
            ...(engineOn && best ? [{ orig: keyOf(best.from), dest: keyOf(best.to), brush: 'blue' }] : []),
            ...(cursor && badges[cursor - 1] ? [{ orig: keyOf(line[cursor - 1].move.to), customSvg: { html: boardBadge(badges[cursor - 1]!) } }] : []),
          ]}
          label="Analysis board"
          {onmove}
          onswipe={(d) => go(cursor + (d === 'forward' ? 1 : -1))}
        />
      </div>
    </div>
  </section>

  <aside class="side">
    <div class="card info-card">
      <h1 class="title page-title">{title}</h1>
      {#if dbNote}<p class="label db-note">{dbNote}</p>{/if}
      <div class="segmented" role="group" aria-label="Panel">
        <button aria-pressed={tab === 'engine'} onclick={() => (tab = 'engine')}>Engine</button>
        <button aria-pressed={tab === 'database'} onclick={() => (tab = 'database')}>Database</button>
        <button aria-pressed={tab === 'guru'} onclick={() => (tab = 'guru')}>Guru</button>
      </div>

      {#if tab === 'engine'}
        <div class="engine">
          <label class="toggle">
            <input type="checkbox" bind:checked={engineOn} />
            <span>Stockfish 19 lite {engine.error ? `· ${engine.error}` : ''}</span>
          </label>
          {#if engineOn}
            {#if pos.isCheckmate()}
              <p class="big-eval title">Checkmate</p>
            {:else if pos.isEnd()}
              <p class="big-eval title">Game over</p>
            {:else if info}
              <p class="big-eval display num">{evalLabel(info)} <span class="label">depth {info.depth}</span></p>
              {#if lineTexts.length > 1}
                <ol class="lines" aria-label="The engine's best lines">
                  {#each lineTexts as l, k (k)}
                    <li>
                      <button class="line-btn" onclick={() => l.first && play(l.first)} title="Play {l.text.split(' ')[1] ?? ''}">
                        <span class="chip num" class:dark={!l.whiteAhead}>{evalLabel(l.info)}</span>
                        <span class="line-text num">{l.text}</span>
                      </button>
                    </li>
                  {/each}
                </ol>
              {:else}
                <p class="pv">{pvSans.join(' ')}</p>
              {/if}
            {:else}
              <p class="label">Thinking…</p>
            {/if}
          {/if}
        </div>
      {:else if tab === 'database'}
        <DbPanel {pos} {book} onplay={play} played={line[cursor]?.move} onopen={openDbGame} />
      {:else}
        <div class="guru">
          <GuruAvatar size={56} />
          {#if savedId}
            <p>Chess Guru goes through this game like a coach: the turning points, your best moves, your mistakes and what to practise next, in English, हिन्दी or मराठी.</p>
            <a class="btn primary block" href="/coach/review/{savedId}" onclick={() => track('feature', 'analysis_guru')}><Icon name="coach" size={16} />Review with Guru</a>
            <p class="label">The engine and the database stay right here, for the quick look.</p>
          {:else}
            <p>Chess Guru reviews the games you play on Chess Castles. Open one from My games and choose Guru.</p>
            <a class="btn block" href="/games"><Icon name="history" size={16} />My games</a>
          {/if}
        </div>
      {/if}
    </div>

    <div class="card moves-card">
      {#if reviewing !== undefined}
        <div class="reviewing">
          <span class="label">Reviewing every move… {Math.round(reviewing * 100)}%</span>
          <div class="bar"><span style="width: {reviewing * 100}%"></span></div>
        </div>
      {:else if review && !reviewStale}
        <div class="report">
          {#each ['white', 'black'] as const as c (c)}
            <div class="side-acc">
              <span class="disc {c}"></span>
              <strong class="num">{review.result.sides[c].accuracy}%</strong>
              <span class="chips">
                {#each BADGE_ORDER.filter((k) => k !== 'good' && k !== 'book' && review!.result.sides[c].classes[k]) as k (k)}
                  <span class="chip-b" title={BADGES[k].label}><MoveBadge kind={k} size={18} title={false} />{review.result.sides[c].classes[k]}</span>
                {/each}
              </span>
            </div>
          {/each}
        </div>
      {:else if line.length >= 2}
        <button class="btn primary review-btn" onclick={reviewMoves}><Icon name="analyse" size={16} />{reviewStale ? 'Review the new moves' : 'Review every move (brilliant … blunder)'}</button>
      {/if}
      {#if cursor && badges[cursor - 1]}
        <p class="this-move"><MoveBadge kind={badges[cursor - 1]!} size={22} /> <strong>{line[cursor - 1].san}</strong> <span style="color: {BADGES[badges[cursor - 1]!].color}">{BADGES[badges[cursor - 1]!].label}</span><span class="label">{BADGES[badges[cursor - 1]!].meaning}.</span></p>
      {/if}
      {#if branch}
        <div class="var-bar">
          <span class="label">In a variation</span>
          <button class="btn small-btn" onclick={promote}>Make main line</button>
          <button class="btn ghost small-btn" onclick={deleteVariation}>Delete variation</button>
        </div>
      {/if}
      {#if importNote}<p class="err note" role="status">{importNote}</p>{/if}
      <MoveTree {root} {current} version={tv} badges={badgeMap} onselect={select} />
      <MoveNav ply={cursor} max={line.length} {go} onflip={() => (orientation = orientation === 'white' ? 'black' : 'white')} />
      {#if importing}
        <div class="import">
          <label for="import-text" class="label">Paste a game (PGN), a position (FEN), or a Lichess game link. For chess.com, use Share → PGN and paste it here.</label>
          <textarea id="import-text" bind:value={importText} rows="5" placeholder={'[Event "…"]\n1. e4 e5 2. Nf3 Nc6 …'}></textarea>
          {#if importError}<p class="err" role="alert">{importError}</p>{/if}
          <div class="import-btns">
            <button class="btn primary" disabled={importBusy || !importText.trim()} onclick={doImport}>{importBusy ? 'Importing…' : 'Import'}</button>
            <button class="btn ghost" onclick={() => ((importing = false), (importError = ''))}>Cancel</button>
          </div>
        </div>
      {/if}
      <div class="tools">
        <button class="btn" onclick={() => ((importing = !importing), (importError = ''))}><Icon name="history" size={16} />Import</button>
        <ShareGame game={boardGame} />
        <button class="btn" onclick={() => copy('pgn')}><Icon name="copy" size={16} />{copied === 'pgn' ? 'Copied' : 'Copy PGN'}</button>
        <button class="btn" onclick={() => copy('fen')}><Icon name="copy" size={16} />{copied === 'fen' ? 'Copied' : 'Copy FEN'}</button>
        <button class="btn" onclick={() => reset(Chess.default())}><Icon name="replay" size={16} />New board</button>
        <button class="btn" onclick={() => (editing = true)}><Icon name="close" size={16} />Clear / set up</button>
      </div>
    </div>
    <p class="label keys">Keys: ← → to move through the game, F to flip the board.</p>
  </aside>
</div>
{/if}

<style>
  .setup-card {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .setup-card h1 {
    margin: 0;
    font-size: 22px;
  }
  .import {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--border);
  }
  .import textarea {
    font: 13px/1.4 ui-monospace, Consolas, monospace;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    resize: vertical;
  }
  .note {
    margin: 0 0 8px;
    color: var(--warn, var(--loss));
    font-size: 14px;
  }
  .import .err {
    margin: 0;
    color: var(--loss);
    font-size: 14px;
  }
  .import-btns {
    display: flex;
    gap: 8px;
  }
  .var-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--gold) 9%, transparent);
  }
  .var-bar .label {
    flex: 1;
  }
  .small-btn {
    padding: 5px 12px;
    min-height: 0;
    font-size: 13.5px;
  }
  .moves-card :global(.tree) {
    max-height: 300px;
  }
  .reviewing,
  .report,
  .this-move {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    margin: 0;
  }
  .reviewing .bar {
    margin-top: 6px;
    height: 6px;
    border-radius: 3px;
    background: var(--border);
    overflow: hidden;
  }
  .reviewing .bar span {
    display: block;
    height: 100%;
    background: var(--brand);
    transition: width 0.3s;
  }
  .report {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .side-acc {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .side-acc strong {
    font-size: 18px;
    min-width: 44px;
  }
  .disc {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 1px solid var(--border);
  }
  .disc.white {
    background: #f4f4f4;
  }
  .disc.black {
    background: #222;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chip-b {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-weight: 700;
    font-size: 14px;
  }
  .review-btn {
    margin: 10px 14px;
  }
  .this-move {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .analysis {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    max-width: 1300px;
    margin: 0 auto;
    align-items: flex-start;
    justify-content: center;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 150px), 780px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .board-box {
    flex: 1;
    min-width: 0;
  }
  .evalbar {
    position: relative;
    width: 22px;
    flex: none;
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
    transition: height 0.4s ease;
  }
  .eval-text {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 4px;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    color: #1b1f2a;
  }
  .evalbar.flipped .eval-text {
    bottom: auto;
    top: 4px;
  }
  .nav {
    display: flex;
    gap: 6px;
    padding: 8px 10px;
    border-top: 1px solid var(--border);
  }
  .grow {
    flex: 1;
  }
  .side {
    flex: 1 1 360px;
    max-width: 440px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .page-title {
    font-size: 20px;
  }
  .db-note {
    margin: -6px 0 0;
  }
  .engine {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }
  .toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--action);
  }
  .lines {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line-btn {
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
  .line-btn:hover {
    background: var(--raised);
  }
  .chip {
    flex: none;
    min-width: 52px;
    text-align: center;
    padding: 2px 6px;
    border-radius: 5px;
    font-weight: 800;
    font-size: 13.5px;
    background: #f2f2f2;
    color: #111;
  }
  .chip.dark {
    background: #222;
    color: #f2f2f2;
    border: 1px solid #555;
  }
  .line-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .big-eval {
    font-size: 34px;
    margin: 4px 0 0;
  }
  .pv {
    margin: 0;
    color: var(--text-2);
    font-size: 14.5px;
    line-height: 1.5;
  }
  .moves-card {
    padding: 0;
    overflow: hidden;
  }
  .moves-card :global(.moves) {
    height: 260px;
  }
  .tools {
    display: flex;
    gap: 6px;
    padding: 10px;
    border-top: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .tools .btn {
    flex: 1 1 auto;
    min-height: 40px;
    padding: 0 10px;
    gap: 6px;
    font-size: 14.5px;
    white-space: nowrap;
  }
  .keys {
    margin: 0;
    font-size: 12.5px;
  }
  /*
   * Wide screens: the board and the side column both stay on screen. The
   * side column is as tall as the window; the moves and their buttons keep
   * their place at the bottom, and the engine / database panel above them
   * scrolls by itself, so a long database list never pushes the buttons
   * off the screen.
   */
  @media (min-width: 900px) {
    .analysis {
      flex-wrap: nowrap;
    }
    .board-col,
    .side {
      position: sticky;
      top: 12px;
    }
    .side {
      height: max(560px, calc(100dvh - 110px));
      max-height: 980px;
    }
    .info-card {
      flex: 0 1 auto;
      min-height: 150px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .moves-card {
      flex: 1 0 320px;
      min-height: 0;
    }
    .moves-card :global(.tree) {
      flex: 1 1 0;
      min-height: 90px;
      max-height: none;
      overscroll-behavior: contain;
    }
    .keys {
      flex: none;
    }
  }
  /* Short laptop screens: smaller tool buttons, no keyboard hint, more room for the moves. */
  @media (min-width: 900px) and (max-height: 820px) {
    .side {
      height: max(520px, calc(100dvh - 84px));
    }
    .keys {
      display: none;
    }
    .tools {
      padding: 6px 10px;
    }
    .tools .btn {
      min-height: 32px;
      font-size: 13.5px;
    }
    .moves-card {
      flex-basis: 300px;
    }
  }
  /* Phones and narrow windows: the engine and the database right under the board
     (their own scroll), then the moves and their buttons. */
  @media (max-width: 899px) {
    .side {
      max-width: none;
      flex-basis: 100%;
    }
    .info-card {
      max-height: 300px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .moves-card :global(.tree) {
      max-height: 180px;
    }
  }
  @media (max-width: 767px) {
    .keys {
      display: none;
    }
  }
  .guru {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    padding: 6px 0 2px;
  }
  .guru p {
    margin: 0;
  }
</style>

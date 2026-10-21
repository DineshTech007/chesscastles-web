<script lang="ts">
  /**
   * The coach's classroom, made for a laptop: the big board everyone sees (the engine's bar on its left), with the
   * tools on keys coaches already know (A arrows colour, S colour squares, P only pawns, B blindfold, C square names,
   * H hide moves, E engine, F flip, N new board, Q ask a question, G games, Esc clear, ← → the moves), the class beside
   * it (people, chat, moves, the games database, leaderboards, settings), every student's board while a question runs,
   * and the class's games.
   */
  import { onMount } from 'svelte';
  import type { Key } from '@lichess-org/chessground/types';
  import type { NormalMove } from 'chessops/types';
  import { makeUci } from 'chessops/util';
  import { makeFen, parseFen } from 'chessops/fen';
  import ClassBoard from './ClassBoard.svelte';
  import AskDialog from './AskDialog.svelte';
  import StudentGrid from './StudentGrid.svelte';
  import GamesView from './GamesView.svelte';
  import GamesDialog from './GamesDialog.svelte';
  import People from './People.svelte';
  import Chat from './Chat.svelte';
  import EnginePanel from './EnginePanel.svelte';
  import EvalBar from './EvalBar.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import VideoTile from './VideoTile.svelte';
  import MoveList from '$lib/components/MoveList.svelte';
  import BoardEditor from '$lib/components/BoardEditor.svelte';
  import DbPanel from '$lib/components/DbPanel.svelte';
  import { CloudBook } from '$lib/book/book';
  import { gamesDb } from '$lib/games/gamesDb';
  import { destsOf, moveFromKeys } from '$lib/chess/position';
  import { promotionFor } from '$lib/chess/promotion';
  import { readPgn } from '$lib/chess/pgn';
  import type { EngineInfo } from '$lib/engine/stockfish';
  import { classLink, saveClass, setHomework, START_FEN, type BoardView, type Item, type TaskKind } from './api';
  import { lineAt, toPgn, took } from './tasks';
  import type { Live } from './live.svelte';

  let { live, onexit }: { live: Live; onexit: () => void } = $props();

  const b = $derived(live.board);
  const at = $derived(lineAt(b.root, b.moves, b.ply));
  let view = $state<'board' | 'students' | 'games'>('board');
  let tab = $state<'people' | 'chat' | 'moves' | 'db' | 'lb' | 'class'>('people');
  let paint = $state(false);
  const COLORS = ['green', 'red', 'blue', 'yellow', 'orange'] as const;
  let brush = $state<(typeof COLORS)[number]>('green');
  let markColor = $state<string>('green');
  let asking = $state(false);
  let gaming = $state(false);
  let editing = $state(false);
  let pasting = $state(false);
  let pasteText = $state('');
  let pasteError = $state('');
  let helpOpen = $state(false);
  let ending = $state(false);
  let engineOn = $state(true);
  let engInfo = $state<EngineInfo | undefined>();
  let remount = $state(0);
  let copied = $state('');
  let note = $state('');
  const book = new CloudBook();

  // The coach's list of games and positions for the class (pasted PGN), kept on this device per class.
  type LibGame = { title: string; root: string; moves: string[] };
  let library = $state<LibGame[]>([]);
  const libKey = $derived(`cc.class.lib.${live.info.id}`);
  onMount(() => {
    try {
      library = JSON.parse(localStorage.getItem(`cc.class.lib.${live.info.id}`) ?? '[]');
    } catch {
      library = [];
    }
  });
  function saveLibrary(games: LibGame[]) {
    library = games;
    try {
      localStorage.setItem(libKey, JSON.stringify(games.slice(0, 200)));
    } catch {
      /* full or private */
    }
  }

  // A new question: the students' boards; when it is closed, the big board again. New games: the games.
  let lastTask = '';
  $effect(() => {
    const id = live.task?.id ?? '';
    if (id && id !== lastTask) view = 'students';
    if (!id && lastTask && view === 'students') view = 'board';
    lastTask = id;
  });
  let lastGames = 0;
  $effect(() => {
    const n = live.games.length;
    if (n > lastGames) view = 'games';
    if (!n && view === 'games') view = 'board';
    lastGames = n;
  });

  function set(change: Partial<BoardView>) {
    live.setBoard({ ...live.board, ...change });
  }
  function playUci(uci: string) {
    // The same move as the line's next: just step on (the rest of the line stays).
    if (b.moves[b.ply] === uci) return set({ ply: b.ply + 1, shapes: [], marks: {} });
    set({ moves: [...b.moves.slice(0, b.ply), uci], ply: b.ply + 1, shapes: [], marks: {} });
  }
  async function onmove(orig: Key, dest: Key) {
    if (paint || !at.pos) return;
    const role = await promotionFor(at.pos, orig, dest);
    if (role === null) return void remount++;
    playUci(makeUci(moveFromKeys(at.pos, orig, dest, role ?? undefined)));
  }
  const go = (ply: number) => set({ ply: Math.max(0, Math.min(b.moves.length, ply)), shapes: [], marks: {} });
  function onselect(key: Key) {
    if (!paint) return;
    const marks = { ...b.marks };
    if (marks[key] === markColor) delete marks[key];
    else marks[key] = markColor;
    set({ marks });
  }
  const newBoard = () => set({ root: START_FEN, moves: [], ply: 0, shapes: [], marks: {}, title: '', game: -1 });
  const clearDrawings = () => set({ shapes: [], marks: {} });

  function loadGame(i: number) {
    const g = library[i];
    if (!g) return;
    set({ root: g.root, moves: g.moves, ply: 0, shapes: [], marks: {}, title: g.title, game: i });
  }
  /** A master game from the database on the class board, at the position it was found from. */
  async function openDbGame(id: number) {
    const g = await gamesDb.game(id).catch(() => undefined);
    if (!g) return;
    const moves = g.moves.map((m) => makeUci(m));
    const here = at.fen.split(' ')[0];
    let ply = 0;
    const pos = g.start.clone();
    for (let i = 0; i < g.moves.length; i++) {
      pos.play(g.moves[i]);
      if (makeFen(pos.toSetup()).split(' ')[0] === here) {
        ply = i + 1;
        break;
      }
    }
    set({ root: makeFen(g.start.toSetup()), moves, ply, shapes: [], marks: {}, title: `${g.white} – ${g.black}${g.year ? ` (${g.year})` : ''}`, game: -1 });
  }
  function paste() {
    pasteError = '';
    const text = pasteText.trim();
    if (!text) return;
    if (/^[pnbrqkPNBRQK1-8/]+ [wb] /.test(text) && parseFen(text).isOk) {
      set({ root: text, moves: [], ply: 0, shapes: [], marks: {}, title: '', game: -1 });
      pasting = false;
      pasteText = '';
      return;
    }
    const games = readPgn(text).filter((g) => g.plies.length || g.headers.get('FEN'));
    if (!games.length) return void (pasteError = 'No games or position found. Paste PGN or a FEN.');
    const list: LibGame[] = games.map((g, i) => {
      const w = g.headers.get('White'), bl = g.headers.get('Black');
      const title = w && bl && w !== '?' ? `${w} – ${bl}` : g.headers.get('Event') && g.headers.get('Event') !== '?' ? g.headers.get('Event')! : `Position ${i + 1}`;
      return { title, root: makeFen(g.start.toSetup()), moves: g.plies.map((p) => makeUci(p.move)) };
    });
    saveLibrary(list);
    loadGame(0);
    pasting = false;
    pasteText = '';
  }
  async function copyText(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = done;
    } catch {
      copied = 'Could not copy';
    }
    setTimeout(() => (copied = ''), 2500);
  }

  /** Bank puzzles this class had today, not given again. */
  let used = new Set<string>();
  async function ask(task: { kind: TaskKind; title: string; seconds: number; points: number; minus: number; tries: number; items: Item[]; homework?: number }) {
    for (const i of task.items) if (i.ref) used.add(i.ref);
    asking = false;
    if (task.homework) {
      try {
        await setHomework(live.info.id, { kind: task.kind, title: task.title, points: task.points, minus: task.minus, tries: task.tries, items: task.items, due: task.homework });
        live.notice = 'Homework set: students see it in their class.';
      } catch (e) {
        live.error = (e as Error).message;
      }
      return;
    }
    live.ask(task);
  }
  async function announce() {
    const text = note.trim();
    if (!text) return;
    try {
      await saveClass(live.info.id, { announce: text });
      note = '';
      live.notice = 'Announced to the class.';
    } catch (e) {
      live.error = (e as Error).message;
    }
  }

  function onkey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (e.ctrlKey || e.metaKey || e.altKey || asking || editing || pasting || ending || gaming) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const k = e.key;
    const act: Record<string, () => void> = {
      ArrowLeft: () => go(b.ply - 1),
      ArrowRight: () => go(b.ply + 1),
      Home: () => go(0),
      End: () => go(b.moves.length),
      f: () => set({ orient: b.orient === 'white' ? 'black' : 'white' }),
      s: () => (paint = !paint),
      a: () => (brush = COLORS[(COLORS.indexOf(brush) + 1) % COLORS.length]),
      p: () => set({ pawns: !b.pawns }),
      b: () => set({ blind: !b.blind }),
      c: () => set({ squares: !b.squares }),
      h: () => live.setSettings({ moves: !live.settings.moves }),
      e: () => (engineOn = !engineOn),
      n: () => newBoard(),
      q: () => (asking = true),
      g: () => (gaming = true),
      Escape: () => clearDrawings(),
      x: () => clearDrawings(),
      '?': () => (helpOpen = !helpOpen),
    };
    if (view !== 'board' && k.startsWith('Arrow')) return;
    const f = act[k] ?? act[k.toLowerCase()];
    if (f) {
      e.preventDefault();
      f();
    }
  }

  const liveFor = $derived(live.session.started ? took(live.now - live.session.started) : '');
  const hands = $derived(live.people.filter((p) => p.hand).length);
  const holderName = $derived(live.people.find((p) => p.uid === live.holder)?.name);
  const REACTIONS: [string, string][] = [
    ['👏', 'Well done!'],
    ['⭐', 'Superstar!'],
    ['🔥', 'On fire!'],
    ['🏆', 'Champion!'],
    ['💪', 'Keep going!'],
    ['🤔', 'Think again!'],
  ];
  function fullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
  function playDb(m: NormalMove) {
    if (at.pos?.isLegal(m)) playUci(makeUci(m));
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="coach">
  <header class="top">
    <div class="name">
      <b>{live.info.name}</b>
      <span class="pill live">● LIVE {liveFor}</span>
      {#if live.status !== 'open'}<span class="pill warn">Reconnecting…</span>{/if}
    </div>
    <div class="voice">
      {#if !live.inVoice}
        <button class="btn" onclick={() => live.joinVoice()} disabled={live.joiningVoice}>🎙️ {live.joiningVoice ? 'Joining…' : 'Start voice'}</button>
      {:else}
        <button class="btn" class:on={live.micOn} onclick={() => live.setMic(!live.micOn)} title="Your microphone">{live.micOn ? '🎙️ Mic on' : '🔇 Mic off'}</button>
        <button class="btn" class:on={live.camOn === 'camera'} onclick={() => live.setCam(live.camOn === 'camera' ? '' : 'camera')} title="Your camera to every student">📷 {live.camOn === 'camera' ? 'Camera on' : 'Camera'}</button>
        <button class="btn" class:on={live.camOn === 'screen'} onclick={() => live.setCam(live.camOn === 'screen' ? '' : 'screen')} title="Share your screen with every student">🖥 {live.camOn === 'screen' ? 'Sharing' : 'Screen'}</button>
        <button class="btn ghost" onclick={() => live.mute('*')} title="Mute every student">Mute all</button>
        <button class="btn ghost" onclick={() => live.leaveVoice()}>Leave voice</button>
      {/if}
    </div>
    <div class="acts">
      <button class="btn primary" onclick={() => (asking = true)} title="Q">❓ Ask a question</button>
      <button class="btn" onclick={() => (gaming = true)} title="G">🎮 Games</button>
      <button class="btn" onclick={() => (tab = 'lb')}>🏆 Leaderboard</button>
      <button class="btn ghost" onclick={fullscreen} title="Full screen">⛶</button>
      <button class="btn ghost" onclick={() => (ending = true)}>End class</button>
      <button class="btn ghost" onclick={onexit} title="Leave the room (the class stays open)">Exit</button>
    </div>
  </header>
  {#if live.micError && live.inVoice}<p class="note">{live.micError}</p>{/if}

  <div class="main">
    <section class="stage">
      <div class="views" role="tablist" aria-label="View">
        <button role="tab" class:on={view === 'board'} onclick={() => (view = 'board')}>♟ Class board</button>
        {#if live.task}<button role="tab" class:on={view === 'students'} onclick={() => (view = 'students')}>👥 Students' boards{live.task.over ? '' : ' ●'}</button>{/if}
        {#if live.games.length}<button role="tab" class:on={view === 'games'} onclick={() => (view = 'games')}>🎮 Games ({live.games.length})</button>{/if}
      </div>
      {#if view === 'students' && live.task}
        <StudentGrid {live} onspotlight={() => (view = 'board')} />
      {:else if view === 'games'}
        <GamesView {live} onspotlight={() => (view = 'board')} onnew={() => (gaming = true)} />
      {:else}
        <div class="board-head">
          {#if library.length}
            <div class="games">
              <button class="btn ghost" onclick={() => loadGame(Math.max(0, b.game - 1))} disabled={b.game <= 0} aria-label="Previous game">‹</button>
              <select value={b.game} onchange={(e) => loadGame(Number(e.currentTarget.value))} aria-label="Game">
                {#if b.game < 0}<option value={-1}>Load game ({library.length})</option>{/if}
                {#each library as g, i (i)}<option value={i}>{i + 1}. {g.title}</option>{/each}
              </select>
              <button class="btn ghost" onclick={() => loadGame(Math.min(library.length - 1, b.game + 1))} disabled={b.game >= library.length - 1} aria-label="Next game">›</button>
            </div>
          {/if}
          <span class="title">{b.title || (holderName ? `${holderName} is moving` : '')}</span>
          {#if holderName}<button class="btn ghost" onclick={() => live.give('')}>Take the board back from {holderName}</button>{/if}
        </div>
        <div class="board-row">
          {#if engineOn}<EvalBar info={engInfo} orientation={b.orient} />{/if}
          <div class="boardbox" class:paint>
            {#key remount}
              <ClassBoard
                fen={at.fen}
                orientation={b.orient}
                lastMove={at.last as Key[] | undefined}
                check={at.check}
                movable={paint || !at.pos ? undefined : at.turn}
                dests={paint || !at.pos ? new Map() : destsOf(at.pos)}
                shapes={b.shapes}
                marks={b.marks}
                squares={b.squares}
                blind={b.blind}
                pawns={b.pawns}
                coach
                {brush}
                label="The class board"
                {onmove}
                ondraw={(shapes) => set({ shapes })}
                {onselect}
              />
            {/key}
          </div>
        </div>
        <div class="tools" role="toolbar" aria-label="Board tools">
          <button class="tool" onclick={() => go(0)} disabled={b.ply === 0} title="Start (Home)">⏮</button>
          <button class="tool" onclick={() => go(b.ply - 1)} disabled={b.ply === 0} title="Back (←)">◀</button>
          <button class="tool" onclick={() => go(b.ply + 1)} disabled={b.ply >= b.moves.length} title="Forward (→)">▶</button>
          <button class="tool" onclick={() => go(b.moves.length)} disabled={b.ply >= b.moves.length} title="End (End)">⏭</button>
          <span class="sep"></span>
          <button class="tool" onclick={() => set({ orient: b.orient === 'white' ? 'black' : 'white' })} title="Flip the board (F)">⇅</button>
          <button class="tool" onclick={newBoard} title="New board (N)">⟲</button>
          <button class="tool" onclick={() => (editing = true)} title="Set up a position">✎</button>
          <button class="tool" onclick={() => (pasting = true)} title="Paste PGN or FEN">📋</button>
          <button class="tool" onclick={() => copyText(toPgn(b.root, b.moves, b.title || live.info.name), 'PGN copied')} title="Copy the moves as PGN">💾</button>
          <span class="sep"></span>
          <span class="swatches" title="Arrow colour (A); hold Shift, Ctrl or Alt for others">
            {#each COLORS as c (c)}<button class="sw {c}" class:on={brush === c} onclick={() => (brush = c)} aria-label="{c} arrows"></button>{/each}
          </span>
          <button class="tool" class:on={paint} onclick={() => (paint = !paint)} title="Colour squares (S): click squares">▦</button>
          {#if paint}
            <span class="swatches">
              {#each [...COLORS, 'outline'] as c (c)}<button class="sw sq {c}" class:on={markColor === c} onclick={() => (markColor = c)} aria-label="{c} squares"></button>{/each}
            </span>
          {/if}
          <button class="tool" onclick={clearDrawings} title="Clear arrows and squares (Esc)">⌫</button>
          <span class="sep"></span>
          <button class="tool" class:on={b.squares} onclick={() => set({ squares: !b.squares })} title="Square names on every square (C)">a1</button>
          <button class="tool" class:on={b.pawns} onclick={() => set({ pawns: !b.pawns })} title="Only the pawns (P)">♙</button>
          <button class="tool" class:on={b.blind} onclick={() => set({ blind: !b.blind })} title="Blindfold: students see no pieces (B)">🙈</button>
          <button class="tool" class:on={!live.settings.moves} onclick={() => live.setSettings({ moves: !live.settings.moves })} title="Hide the moves from students (H)">🚫≡</button>
          <button class="tool" class:on={engineOn} onclick={() => (engineOn = !engineOn)} title="Engine (E)">⚙</button>
          <button class="tool" onclick={() => (helpOpen = !helpOpen)} title="Keys (?)">?</button>
          {#if copied}<span class="copied">{copied}</span>{/if}
        </div>
        {#if engineOn}<div class="engine"><EnginePanel fen={at.fen} bind:info={engInfo} /></div>{/if}
      {/if}
    </section>

    <aside class="side">
      <div class="tabs" role="tablist">
        <button role="tab" class:on={tab === 'people'} onclick={() => (tab = 'people')}>People{hands ? ` ✋${hands}` : ''}</button>
        <button role="tab" class:on={tab === 'chat'} onclick={() => (tab = 'chat')}>Chat{live.unread ? ` (${live.unread})` : ''}</button>
        <button role="tab" class:on={tab === 'moves'} onclick={() => (tab = 'moves')}>Moves</button>
        <button role="tab" class:on={tab === 'db'} onclick={() => (tab = 'db')}>Database</button>
        <button role="tab" class:on={tab === 'lb'} onclick={() => (tab = 'lb')}>Leaderboard</button>
        <button role="tab" class:on={tab === 'class'} onclick={() => (tab = 'class')}>Class</button>
      </div>
      <div class="panel">
        {#if tab === 'people'}
          <People {live} />
        {:else if tab === 'chat'}
          <Chat {live} />
        {:else if tab === 'moves'}
          {#if at.sans.length}<MoveList sans={at.sans} current={b.ply} onselect={go} />{:else}<p class="muted">No moves yet. Move on the board, or paste a game.</p>{/if}
          <p class="muted small">{live.settings.moves ? 'Students see the moves.' : 'The moves are hidden from students (H).'}</p>
        {:else if tab === 'db'}
          {#if at.pos}
            <DbPanel pos={at.pos} {book} onplay={playDb} onopen={openDbGame} />
          {:else}
            <p class="muted">The database needs a position that can be played.</p>
          {/if}
          <label class="toggle"><input type="checkbox" checked={!!live.settings.db} onchange={(e) => live.setSettings({ db: e.currentTarget.checked })} /> Students see the database too</label>
        {:else if tab === 'lb'}
          {#if live.task}
            <h3>This question</h3>
            <Leaderboard rows={live.lb} total={live.task.items.length} />
          {/if}
          <h3>Today's class</h3>
          <Leaderboard rows={live.session.scores} empty="Scores show here after the first question." />
          {#each live.session.tasks as t, i (i)}
            <p class="muted small">{i + 1}. {t.title}: {t.top.map((r) => `${r.name} ${r.points}`).join(', ') || 'no answers'}</p>
          {/each}
          <h3>All classes</h3>
          <Leaderboard rows={live.allTime} empty="The class's leaderboard over every class shows here." />
        {:else}
          <div class="settings">
            <button class="btn" onclick={() => copyText(classLink(live.info.id), 'Class link copied')}>🔗 Copy the class link</button>
            <h3>Announce</h3>
            <div class="announce">
              <input bind:value={note} maxlength="400" placeholder="e.g. Tournament on Sunday at 3 pm" aria-label="Announcement" onkeydown={(e) => e.key === 'Enter' && announce()} />
              <button class="btn primary" onclick={announce} disabled={!note.trim()}>📢</button>
            </div>
            {#each live.info.notes ?? [] as n (n.id)}<p class="small">📢 {n.text}</p>{/each}
            <h3>Students</h3>
            <label class="toggle"><input type="checkbox" checked={live.settings.lb} onchange={(e) => live.setSettings({ lb: e.currentTarget.checked })} /> See the leaderboard during a question</label>
            <label class="toggle"><input type="checkbox" checked={live.settings.moves} onchange={(e) => live.setSettings({ moves: e.currentTarget.checked })} /> See the moves</label>
            <label class="toggle"><input type="checkbox" checked={live.settings.chat} onchange={(e) => live.setSettings({ chat: e.currentTarget.checked })} /> See each other's messages</label>
            <label class="toggle"><input type="checkbox" checked={live.settings.engine} onchange={(e) => live.setSettings({ engine: e.currentTarget.checked })} /> Have the engine</label>
            <label class="toggle"><input type="checkbox" checked={!!live.settings.db} onchange={(e) => live.setSettings({ db: e.currentTarget.checked })} /> Have the games database</label>
            <label class="toggle"><input type="checkbox" checked={live.settings.talk} onchange={(e) => live.setSettings({ talk: e.currentTarget.checked })} /> Can switch their microphone on</label>
            <h3>Cheer the class</h3>
            <div class="reacts">
              {#each REACTIONS as [e, text] (e)}<button class="btn" onclick={() => live.react(e, text)} title={text}>{e}</button>{/each}
            </div>
          </div>
        {/if}
      </div>
    </aside>
  </div>
</div>

{#if live.localVideo}<VideoTile stream={live.localVideo} label={live.camOn === 'screen' ? 'Your screen (students see it)' : 'You (students see you)'} mirror={live.camOn === 'camera'} />{/if}

{#if asking}
  <AskDialog fen={at.fen} {used} onask={ask} onclose={() => (asking = false)} />
{/if}
{#if gaming}
  <GamesDialog {live} fen={at.fen} onclose={() => (gaming = false)} />
{/if}
{#if editing}
  <div class="scrim" role="presentation" onclick={() => (editing = false)}></div>
  <div class="dialog wide" role="dialog" aria-modal="true" aria-label="Set up a position">
    <BoardEditor
      fen={at.fen}
      applyLabel="Put on the class board"
      onapply={(fen) => {
        set({ root: fen, moves: [], ply: 0, shapes: [], marks: {}, title: '', game: -1 });
        editing = false;
      }}
      oncancel={() => (editing = false)}
    />
  </div>
{/if}
{#if pasting}
  <div class="scrim" role="presentation" onclick={() => (pasting = false)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Paste PGN or FEN">
    <h2>Paste PGN or FEN</h2>
    <p class="muted small">Several games at once make a list you step through with ‹ › ("Load game").</p>
    <textarea bind:value={pasteText} rows="10" placeholder="[Event &quot;…&quot;]&#10;1. e4 e5 2. Nf3 …   or a FEN"></textarea>
    {#if pasteError}<p class="err">{pasteError}</p>{/if}
    <div class="row">
      <button class="btn ghost" onclick={() => (pasting = false)}>Cancel</button>
      <button class="btn primary" onclick={paste} disabled={!pasteText.trim()}>Load</button>
    </div>
  </div>
{/if}
{#if helpOpen}
  <div class="scrim" role="presentation" onclick={() => (helpOpen = false)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Keys">
    <h2>Keys</h2>
    <ul class="keys">
      <li><kbd>←</kbd> <kbd>→</kbd> <kbd>Home</kbd> <kbd>End</kbd> step through the moves</li>
      <li>Right-drag: arrows and circles; <kbd>A</kbd> changes the colour (Shift, Ctrl, Alt give others)</li>
      <li><kbd>S</kbd> colour squares (then click squares)</li>
      <li><kbd>Esc</kbd> or <kbd>X</kbd> clear arrows and squares</li>
      <li><kbd>F</kbd> flip · <kbd>N</kbd> new board · <kbd>Q</kbd> ask a question · <kbd>G</kbd> games</li>
      <li><kbd>C</kbd> square names · <kbd>P</kbd> only pawns · <kbd>B</kbd> blindfold · <kbd>H</kbd> hide moves · <kbd>E</kbd> engine</li>
    </ul>
    <button class="btn" onclick={() => (helpOpen = false)}>Close</button>
  </div>
{/if}
{#if ending}
  <div class="scrim" role="presentation" onclick={() => (ending = false)}></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="End the class">
    <h2>End the class?</h2>
    <p class="muted">Everyone leaves the room, and you get the class report: who came and for how long, the questions and the scores.</p>
    <div class="row">
      <button class="btn ghost" onclick={() => (ending = false)}>Not yet</button>
      <button
        class="btn primary"
        onclick={() => {
          ending = false;
          live.endClass();
        }}>End the class</button
      >
    </div>
  </div>
{/if}

<style>
  .coach {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 200px;
  }
  .name b {
    font: 700 20px var(--font-title);
  }
  .pill.warn {
    background: rgba(240, 82, 82, 0.18);
    color: var(--loss);
  }
  .voice,
  .acts {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .btn.on {
    border-color: var(--win);
    color: var(--win);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    cursor: pointer;
    margin-top: 8px;
  }
  .note {
    margin: 4px 12px 0;
    color: var(--loss);
    font-size: 13px;
  }
  .main {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
  }
  @media (max-width: 1000px) {
    .main {
      display: block;
      overflow: auto;
    }
    .stage,
    .panel {
      overflow: visible;
    }
  }
  .stage {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 8px 14px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .stage > :global(.grid-view),
  .stage > :global(.games) {
    width: 100%;
  }
  .views {
    align-self: stretch;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .views button {
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--muted);
    border-radius: 999px;
    padding: 5px 12px;
    font: 700 13px var(--font-body);
    cursor: pointer;
  }
  .views button.on {
    color: var(--on-action);
    background: var(--action);
    border-color: var(--action);
  }
  .board-head {
    width: min(100%, calc(100vh - 250px));
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-height: 34px;
  }
  .games {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .games select {
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px 6px;
    max-width: 260px;
  }
  .title {
    font-weight: 700;
    flex: 1;
  }
  .board-row {
    display: flex;
    gap: 8px;
    width: min(100%, calc(100vh - 250px));
    min-width: 280px;
  }
  .boardbox {
    flex: 1;
    min-width: 0;
  }
  .boardbox.paint {
    cursor: crosshair;
  }
  .tools {
    width: min(100%, calc(100vh - 250px));
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .tool {
    min-width: 34px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: 700 14px var(--font-body);
    cursor: pointer;
    padding: 0 6px;
  }
  .tool:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tool.on {
    border-color: var(--gold);
    color: var(--gold);
    background: var(--gold-soft);
  }
  .sep {
    width: 1px;
    height: 22px;
    background: var(--border);
    margin: 0 2px;
  }
  .swatches {
    display: flex;
    gap: 3px;
    align-items: center;
  }
  .sw {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .sw.sq {
    border-radius: 4px;
  }
  .sw.on {
    border-color: var(--text);
  }
  .sw.green {
    background: #15781b;
  }
  .sw.red {
    background: #d6342a;
  }
  .sw.blue {
    background: #2860dc;
  }
  .sw.yellow {
    background: #e6b800;
  }
  .sw.orange {
    background: #e8820c;
  }
  .sw.outline {
    background: transparent;
    box-shadow: inset 0 0 0 3px #1f4fe0;
  }
  .copied {
    color: var(--win);
    font-size: 13px;
    font-weight: 600;
  }
  .engine {
    width: min(100%, calc(100vh - 250px));
  }
  .side {
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
  }
  .tabs button {
    flex: 1;
    background: none;
    border: 0;
    border-bottom: 3px solid transparent;
    color: var(--muted);
    padding: 10px 6px;
    font: 700 13px var(--font-body);
    cursor: pointer;
    white-space: nowrap;
  }
  .tabs button.on {
    color: var(--text);
    border-bottom-color: var(--gold);
  }
  .panel {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 10px 12px;
  }
  h3 {
    margin: 14px 0 8px;
    font: 700 16px var(--font-title);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
    margin: 2px 0;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .announce {
    display: flex;
    gap: 6px;
  }
  .announce input {
    flex: 1;
    min-width: 0;
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    font: 500 14px var(--font-body);
  }
  .reacts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .reacts .btn {
    font-size: 22px;
    padding: 4px 10px;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(5, 10, 20, 0.55);
  }
  .dialog {
    position: fixed;
    z-index: 81;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-panel);
    padding: 16px 18px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dialog.wide {
    width: min(980px, calc(100vw - 24px));
  }
  .dialog h2 {
    margin: 0;
    font: 700 22px var(--font-title);
  }
  textarea {
    width: 100%;
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px;
    font: 500 13px ui-monospace, monospace;
    resize: vertical;
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .err {
    color: var(--loss);
    margin: 0;
  }
  .keys {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  kbd {
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 5px;
    padding: 0 5px;
    font: 700 12px var(--font-body);
    background: var(--raised);
  }
</style>

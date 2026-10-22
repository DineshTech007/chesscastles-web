<script lang="ts">
  /**
   * A student in the class (a phone or a laptop): the coach's board as it is now, their own board when the coach asks
   * a question, their game when the coach starts games, the big board in their hands when the coach gives it, the
   * coach's camera or screen, a raised hand, the class voice (listen, and talk when the coach allows), messages to the
   * coach, the leaderboards, and (when the coach allows) the moves, the engine and the games database.
   */
  import type { Key } from '@lichess-org/chessground/types';
  import type { DrawShape } from '@lichess-org/chessground/draw';
  import { makeUci } from 'chessops/util';
  import ClassBoard from './ClassBoard.svelte';
  import TaskSolver from './TaskSolver.svelte';
  import GameBoard from './GameBoard.svelte';
  import Chat from './Chat.svelte';
  import People from './People.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import EnginePanel from './EnginePanel.svelte';
  import ClassBrand from './ClassBrand.svelte';
  import EvalBar from './EvalBar.svelte';
  import VideoTile from './VideoTile.svelte';
  import Gallery from './Gallery.svelte';
  import MoveList from '$lib/components/MoveList.svelte';
  import DbPanel from '$lib/components/DbPanel.svelte';
  import { CloudBook } from '$lib/book/book';
  import { destsOf, moveFromKeys } from '$lib/chess/position';
  import { promotionFor } from '$lib/chess/promotion';
  import { sounds } from '$lib/sound';
  import type { EngineInfo } from '$lib/engine/stockfish';
  import { lineAt } from './tasks';
  import type { Live } from './live.svelte';

  let { live, onexit }: { live: Live; onexit: () => void } = $props();

  const b = $derived(live.board);
  const at = $derived(lineAt(b.root, b.moves, b.ply));
  const holding = $derived(live.holder === live.me.uid);
  let flipped = $state(false);
  const orient = $derived(flipped ? (b.orient === 'white' ? 'black' : 'white') : b.orient);
  let tab = $state<'chat' | 'lb' | 'moves' | 'db' | 'people'>('chat');
  let remount = $state(0);
  let engInfo = $state<EngineInfo | undefined>();
  let engLines = $state<EngineInfo[]>([]);
  /** When the coach gives the class the engine: its three best moves as arrows on my board. */
  const engineArrows = $derived<DrawShape[]>(
    live.settings.engine
      ? engLines.slice(0, 3).flatMap((l, i) => {
          const u = l.pv[0];
          return u ? [{ orig: u.slice(0, 2) as Key, dest: u.slice(2, 4) as Key, brush: i === 0 ? 'paleBlue' : 'paleGrey', modifiers: { lineWidth: [14, 9, 6][i] } }] : [];
        })
      : [],
  );
  const book = new CloudBook();
  /** Back to the coach's board during a question or a game (to look), or the question/game. */
  let peek = $state(false);
  const myGame = $derived(live.games.find((g) => !g.result && (g.white === live.me.uid || g.black === live.me.uid)) ?? live.games.find((g) => g.white === live.me.uid || g.black === live.me.uid));
  const showing = $derived<'task' | 'game' | 'board'>(peek ? 'board' : live.task ? 'task' : myGame ? 'game' : 'board');
  // A new question or game: shown at once.
  let seenTask = '';
  let seenGame = '';
  $effect(() => {
    const t = live.task?.id ?? '';
    const g = myGame?.id ?? '';
    if ((t && t !== seenTask) || (g && g !== seenGame)) peek = false;
    seenTask = t;
    seenGame = g;
  });

  // A move sound when the coach's board moves on.
  let lastPly = -1;
  let lastRoot = '';
  $effect(() => {
    const ply = b.ply;
    if (lastRoot === b.root && ply === lastPly + 1) sounds.move();
    lastPly = ply;
    lastRoot = b.root;
  });

  async function onmove(orig: Key, dest: Key) {
    if (!holding || !at.pos) return;
    const role = await promotionFor(at.pos, orig, dest);
    if (role === null) return void remount++;
    live.move(makeUci(moveFromKeys(at.pos, orig, dest, role ?? undefined)));
  }
  const me = $derived(live.people.find((p) => p.uid === live.me.uid));
  const canTalk = $derived(live.settings.talk || !!me?.allow);
  const coachCam = $derived(live.people.some((p) => p.coach && p.cam));
  /** The coach's shared screen: big in the corner (the coach's camera is in the gallery). */
  const coachScreen = $derived(live.people.some((p) => p.coach && p.screen));
</script>

<div class="student">
  <header class="top">
    <div class="name">
      <ClassBrand />
      <b>{live.info.name}</b>
      <span class="muted">with {live.info.coachName}</span>
      {#if live.status !== 'open'}<span class="pill warn">Reconnecting…</span>{:else if !live.coachOnline}<span class="pill">Coach away</span>{:else}<span class="pill live">● LIVE</span>{/if}
    </div>
    <div class="acts">
      {#if !live.inVoice}
        <button class="btn primary" onclick={() => live.joinVoice()} disabled={live.joiningVoice}>🎧 {live.joiningVoice ? 'Joining…' : 'Join voice'}</button>
        {#if live.settings.cams !== false}<button class="btn" onclick={() => live.setCam('camera')} disabled={live.joiningVoice} title="Joins the voice and switches your camera on">📷 Camera</button>{/if}
      {:else}
        <button class="btn" class:on={live.micOn} onclick={() => live.setMic(!live.micOn)} disabled={!canTalk && !live.micOn} title={canTalk ? 'Your microphone' : 'Raise your hand to speak'}>{live.micOn ? '🎙️ Mic on' : '🔇 Mic off'}</button>
        {#if live.settings.cams !== false || live.camOn}
          <button class="btn" class:on={!!live.camOn} onclick={() => live.setCam(live.camOn ? '' : 'camera')} title={live.settings.peers === false ? 'Only your coach sees your camera' : 'Your class sees your camera'}>📷 {live.camOn ? 'Camera on' : 'Camera'}</button>
        {/if}
      {/if}
      <button class="btn" class:hand={live.handUp} onclick={() => live.raiseHand(!live.handUp)}>{live.handUp ? '✋ Hand up' : '✋ Raise hand'}</button>
      <button class="btn ghost" onclick={onexit}>Leave</button>
    </div>
  </header>
  {#if !live.inVoice && live.coachOnline}
    <button class="join" onclick={() => live.joinVoice()} disabled={live.joiningVoice}>🎧 Tap to hear{coachCam ? ' and see' : ''} your coach</button>
  {/if}
  {#if live.micError && live.inVoice}<p class="note">{live.micError}</p>{/if}

  <div class="main">
    <section class="stage">
      {#if showing === 'task'}
        <TaskSolver host={live} />
        <button class="btn ghost small" onclick={() => (peek = true)}>See the coach's board</button>
      {:else if showing === 'game' && myGame}
        <GameBoard {live} game={myGame} />
        <button class="btn ghost small" onclick={() => (peek = true)}>See the coach's board</button>
      {:else}
        {#if live.task}<button class="btn primary" onclick={() => (peek = false)}>Back to the question</button>{:else if myGame}<button class="btn primary" onclick={() => (peek = false)}>Back to my game</button>{/if}
        <div class="banner" class:mine={holding}>
          {#if holding}<b>Your turn on the big board!</b> Everyone sees your move.{:else if b.title}<b>{b.title}</b>{:else if !live.coachOnline}Waiting for the coach…{:else}Watching the coach's board{/if}
        </div>
        <div class="board-row">
          {#if live.settings.engine}<EvalBar info={engInfo} orientation={orient} />{/if}
          <div class="boardbox">
            {#key remount}
              <ClassBoard
                fen={at.fen}
                orientation={orient}
                lastMove={at.last as Key[] | undefined}
                check={at.check}
                movable={holding && at.pos ? at.turn : undefined}
                dests={holding && at.pos ? destsOf(at.pos) : new Map()}
                shapes={b.shapes}
                marks={b.marks}
                squares={b.squares}
                blind={b.blind}
                pawns={b.pawns}
                label="The coach's board"
                autoShapes={engineArrows}
                {onmove}
              />
            {/key}
          </div>
        </div>
        <div class="row">
          <button class="btn ghost small" onclick={() => (flipped = !flipped)}>⇅ Flip</button>
          {#if live.settings.moves && b.moves.length}<span class="muted small">Move {Math.ceil(b.ply / 2)}{b.ply % 2 ? '' : b.ply ? '…' : ''}</span>{/if}
        </div>
        {#if live.settings.engine}<EnginePanel fen={at.fen} bind:info={engInfo} bind:lines={engLines} />{/if}
      {/if}
    </section>

    <aside class="side">
      <Gallery {live} />
      <div class="tabs" role="tablist">
        <button role="tab" class:on={tab === 'chat'} onclick={() => (tab = 'chat')}>Chat{live.unread ? ` (${live.unread})` : ''}</button>
        <button role="tab" class:on={tab === 'lb'} onclick={() => (tab = 'lb')}>Leaderboard</button>
        {#if live.settings.moves}<button role="tab" class:on={tab === 'moves'} onclick={() => (tab = 'moves')}>Moves</button>{/if}
        {#if live.settings.db}<button role="tab" class:on={tab === 'db'} onclick={() => (tab = 'db')}>Database</button>{/if}
        <button role="tab" class:on={tab === 'people'} onclick={() => (tab = 'people')}>Class</button>
      </div>
      <div class="panel">
        {#if tab === 'chat'}
          <Chat {live} />
        {:else if tab === 'lb'}
          {#if live.task && live.lb.length}
            <h3>This question</h3>
            <Leaderboard rows={live.lb} me={live.me.uid} total={live.task.items.length} />
          {/if}
          <h3>Today's class</h3>
          <Leaderboard rows={live.session.scores} me={live.me.uid} empty="Scores show here after the first question." />
          <h3>All classes</h3>
          <Leaderboard rows={live.allTime} me={live.me.uid} empty="Your class's leaderboard over every class shows here." />
        {:else if tab === 'moves' && live.settings.moves}
          {#if at.sans.length}<MoveList sans={at.sans} current={b.ply} />{:else}<p class="muted">No moves yet.</p>{/if}
        {:else if tab === 'db' && live.settings.db}
          {#if at.pos}<DbPanel pos={at.pos} {book} onplay={() => {}} />{:else}<p class="muted">No position to look up.</p>{/if}
        {:else}
          {#each live.info.notes ?? [] as n (n.id)}<p class="note-row">📢 {n.text}</p>{/each}
          <People {live} />
        {/if}
      </div>
    </aside>
  </div>
</div>
{#if live.coachVideo && coachScreen}<VideoTile stream={live.coachVideo} label="{live.info.coachName}'s screen" wide />{/if}


<style>
  .student {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
  }
  .name b {
    font: 700 19px var(--font-title);
  }
  @media (max-width: 600px) {
    .name {
      flex-basis: 100%;
    }
    .acts {
      width: 100%;
    }
    .acts .btn {
      flex: 1;
      padding: 8px 6px;
      font-size: 14px;
      white-space: nowrap;
    }
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 13px;
  }
  .pill.warn {
    background: rgba(240, 82, 82, 0.18);
    color: var(--loss);
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .btn.on {
    border-color: var(--win);
    color: var(--win);
  }
  .btn.hand {
    border-color: var(--gold);
    color: var(--gold);
    background: var(--gold-soft);
  }
  .join {
    margin: 8px 12px 0;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid var(--gold);
    background: var(--gold-soft);
    color: var(--text);
    font: 700 15px var(--font-body);
    cursor: pointer;
  }
  .note {
    margin: 4px 12px 0;
    color: var(--muted);
    font-size: 13px;
  }
  .note-row {
    margin: 0 0 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--gold-soft);
  }
  .main {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
  }
  /* Narrow screens: one column that scrolls as a whole (the board never under the tabs). */
  @media (max-width: 900px) {
    .main {
      display: block;
      overflow: auto;
    }
    .stage,
    .panel {
      overflow: visible;
    }
    .side {
      min-height: 50vh;
    }
  }
  .stage {
    min-width: 0;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    overflow: auto;
  }
  .stage > :global(*) {
    width: min(100%, calc(100vh - 200px));
    min-width: min(100%, 300px);
  }
  .banner {
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--raised);
    text-align: center;
  }
  .banner.mine {
    background: var(--gold-soft);
    border: 1px solid var(--gold);
    animation: glow 1.2s ease-in-out infinite alternate;
  }
  @keyframes glow {
    to {
      box-shadow: 0 0 18px rgba(237, 176, 64, 0.5);
    }
  }
  .board-row {
    display: flex;
    gap: 6px;
  }
  .boardbox {
    flex: 1;
    min-width: 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .side {
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  @media (max-width: 900px) {
    .side {
      border-left: 0;
      border-top: 1px solid var(--border);
    }
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
    font: 700 14px var(--font-body);
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
    margin: 12px 0 8px;
    font: 700 16px var(--font-title);
  }
</style>

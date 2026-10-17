<script lang="ts">
  /** Watches a friend's game on Chess Castles live, as an audience: the board, both clocks and the result. */
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/state';
  import Board from '$lib/components/Board.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { fenOf, keyOf, positionFromFen, uciToMove } from '$lib/chess/position';
  import { getPlayer, watchLive, type LiveGame, type Player } from '$lib/social';
  import { playMoveSound } from '$lib/sound';
  import type { Key } from '@lichess-org/chessground/types';

  const uid = decodeURIComponent(page.params.uid!);
  let game = $state<LiveGame | undefined>();
  let friend = $state<Player | undefined>();
  let error = $state('');
  /** Local time when the shown state was shared (server times turned into this device's clock). */
  let sharedAt = 0;
  let now = $state(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;

  async function poll() {
    try {
      const r = await watchLive(uid);
      const before = game?.uci.length ?? 0;
      const last = r.game.uci.length;
      // A new move: its sound.
      if (game && last === before + 1) {
        try {
          const pos = positionFromFen(r.game.start);
          for (const u of r.game.uci.slice(0, -1)) pos.play(uciToMove(u)!);
          playMoveSound(pos, uciToMove(r.game.uci[last - 1])!);
        } catch {
          /* no sound */
        }
      }
      game = r.game;
      sharedAt = Date.now() - (r.now - r.updated);
      error = '';
      if (r.game.result) clearInterval(timer);
    } catch (e) {
      error = e instanceof Error ? e.message : 'The game could not be loaded.';
    }
  }

  onMount(() => {
    tick = setInterval(() => (now = Date.now()), 250);
  });
  $effect(() => {
    if ($session.status !== 'in') return;
    void getPlayer(uid).then((r) => (friend = r.player)).catch(() => {});
    void poll();
    timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  });
  onDestroy(() => {
    clearInterval(timer);
    clearInterval(tick);
  });

  const view = $derived.by(() => {
    if (!game) return undefined;
    const pos = positionFromFen(game.start);
    let last: Key[] | undefined;
    for (const u of game.uci) {
      const m = uciToMove(u);
      if (!m || !pos.isLegal(m)) break;
      pos.play(m);
      last = [keyOf(m.from), keyOf(m.to)];
    }
    return { fen: fenOf(pos), turn: pos.turn, check: pos.isCheck(), last };
  });
  /** A clock, running on for the side to move since the friend's last move. */
  const clock = (side: 'white' | 'black') => {
    if (!game?.minutes) return undefined;
    const base = side === 'white' ? game.white : game.black;
    const running = !game.result && view?.turn === side && game.uci.length >= 2;
    return Math.max(0, base - (running ? now - sharedAt : 0));
  };
  const friendName = $derived(friend?.name ?? uid.replace(/^lichess:/, ''));
  function bar(side: 'white' | 'black') {
    const isFriend = game?.human === side;
    return {
      name: isFriend ? friendName : (game?.opponent ?? ''),
      subtitle: side === 'white' ? 'White' : 'Black',
      initials: (isFriend ? friendName : (game?.opponent ?? '?')).slice(0, 2).toUpperCase(),
      rating: isFriend ? (friend?.kfide ? `CC ${friend.kfide}` : undefined) : game?.opponentRating ? `FIDE ${game.opponentRating}` : undefined,
      country: isFriend ? friend?.country || undefined : undefined,
      toMove: !game?.result && view?.turn === side,
      clockMs: clock(side),
    };
  }
  const bottom = $derived(game?.human ?? 'white');
  const top = $derived(bottom === 'white' ? 'black' : 'white');
  const resultText = $derived(
    !game?.result ? '' : game.result === 'aborted' ? 'Game aborted' : game.result === '½-½' ? 'Draw' : (game.result === '1-0') === (game.human === 'white') ? `${friendName} won` : `${friendName} lost`,
  );
</script>

<svelte:head><title>Watching {friendName} · Chess Castles</title></svelte:head>

<div class="live">
  {#if $session.status === 'out'}
    <div class="card"><p>Sign in to watch your friends' games.</p><button class="btn primary" onclick={() => startSignIn()}>Sign in</button></div>
  {:else if error && !game}
    <div class="card msg">
      <p>{error}</p>
      <a class="btn" href="/friends"><Icon name="back" size={16} />Back to friends</a>
    </div>
  {:else if !game || !view}
    <div class="card msg"><p class="label">Connecting to {friendName}'s game…</p></div>
  {:else}
    <div class="board-col">
      <PlayerBar {...bar(top)} />
      <Board fen={view.fen} orientation={bottom} turnColor={view.turn} lastMove={view.last} check={view.check} viewOnly label="{friendName}'s game" />
      <PlayerBar {...bar(bottom)} />
    </div>
    <aside class="side card">
      <span class="tag" class:over={!!game.result}>{game.result ? 'Finished' : '● Live on Chess Castles'}</span>
      <h1 class="title">{friendName} vs {game.opponent}</h1>
      <p class="label">{game.minutes ? `${game.minutes}+${game.increment}` : 'No clock'} · move {Math.ceil(game.uci.length / 2)} · you are watching</p>
      {#if resultText}<p class="result title">{resultText}{game.reason ? ` · ${game.reason}` : ''}</p>{/if}
      <a class="label back" href="/friends"><Icon name="back" size={14} />Back to friends</a>
    </aside>
  {/if}
</div>

<style>
  .live {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    max-width: 1200px;
    margin: 0 auto;
  }
  .board-col {
    flex: 0 1 min(100%, calc(100vh - 230px), 720px);
    min-width: min(100%, 300px);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .side {
    flex: 1 1 280px;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .side h1 {
    margin: 0;
    font-size: 21px;
  }
  .side p,
  .msg p {
    margin: 0;
  }
  .msg {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .tag {
    align-self: flex-start;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--loss) 20%, transparent);
    color: var(--loss);
  }
  .tag.over {
    background: var(--raised);
    color: var(--muted);
  }
  .result {
    font-size: 19px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
</style>

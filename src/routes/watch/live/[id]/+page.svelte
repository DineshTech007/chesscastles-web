<script lang="ts">
  /**
   * Watches a Lichess game live (a friend's game, from their profile or the
   * Friends page): the moves so far come from Lichess's game export and each
   * new one from its live stream, with both clocks; the viewer (WatchViewer)
   * gives the move buttons, the engine and the games database.
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { normalizeMove } from 'chessops/chess';
  import { parseUci } from 'chessops/util';
  import type { NormalMove } from 'chessops/types';
  import LearnFromGame from '$lib/components/LearnFromGame.svelte';
  import WatchViewer, { type BarInfo } from '$lib/components/WatchViewer.svelte';
  import { followGame, type LiveFrame, type LiveGameInfo } from '$lib/lichess';
  import { fenOf, positionFromFen, sanOf } from '$lib/chess/position';
  import { clocksAt, readPgn, type PgnGame } from '$lib/chess/pgn';
  import { playMoveSound } from '$lib/sound';

  const id = page.params.id!;
  const side = page.url.searchParams.get('as') === 'black' ? 'black' : 'white';
  let info = $state<LiveGameInfo | undefined>();
  let frame = $state<LiveFrame | undefined>();
  let at = $state(Date.now());
  let ended = $state(false);
  let tick = $state(Date.now());
  let game = $state<PgnGame | undefined>();
  let error = $state('');

  const boardOf = (fen: string) => fen.split(' ')[0];

  /** The moves so far, from Lichess's export (it works for a game in progress too). */
  let reading = false;
  let lastRead = 0;
  async function readMoves() {
    if (reading || Date.now() - lastRead < 3000) return;
    reading = true;
    lastRead = Date.now();
    try {
      const res = await fetch(`https://lichess.org/game/export/${id}?clocks=true&evals=false`, { headers: { Accept: 'application/x-chess-pgn' } });
      if (!res.ok) throw new Error(String(res.status));
      const [g] = readPgn(await res.text());
      if (g) game = g;
    } catch {
      if (!game) error = 'This game could not be found on Lichess.';
    } finally {
      reading = false;
    }
  }
  void readMoves();

  /** A new position from the stream: its move is added when it follows the moves we have, else they are read again. */
  function onFrame(f: LiveFrame) {
    if (!game) return;
    const last = game.plies.length ? game.plies[game.plies.length - 1].after : game.start;
    if (boardOf(fenOf(last)) === boardOf(f.fen)) return;
    const raw = f.lm ? (parseUci(f.lm) as NormalMove | undefined) : undefined;
    const m = raw ? (normalizeMove(last, raw) as NormalMove) : undefined;
    if (m && last.isLegal(m)) {
      const after = last.clone();
      const san = sanOf(last, m);
      after.play(m);
      if (boardOf(fenOf(after)) === boardOf(f.fen)) {
        game = { ...game, plies: [...game.plies, { move: m, san, after }] };
        return;
      }
    }
    void readMoves();
  }

  const stop = followGame(
    id,
    // The last message may come without the players: keep them.
    (g) => (info = info && g.white.name === 'Anonymous' ? { ...info, status: g.status, winner: g.winner } : g),
    (f) => {
      // A new move: its sound, from the position before it.
      if (frame && f.lm && f.fen !== frame.fen) {
        try {
          const m = parseUci(f.lm) as NormalMove | undefined;
          if (m) playMoveSound(positionFromFen(frame.fen), m);
        } catch {
          /* no sound */
        }
      }
      frame = f;
      at = Date.now();
      onFrame(f);
    },
    () => {
      ended = true;
      void readMoves();
    },
  );
  // The moves read after the stream started: catch up with its latest position.
  $effect(() => {
    if (game && frame) onFrame(frame);
  });
  const timer = setInterval(() => (tick = Date.now()), 250);
  onDestroy(() => {
    stop();
    clearInterval(timer);
  });

  // Lichess sends no status while the game is on, then one when it ends.
  const finished = $derived(ended || (!!info?.status && !['started', 'created'].includes(info.status)));
  /** How a Lichess game ended, in words. */
  const HOW: Record<string, string> = { mate: 'by checkmate', resign: 'by resignation', outoftime: 'on time', timeout: 'as the other left the game', stalemate: 'Draw by stalemate', draw: 'Draw' };
  const resultText = $derived(
    !finished
      ? ''
      : info?.winner
        ? `${info.winner === 'white' ? info.white.name : info.black.name} won${info.status && HOW[info.status] ? ` ${HOW[info.status]}` : ''}`
        : info?.status === 'draw' || info?.status === 'stalemate'
          ? HOW[info.status]
          : 'Game over',
  );
  const outcome = $derived(
    !finished ? undefined : info?.winner === 'white' ? ('1-0' as const) : info?.winner === 'black' ? ('0-1' as const) : info?.status === 'draw' || info?.status === 'stalemate' ? ('½-½' as const) : undefined,
  );

  function barFor(s: 'white' | 'black', ply: number, latest: boolean): BarInfo {
    const p = s === 'white' ? info?.white : info?.black;
    const after = !game ? undefined : ply === 0 ? game.start : game.plies[ply - 1].after;
    let clockMs: number | undefined;
    if (latest && frame) {
      // The clock of the side to move runs down between moves.
      const secs = s === 'white' ? frame.wc : frame.bc;
      const running = !finished && after?.turn === s && after.fullmoves > 1;
      clockMs = secs === undefined ? undefined : Math.max(0, secs * 1000 - (running ? tick - at : 0));
    } else if (game) clockMs = clocksAt(game, ply)[s];
    return {
      name: `${p?.title ? `${p.title} ` : ''}${p?.name ?? '…'}`,
      initials: (p?.name ?? '?').slice(0, 2).toUpperCase(),
      subtitle: s === 'white' ? 'White' : 'Black',
      rating: p?.rating ? String(p.rating) : undefined,
      toMove: latest && !finished && after?.turn === s,
      clockMs,
    };
  }
</script>

<svelte:head><title>{info ? `${info.white.name} – ${info.black.name}` : 'Live game'} · Chess Castles</title></svelte:head>

{#if error}
  <div class="card msg">{error} <a href="/friends">Back to friends</a></div>
{:else if !game}
  <div class="card msg">Connecting to the game…</div>
{:else}
  <WatchViewer
    {game}
    live={!finished}
    {side}
    heading={info ? `${info.white.name} – ${info.black.name}` : 'Live game'}
    subheading={info ? [info.speed && info.speed[0].toUpperCase() + info.speed.slice(1), info.clock, 'on Lichess'].filter(Boolean).join(' · ') : ''}
    result={resultText}
    {outcome}
    backHref="/friends"
    backLabel="Back to friends"
    {barFor}
  />
  <LearnFromGame game={game} />
{/if}

<style>
  .msg {
    max-width: 720px;
    margin: 0 auto;
  }
</style>

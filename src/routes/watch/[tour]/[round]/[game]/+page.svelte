<script lang="ts">
  /**
   * A board of a broadcast tournament (Lichess broadcasts), live or finished:
   * the game is read again every 8 seconds while it is on; the viewer
   * (WatchViewer) does the rest.
   */
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import WatchViewer, { type BarInfo } from '$lib/components/WatchViewer.svelte';
  import { fenOf } from '$lib/chess/position';
  import { clocksAt, readPgn, type PgnGame } from '$lib/chess/pgn';
  import { broadcastGamePgn, roundGames, runningClock, type BroadcastGame } from '$lib/lichess';

  const { tour, round, game: gameId } = page.params as { tour: string; round: string; game: string };
  let pgnText = '';
  let game = $state<PgnGame | undefined>();
  let error = $state('');
  let timer: ReturnType<typeof setInterval> | undefined;
  /** This game as the round lists it: how long the side to move has been thinking. */
  let board = $state<BroadcastGame | undefined>();
  // The clock of the side to move runs on between refreshes, as on Lichess.
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 250);

  async function load() {
    roundGames(round).then(
      (gs) => (board = gs.find((g) => g.id === gameId)),
      () => {},
    );
    try {
      const text = await broadcastGamePgn(round, gameId);
      if (text === pgnText) return;
      pgnText = text;
      const [g] = readPgn(text);
      if (!g) throw new Error();
      game = g;
      if (g.headers.get('Result') !== '*') clearInterval(timer);
    } catch {
      if (!game) error = 'This game could not be loaded. Check your connection and try again.';
    }
  }

  onMount(async () => {
    await load();
    if (game?.headers.get('Result') === '*') timer = setInterval(load, 8000);
  });
  onDestroy(() => {
    clearInterval(timer);
    clearInterval(tick);
  });

  // PGN headers; "?" is an unknown value.
  const h = (k: string) => (game?.headers.get(k) ?? '').replace(/^\?$/, '');
  const live = $derived(h('Result') === '*');

  function barFor(side: 'white' | 'black', ply: number, latest: boolean): BarInfo {
    const name = h(side === 'white' ? 'White' : 'Black');
    const t = h(side === 'white' ? 'WhiteTitle' : 'BlackTitle');
    const title = t === 'BOT' ? '' : t;
    const elo = h(side === 'white' ? 'WhiteElo' : 'BlackElo');
    const clocks = game ? clocksAt(game, ply) : {};
    const after = !game ? undefined : ply === 0 ? game.start : game.plies[ply - 1].after;
    // Run the clock of the side to move when we're showing the position the round has now.
    const running = latest && after?.turn === side && board && after && board.fen.split(' ')[0] === fenOf(after).split(' ')[0];
    return {
      name: `${title ? title + ' ' : ''}${name}`,
      initials: name.split(/[ ,]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?',
      subtitle: [elo, h(side === 'white' ? 'WhiteFed' : 'BlackFed')].filter(Boolean).join(' · ') || (side === 'white' ? 'White' : 'Black'),
      toMove: latest && after?.turn === side,
      clockMs: running ? runningClock(clocks[side], board!, now) : clocks[side],
    };
  }
</script>

<svelte:head><title>{game ? `${h('White')} – ${h('Black')}` : 'Game'} · Watch · Chess Castles</title></svelte:head>

{#if error}
  <div class="card msg">{error} <a href="/watch/{tour}?round={round}">Back to the round</a></div>
{:else if !game}
  <div class="card msg">Loading the game…</div>
{:else}
  <WatchViewer
    {game}
    {live}
    heading="{h('White')} – {h('Black')}"
    subheading={[h('Event').replace(/^Round [^:]+: .*$/, h('BroadcastName')) || h('BroadcastName'), h('Opening')].filter(Boolean).join(' · ')}
    result={h('Result').replace('1/2-1/2', '½-½')}
    outcome={({ '1-0': '1-0', '0-1': '0-1', '1/2-1/2': '½-½' } as const)[h('Result') as '1-0' | '0-1' | '1/2-1/2']}
    backHref="/watch/{tour}?round={round}"
    backLabel="All boards of this round"
    {barFor}
  />
{/if}

<style>
  .msg {
    max-width: 720px;
    margin: 0 auto;
  }
</style>

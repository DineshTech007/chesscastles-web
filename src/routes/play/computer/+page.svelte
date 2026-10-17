<script lang="ts">
  import { track } from '$lib/analytics';
  import { page } from '$app/state';
  import GameView from '$lib/components/GameView.svelte';
  import type { BookSource } from '$lib/book/book';
  import { FideBot } from '$lib/bot/fideBot';
  import { FideGame, TIME_CONTROLS, type Color, type TimeControl } from '$lib/game/fideGame';
  import { engineMove } from '$lib/game/engineMove';
  import { LEVELS } from '$lib/openings';
  import { resumeFor, routeOf } from '$lib/game/resume';

  /** No book: every move is Stockfish at the chosen level. */
  const noBook: BookSource = { entries: async () => [], prefetch: () => {} };
  const q = page.url.searchParams;
  const elo = Number(q.get('l')) || 1600;
  const level = LEVELS.find((l) => l.elo === elo) ?? LEVELS[1];
  const human: Color = q.get('c') === 'black' ? 'black' : 'white';
  const untimed: TimeControl = { minutes: 0, increment: 0, kind: 'Rapid' };
  const timeControl = q.has('tc') ? (TIME_CONTROLS[Number(q.get('tc'))] ?? untimed) : untimed;

  /** Opened to resume a game cut off by a lost connection or a closed browser. */
  const resumed = resumeFor(page.url);
  const route = routeOf(page.url);
  let round = $state(0);
  const newGame = () => {
    track('feature', 'computer_game');
    const g = new FideGame({ bot: new FideBot(noBook, engineMove), rating: elo, human, timeControl });
    if (round === 0 && resumed) g.restore(resumed.snapshot);
    return g;
  };
</script>

<svelte:head><title>Stockfish {level.name} · Chess Castles</title></svelte:head>

{#key round}
  <GameView
    game={newGame()}
    kind="computer"
    opponent="Stockfish {level.name}"
    opponentInitials="SF"
    opponentSubtitle={elo >= 3190 ? 'Full strength' : `About ${elo}`}
    onagain={() => round++}
    gameId={round === 0 ? resumed?.id : undefined}
    resumeRoute={route}
  />
{/key}

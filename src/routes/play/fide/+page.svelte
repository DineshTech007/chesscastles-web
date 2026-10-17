<script lang="ts">
  import { page } from '$app/state';
  import GameView from '$lib/components/GameView.svelte';
  import { CloudBook } from '$lib/book/book';
  import { FideBot } from '$lib/bot/fideBot';
  import { browserOpeningMemory, FideGame, TIME_CONTROLS, type Color } from '$lib/game/fideGame';
  import { bookGuard, humanMove } from '$lib/game/engineMove';
  import { OPENINGS } from '$lib/openings';
  import { resumeFor, routeOf } from '$lib/game/resume';
  import { onMount } from 'svelte';
  import { maia } from '$lib/engine/maia';
  import { useFeature } from '$lib/plans';
  import LimitReached from '$lib/components/LimitReached.svelte';

  const book = new CloudBook();
  const q = page.url.searchParams;
  const rating = Math.min(2800, Math.max(1000, Number(q.get('r')) || 1800));
  const timeControl = TIME_CONTROLS[Number(q.get('tc'))] ?? TIME_CONTROLS[2];
  const me = Number(q.get('me')) || 0;
  const playerRating = me >= 400 && me <= 3000 ? me : undefined;
  const human: Color = q.get('c') === 'black' ? 'black' : 'white';
  const opening = OPENINGS.find((o) => o.id === q.get('o'));

  /** Opened to resume a game cut off by a lost connection or a closed browser. */
  const resumed = resumeFor(page.url);
  const route = routeOf(page.url);
  let round = $state(0);
  /** A new game counts towards the plan's games a day (a resumed one doesn't). */
  let allowed = $state<boolean | undefined>(resumed ? true : undefined);
  onMount(async () => {
    // The human-like engine: loaded from this browser, or downloaded the first time.
    maia.autoLoad(0);
    if (!resumed) allowed = await useFeature('fide_game');
  });
  async function again() {
    if (await useFeature('fide_game')) round++;
  }
  const newGame = () => {
    const g = new FideGame({
      bot: new FideBot(book, humanMove(timeControl), Math.random, bookGuard(timeControl)),
      rating,
      playerRating,
      human,
      timeControl,
      opening: opening?.sans.split(' '),
      memory: browserOpeningMemory,
    });
    if (round === 0 && resumed) g.restore(resumed.snapshot);
    return g;
  };
</script>

<svelte:head><title>FIDE {rating} · Chess Castles</title></svelte:head>

{#if allowed === false}
  <LimitReached feature="fide_game" back="/play" backLabel="Back to Play" />
{:else if allowed}
{#key round}
  <GameView
    game={newGame()}
    kind="fide"
    opponent="FIDE {rating}"
    opponentInitials={String(Math.floor(rating / 100))}
    opponentSubtitle="Plays like {/^(8|11|18)/.test(String(rating)) ? 'an' : 'a'} {rating} player"
    openingName={opening?.name}
    onagain={again}
    gameId={round === 0 ? resumed?.id : undefined}
    resumeRoute={route}
  />
{/key}
{/if}

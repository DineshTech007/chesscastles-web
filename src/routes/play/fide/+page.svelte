<script lang="ts">
  import { page } from '$app/state';
  import GameView from '$lib/components/GameView.svelte';
  import { isAge, isWho, opponentBook, profileLabel } from '$lib/book/profiles';
  import { FideBot } from '$lib/bot/fideBot';
  import { browserOpeningMemory, FideGame, TIME_CONTROLS, type Color } from '$lib/game/fideGame';
  import { get } from 'svelte/store';
  import { opponentPace } from '$lib/preferences';
  import { bookGuard, humanMove } from '$lib/game/engineMove';
  import { OPENINGS } from '$lib/openings';
  import { studyOpening } from '$lib/study/openingStudy';
  import { resumeFor, routeOf } from '$lib/game/resume';
  import { onMount } from 'svelte';
  import { maia } from '$lib/engine/maia';
  import { useFeature } from '$lib/plans';
  import LimitReached from '$lib/components/LimitReached.svelte';
  import MaiaCard from '$lib/components/MaiaCard.svelte';
  import { speedOf } from '$lib/kfide';
  import { tcLabel } from '$lib/game/fideGame';
  import type { BookSource } from '$lib/book/book';

  const q = page.url.searchParams;
  const rating = Math.min(2800, Math.max(1400, Number(q.get('r')) || 1800));
  // Who the opponent plays like (girls, boys, an age group), when chosen.
  const who = isWho(q.get('who')) ? (q.get('who') as 'any' | 'girl' | 'boy') : 'any';
  const age = isAge(q.get('age')) ? (q.get('age') as 'any' | 'u12' | 'u16') : 'any';
  const profile = profileLabel(who, age);
  const timeControl = TIME_CONTROLS[Number(q.get('tc'))] ?? TIME_CONTROLS[2];
  /**
   * Bullet: the human-like engine (Maia) plays every move, at once. Looking
   * each position up in the games database takes too long on a 1-minute clock
   * (and on a phone's connection), so bullet has no database at all.
   */
  const bullet = speedOf(tcLabel(timeControl)) === 'bullet';
  const NO_BOOK: BookSource = { entries: async () => [], prefetch: () => {} };
  const book = bullet ? NO_BOOK : opponentBook(rating, who, age);
  const me = Number(q.get('me')) || 0;
  const playerRating = me >= 400 && me <= 3000 ? me : undefined;
  const human: Color = q.get('c') === 'black' ? 'black' : 'white';
  // A catalogue opening, or a line from the opening study section.
  const studyLine = studyOpening(q.get('o') ?? '');
  // From the opening study's tree: any position of the opening ("moves" in SAN).
  const custom = studyLine && q.get('moves') ? { ...studyLine, sans: q.get('moves')!.trim(), name: `${studyLine.name} (your position)` } : undefined;
  const opening = OPENINGS.find((o) => o.id === q.get('o')) ?? custom ?? studyLine;
  const fromLine = q.get('start') === 'line';

  /** Opened to resume a game cut off by a lost connection or a closed browser. */
  const resumed = resumeFor(page.url);
  const route = routeOf(page.url);
  let round = $state(0);
  /** A new game counts towards the plan's games a day (a resumed one doesn't). */
  let allowed = $state<boolean | undefined>(resumed ? true : undefined);
  onMount(async () => {
    // The human-like engine: loaded from this browser, or downloaded the first time
    // (on a phone too for bullet, where it plays every move).
    if (bullet) maia.ensure();
    else maia.autoLoad(0);
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
      // "Play it" from the opening study: the game starts at the line's position.
      prelude: fromLine && opening ? opening.sans.split(' ') : undefined,
      memory: browserOpeningMemory,
      pace: get(opponentPace),
    });
    if (round === 0 && resumed) g.restore(resumed.snapshot);
    return g;
  };
</script>

<svelte:head><title>FIDE {rating} · Chess Castles</title></svelte:head>

{#if allowed === false}
  <LimitReached feature="fide_game" back="/play" backLabel="Back to Play" />
{:else if allowed}
{#if bullet}<div class="bullet-maia"><MaiaCard quiet /></div>{/if}
{#key round}
  <GameView
    game={newGame()}
    kind="fide"
    opponent={profile ? `FIDE ${rating} · ${profile}` : `FIDE ${rating}`}
    opponentInitials={String(Math.floor(rating / 100))}
    opponentSubtitle="Plays like {/^(8|11|18)/.test(String(rating)) ? 'an' : 'a'} {rating} player"
    openingName={opening?.name}
    onagain={again}
    gameId={round === 0 ? resumed?.id : undefined}
    resumeRoute={route}
  />
{/key}
{/if}

<style>
  /* Only while the human-like engine downloads (the first bullet game): its progress. */
  .bullet-maia:has(:global(.maia)) {
    max-width: 760px;
    margin: 0 auto 10px;
    padding: 10px 14px;
    border-radius: var(--r-card);
    border: 1px solid var(--border);
    background: var(--card);
  }
</style>

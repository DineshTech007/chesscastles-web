<script lang="ts">
  /** Your game this round of a club tournament, against a computer player (the result goes to the server). */
  import { maia } from '$lib/engine/maia';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { get } from 'svelte/store';
  import GameView from '$lib/components/GameView.svelte';
  import { opponentBook } from '$lib/book/profiles';
  import { FideBot } from '$lib/bot/fideBot';
  import { browserOpeningMemory, FideGame, TIME_CONTROLS } from '$lib/game/fideGame';
  import { opponentPace } from '$lib/preferences';
  import { bookGuard, humanMove } from '$lib/game/engineMove';
  import { resumeFor } from '$lib/game/resume';
  import { session } from '$lib/auth';
  import { clubMe, clubMyGame, clubPlayer, getClub, sendClubResult, type Club, type ClubGame, type ClubPlayer } from '$lib/tournament/club';

  const id = page.params.id!;
  let t = $state<Club | undefined>();
  let g = $state<ClubGame | undefined>();
  let opp = $state<ClubPlayer | undefined>();
  let game = $state<FideGame | undefined>();
  let error = $state('');

  let started = false;
  $effect(() => {
    if ($session.status === 'out') void goto(`/play/tournament/club/${id}`, { replaceState: true });
    if ($session.status !== 'in' || started) return;
    started = true;
    const uid = $session.uid;
    getClub(id).then(
      (club) => {
        const me = clubMe(club, uid);
        const mine = me ? clubMyGame(club, me.id) : undefined;
        const other = mine && me ? clubPlayer(club, mine.white === me.id ? mine.black : mine.white) : undefined;
        // Only an unplayed game against a computer is played here.
        if (!me || !mine || !other?.bot || mine.result) return void goto(`/play/tournament/club/${id}`, { replaceState: true });
        const timeControl = TIME_CONTROLS[club.tc] ?? TIME_CONTROLS[2];
        const rating = Math.min(2800, Math.max(1400, other.rating));
        const fg = new FideGame({
          bot: new FideBot(opponentBook(rating), humanMove(timeControl), Math.random, bookGuard(timeControl)),
          rating,
          playerRating: me.rating,
          human: mine.white === me.id ? 'white' : 'black',
          timeControl,
          memory: browserOpeningMemory,
          pace: get(opponentPace),
        });
        const resumed = resumeFor(page.url);
        if (resumed && resumed.id === `${club.id}-r${mine.round}`) fg.restore(resumed.snapshot);
        t = club;
        g = mine;
        opp = other;
        game = fg;
      },
      (e) => (error = e instanceof Error ? e.message : 'This tournament could not be loaded.'),
    );
  });

  /** The result goes to the tournament (the round moves on when everyone has played). */
  function onfinish(result: '1-0' | '0-1' | '1/2-1/2', gameId: string) {
    if (!t || !g) return;
    void sendClubResult(t.id, g.round, result, gameId).catch(() => {
      // Kept for a second try when the connection is back.
      setTimeout(() => void sendClubResult(t!.id, g!.round, result, gameId).catch(() => {}), 5000);
    });
  }
  onMount(() => maia.autoLoad(0));
</script>

<svelte:head><title>Round {g?.round ?? ''} · {t?.name ?? 'Tournament'} · Chess Castles</title></svelte:head>

{#if error}
  <p class="card">{error}</p>
{:else if game && opp && t && g}
  <p class="round label">{t.name} · round {g.round} of {t.rounds}</p>
  <GameView
    {game}
    kind="fide"
    opponent={opp.name}
    opponentInitials={opp.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
    opponentSubtitle="FIDE {opp.rating}"
    opponentCountry={opp.fed}
    {onfinish}
    gameId={`${t.id}-r${g.round}`}
    resumeRoute={`/play/tournament/club/${t.id}/game`}
    againLabel="Back to the tournament"
    onagain={() => goto(`/play/tournament/club/${id}`)}
  />
{/if}

<style>
  .round {
    text-align: center;
    margin: 0 0 6px;
    font-weight: 700;
    color: var(--gold);
  }
</style>

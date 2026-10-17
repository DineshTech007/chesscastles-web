<script lang="ts">
  /** The player's game in the current round of their FIDE tournament. */
  import { goto } from '$app/navigation';
  import GameView from '$lib/components/GameView.svelte';
  import { CloudBook } from '$lib/book/book';
  import { FideBot } from '$lib/bot/fideBot';
  import { browserOpeningMemory, FideGame, TIME_CONTROLS } from '$lib/game/fideGame';
  import { bookGuard, humanMove } from '$lib/game/engineMove';
  import { page } from '$app/state';
  import { resumeFor } from '$lib/game/resume';
  import { awardTrophy, completeRound, finished, loadTournament, ME, myGame, playerById, saveTournament, type Result } from '$lib/tournament/tournament';

  const t = loadTournament();
  const g = t && !finished(t) ? myGame(t) : undefined;
  const opp = t && g ? playerById(t, g.white === ME ? g.black : g.white) : undefined;
  if (!t || !g || !opp) void goto('/play/tournament', { replaceState: true });

  const timeControl = TIME_CONTROLS[t?.tc ?? 2] ?? TIME_CONTROLS[2];
  const me = t?.players.find((p) => p.me);
  const game =
    t && g && opp
      ? new FideGame({
          bot: new FideBot(new CloudBook(), humanMove(timeControl), Math.random, bookGuard(timeControl)),
          rating: Math.min(2800, Math.max(1000, opp.rating)),
          playerRating: me?.rating,
          human: g.white === ME ? 'white' : 'black',
          timeControl,
          memory: browserOpeningMemory,
        })
      : undefined;
  /** Opened to resume this round's game after a lost connection: only if it is still this round's game. */
  const resumed = resumeFor(page.url);
  if (game && resumed && resumed.id === `${t!.id}-r${g!.round}`) game.restore(resumed.snapshot);

  /** The result goes into the tournament, the round's other games are played, and the next round is paired. */
  function onfinish(result: Result, gameId: string) {
    const now = loadTournament();
    if (!now || now.id !== t!.id || now.round !== g!.round) return;
    const next = completeRound(now, { result, gameId });
    saveTournament(next);
    if (finished(next)) awardTrophy(next);
  }
</script>

<svelte:head><title>Round {g?.round ?? ''} · {t?.name ?? 'Tournament'} · Chess Castles</title></svelte:head>

{#if game && opp && t && g}
  <p class="round label">{t.name} · round {g.round} of {t.rounds}</p>
  <GameView
    {game}
    kind="fide"
    opponent={`${opp.title ? `${opp.title} ` : ''}${opp.name}`}
    opponentInitials={opp.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
    opponentSubtitle="FIDE {opp.rating}{opp.title ? ` · ${opp.title}` : ''}"
    opponentCountry={opp.fed}
    {onfinish}
    gameId={`${t.id}-r${g.round}`}
    resumeRoute="/play/tournament/game"
    againLabel="Back to the tournament"
    onagain={() => goto('/play/tournament')}
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

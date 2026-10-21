<script lang="ts">
  /**
   * Watches a friend's game on Chess Castles live, as an audience. The viewer (WatchViewer) gives the move
   * list and the buttons to step through it, the audience's own moves to try ideas, the engine (bar, arrow,
   * score) and the games database, with "Live" to come back to the game as it stands.
   */
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import LearnFromGame from '$lib/components/LearnFromGame.svelte';
  import WatchViewer, { type BarInfo } from '$lib/components/WatchViewer.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { positionFromFen, sanOf, uciToMove } from '$lib/chess/position';
  import type { PgnGame, PgnPly } from '$lib/chess/pgn';
  import { getPlayer, watchLive, type LiveGame, type Player } from '$lib/social';
  import { poll as keepAsking } from '$lib/poll';
  import { playMoveSound } from '$lib/sound';

  const uid = decodeURIComponent(page.params.uid!);
  let game = $state<LiveGame | undefined>();
  let friend = $state<Player | undefined>();
  let error = $state('');
  /** Local time when the shown state was shared (server times turned into this device's clock). */
  let sharedAt = 0;
  let now = $state(Date.now());
  let stopPolling: (() => void) | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;

  let afterEnd = 0;
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
      // Over: a few more looks, since the new rating comes a moment after the last move.
      if (r.game.result && (r.game.myAfter !== undefined || r.game.myRating === undefined || ++afterEnd > 10)) stopPolling?.();
      return true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'The game could not be loaded.';
      return false;
    }
  }

  onMount(() => {
    tick = setInterval(() => (now = Date.now()), 250);
  });
  $effect(() => {
    if ($session.status !== 'in') return;
    void getPlayer(uid).then((r) => (friend = r.player)).catch(() => {});
    // Now, then every 2 seconds while the game is on and the page is in front (slower after failures).
    stopPolling = keepAsking(poll, 2000);
    return () => stopPolling?.();
  });
  onDestroy(() => {
    stopPolling?.();
    clearInterval(tick);
  });

  /** The shared moves as a game the viewer can step through. */
  const pgn = $derived.by<PgnGame | undefined>(() => {
    if (!game) return undefined;
    const start = positionFromFen(game.start);
    const pos = start.clone();
    const plies: PgnPly[] = [];
    for (const u of game.uci) {
      const m = uciToMove(u);
      if (!m || !pos.isLegal(m)) break;
      const san = sanOf(pos, m);
      pos.play(m);
      plies.push({ move: m, san, after: pos.clone() });
    }
    return { headers: new Map(), start, plies };
  });

  const friendName = $derived(friend?.name ?? uid.replace(/^lichess:/, ''));
  /** Initials as the players see them: a FIDE-level opponent shows its rating ("12" for 1200). */
  const initialsOf = (name: string) => {
    const r = /\b(\d{3,4})\b/.exec(name);
    if (r) return String(Math.floor(Number(r[1]) / 100));
    return name.split(/[\s_,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  };
  function barFor(s: 'white' | 'black', ply: number, latest: boolean): BarInfo {
    const isFriend = game?.human === s;
    const opponent = game?.opponent ?? '';
    // The opponent's rating, unless its name already says it ("FIDE 1200").
    const oppRating = game?.opponentRating && !opponent.includes(String(game.opponentRating)) ? `FIDE ${game.opponentRating}` : undefined;
    const after = !pgn ? undefined : ply === 0 ? pgn.start : pgn.plies[ply - 1]?.after;
    let clockMs: number | undefined;
    if (latest && game?.minutes) {
      // The clock of the side to move runs on since the friend's last move.
      const running = !game.result && after?.turn === s && game.uci.length >= 2;
      clockMs = Math.max(0, (s === 'white' ? game.white : game.black) - (running ? now - sharedAt : 0));
    }
    return {
      name: isFriend ? friendName : opponent,
      subtitle: s === 'white' ? 'White' : 'Black',
      initials: initialsOf(isFriend ? friendName : opponent),
      rating: isFriend ? friendRating() : oppRating,
      ratingChange: isFriend && game?.result && game.myAfter !== undefined && game.myRating !== undefined ? game.myAfter - game.myRating : undefined,
      country: isFriend ? friend?.country || undefined : undefined,
      href: isFriend ? `/players/${encodeURIComponent(uid)}` : undefined,
      toMove: latest && !game?.result && after?.turn === s,
      clockMs,
    };
  }
  /** The friend's CC Rating by their name: before the game, and after it with the change once it is over. */
  function friendRating(): string | undefined {
    const g = game;
    if (g?.myRating !== undefined) {
      // Over: the new rating (the change is shown beside it, green or red).
      if (g.result && g.myAfter !== undefined) return `CC ${g.myAfter}`;
      return `CC ${g.myRating}`;
    }
    return friend?.kfide ? `CC ${friend.kfide}` : undefined;
  }
  const resultText = $derived(
    !game?.result ? '' : game.result === 'aborted' ? 'Game aborted' : game.result === '½-½' ? 'Draw' : (game.result === '1-0') === (game.human === 'white') ? `${friendName} won` : `${friendName} lost`,
  );
</script>

<svelte:head><title>Watching {friendName} · Chess Castles</title></svelte:head>

{#if $session.status === 'out'}
  <div class="card msg"><p>Sign in to watch your friends' games.</p><button class="btn primary" onclick={() => startSignIn()}>Sign in</button></div>
{:else if error && !game}
  <div class="card msg">
    <p>{error}</p>
    <a class="btn" href="/friends"><Icon name="back" size={16} />Back to friends</a>
  </div>
{:else if !game || !pgn}
  <div class="card msg"><p class="label">Connecting to {friendName}'s game…</p></div>
{:else}
  <WatchViewer
    game={pgn}
    live={!game.result}
    side={game.human}
    heading="{friendName} vs {game.opponent}"
    subheading="{game.minutes ? `${game.minutes}+${game.increment}` : 'No clock'} · on Chess Castles"
    result={resultText ? `${resultText}${game.reason ? ` · ${game.reason}` : ''}` : ''}
    backHref="/friends"
    backLabel="Back to friends"
    {barFor}
  />
  <LearnFromGame game={pgn} />
{/if}

<style>
  .msg {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .msg p {
    margin: 0;
  }
</style>

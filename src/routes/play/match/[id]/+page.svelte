<script lang="ts">
  /**
   * A friendly game between two Chess Castles players, on our own server (owner, 2026-10-23: bullet never opens Lichess).
   * The inviter waits here for the answer; the invited player lands here from their popup's Accept. The room is a
   * one-game cup (server/api-worker src/cup.ts "match"): it checks every move and clock, nothing changes a rating.
   */
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { session, startSignIn } from '$lib/auth';
  import { devPlayer } from '$lib/classroom/api';
  import { t } from '$lib/i18n';
  import GameBoard from '$lib/classroom/GameBoard.svelte';
  import { CupLive } from '$lib/cups/cup.svelte';
  import { acceptMatch, cancelMatch, isMatchId } from '$lib/cups/api';
  import { forgetMatch, rememberMatch } from '$lib/match';
  import { myGames } from '$lib/stores/myGames';
  import { sentInvite } from '$lib/invites';
  import { TIME_CONTROLS } from '$lib/game/fideGame';

  const id = page.params.id ?? '';
  const valid = isMatchId(id);
  const me = $derived($session.status === 'in' ? $session.uid : (devPlayer() ?? ''));

  let live = $state<CupLive>();
  let busy = $state(false);
  let error = $state('');
  let connectedAs = '';
  $effect(() => {
    if (valid && me && me !== connectedAs) {
      connectedAs = me;
      live?.close();
      // The time control only matters to a computer player (none here).
      live = new CupLive(id, me, TIME_CONTROLS[6]);
    }
  });
  onDestroy(() => live?.close());

  const v = $derived(live?.view);
  const status = $derived(v?.status ?? 'open');
  const game = $derived(v?.games[0]);
  const other = $derived(v?.players.find((p) => p.uid !== me));
  /** The inviter's name comes first in the room; the invited player may accept from here too (a link opened by hand). */
  const invited = $derived(!!v && v.players[1]?.uid === me);
  const tcText = $derived(v?.match ? `${v.match.minutes}+${v.match.inc}` : '');

  // The bar back to this game on other pages (src/lib/match.ts), while it is on.
  $effect(() => {
    if (status === 'running' && game && !game.result && other) rememberMatch({ id, opponent: other.name });
    else if (status !== 'open' && v) forgetMatch(id);
  });
  // A finished game goes into My games (owner, 2026-10-24: "two 1 minute games with my friends are not in my games").
  // The id is the room's, so a reload or the opponent's own browser never saves it twice.
  let savedId = '';
  $effect(() => {
    const g = game;
    if (!g?.result || !g.moves.length || savedId === g.id) return;
    savedId = g.id;
    const side = g.white === me ? 'white' : 'black';
    myGames.save({
      id: `match-${id}-${g.id}`,
      kind: 'friend',
      white: side === 'white' ? 'You' : g.whiteName,
      black: side === 'black' ? 'You' : g.blackName,
      userSide: side,
      result: g.result,
      reason: g.reason,
      timeControl: tcText,
      startFen: g.root,
      uci: g.moves,
    });
  });
  // The invite has an answer: the sheet's waiting note goes.
  $effect(() => {
    if (status !== 'open' && v) sentInvite.update((s) => (s?.id === id ? undefined : s));
  });

  async function accept() {
    busy = true;
    error = '';
    try {
      await acceptMatch(id);
      live?.sync();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function cancel() {
    busy = true;
    try {
      await cancelMatch(id);
      sentInvite.update((s) => (s?.id === id ? undefined : s));
      live?.sync();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{$t('match.title')} · Chess Castles</title></svelte:head>

<div class="page">
  <header class="top">
    <a class="back" href="/play" aria-label={$t('match.back')}>‹</a>
    <div class="ttl">
      <h1>⚔️ {$t('match.title')}{#if tcText} · {tcText}{/if}</h1>
      <span class="sub">{$t('match.friendly')}</span>
    </div>
  </header>

  {#if !valid}
    <p class="note">{$t('match.notFound')}</p>
  {:else if !me}
    <section class="card center">
      <p>{$t('match.signIn')}</p>
      <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
    </section>
  {:else if !v}
    <section class="card center">
      <p class="muted">{live?.gone ? $t('match.notFound') : $t('match.connecting')}</p>
      {#if live?.gone}<a class="btn" href="/play">{$t('match.back')}</a>{/if}
    </section>
  {:else if status === 'open'}
    <section class="card center">
      {#if invited}
        <p class="big">{$t('match.invited', { name: v.players[0]?.name ?? '', tc: tcText })}</p>
        <button class="btn primary lg" onclick={accept} disabled={busy}>{$t('match.accept')}</button>
      {:else}
        <span class="spinner" aria-hidden="true"></span>
        <p class="big">{$t('match.waiting', { name: other?.name ?? '' })}</p>
        <p class="muted small">{$t('match.waitingNote')}</p>
      {/if}
      <button class="btn ghost" onclick={cancel} disabled={busy}>{$t('match.cancel')}</button>
    </section>
  {:else if status === 'cancelled'}
    <section class="card center">
      <p class="big">{$t('match.calledOff')}</p>
      <a class="btn primary" href="/play">{$t('match.back')}</a>
    </section>
  {:else if game && live}
    <section class="board">
      {#key game.id}
        <GameBoard {live} {game} />
      {/key}
      {#if game.result}<a class="btn" href="/play">{$t('match.back')}</a>{/if}
    </section>
  {/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 12px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .back {
    font-size: 28px;
    text-decoration: none;
    color: var(--muted);
    padding: 0 6px;
  }
  .ttl {
    flex: 1;
    min-width: 0;
  }
  h1 {
    margin: 0;
    font: 800 22px var(--font-title);
  }
  .sub {
    color: var(--muted);
    font-size: 13px;
  }
  .card {
    padding: 18px 16px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
  }
  .big {
    font: 800 20px var(--font-title);
    margin: 0;
  }
  .muted,
  .note {
    color: var(--muted);
    margin: 0;
  }
  .small {
    font-size: 13px;
  }
  .lg {
    font-size: 18px;
    padding: 12px 28px;
  }
  .board {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
  .err {
    color: var(--loss, #ef4444);
    margin: 0;
  }
  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid var(--border);
    border-top-color: var(--gold);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

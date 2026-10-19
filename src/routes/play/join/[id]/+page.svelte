<script lang="ts">
  /**
   * Joining a friend's game from the link in their message (a Lichess open
   * challenge only the two of you can join; see openChallenge): the game
   * starts as soon as both have joined, then this page opens it.
   */
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { lichessToken, session, startLichessSignIn, startSignIn } from '$lib/auth';
  import * as api from '$lib/lichessBoard';

  const id = page.params.id!;
  const color = page.url.searchParams.get('c') === 'black' ? 'black' : 'white';
  let stage = $state<'joining' | 'waiting' | 'ended' | 'error'>('joining');
  let error = $state('');
  let events: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function join(t: string) {
    // The game starts on Lichess's event stream (it may already have started).
    events = new AbortController();
    api
      .streamEvents(
        t,
        (e) => {
          if (e.type === 'gameStart' && e.game?.gameId === id) goto(`/play/online/${id}?c=${e.game.color ?? color}`, { replaceState: true });
        },
        events.signal,
      )
      .catch(() => {});
    try {
      await api.acceptChallenge(t, id);
      stage = 'waiting';
      // Your friend left before you joined, most likely.
      timer = setTimeout(() => (stage = stage === 'waiting' ? 'ended' : stage), 60_000);
    } catch (e) {
      stage = e instanceof api.LichessError && /not found|canceled|cancelled/i.test(e.message) ? 'ended' : 'error';
      error = e instanceof Error ? e.message : '';
    }
  }

  onMount(() => {
    const t = lichessToken()?.token;
    if (t) void join(t);
  });
  onDestroy(() => {
    events?.abort();
    clearTimeout(timer);
  });
</script>

<svelte:head><title>Join a game · Chess Castles</title></svelte:head>

<div class="card box">
  <Icon name="knight" size={34} color="var(--accent)" />
  {#if !lichessToken()}
    <h1 class="title">Join your friend's game</h1>
    <p class="label">Online games use your free Lichess account. Connect it once, then open the link again.</p>
    {#if $session.status === 'in'}
      <button class="btn primary" onclick={() => startLichessSignIn()}>Connect Lichess</button>
    {:else}
      <button class="btn primary" onclick={() => startSignIn()}>Sign in</button>
    {/if}
  {:else if stage === 'joining'}
    <h1 class="title">Joining the game…</h1>
  {:else if stage === 'waiting'}
    <h1 class="title">You're in!</h1>
    <p class="label">The game starts as soon as your friend is there too.</p>
  {:else if stage === 'ended'}
    <h1 class="title">This challenge has ended</h1>
    <p class="label">Your friend may have cancelled it or left. Send them a challenge from their page.</p>
    <a class="btn" href="/friends">Friends</a>
  {:else}
    <h1 class="title">The game could not start</h1>
    <p class="label">{error || 'Try again in a moment.'}</p>
    <a class="btn" href="/friends">Friends</a>
  {/if}
</div>

<style>
  .box {
    max-width: 460px;
    margin: 40px auto;
    padding: 28px 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 22px;
  }
  p {
    margin: 0;
  }
</style>

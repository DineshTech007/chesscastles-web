<script lang="ts">
  /**
   * Sign in with a Lichess personal access token, pasted here or given in the
   * address (#token=lip_…; the hash never reaches a server). For testing
   * accounts run by an automated browser, which Lichess's human check at its
   * sign-in form stops. It does what the normal sign-in does once Lichess
   * approves, and gives exactly what the token already gives.
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { signInWithLichessToken } from '$lib/auth';

  let token = $state('');
  let busy = $state(false);
  let error = $state('');

  async function go() {
    const t = token.trim();
    if (!t) return;
    busy = true;
    error = '';
    try {
      await signInWithLichessToken(t);
      await goto('/', { replaceState: true });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Sign-in failed. Check the token.';
      busy = false;
    }
  }
  onMount(() => {
    const m = /[#&]token=([^&]+)/.exec(location.hash);
    if (m) {
      token = decodeURIComponent(m[1]);
      history.replaceState(null, '', location.pathname);
      void go();
    }
  });
</script>

<svelte:head><title>Sign in with a token · Chess Castles</title></svelte:head>

<div class="card box">
  <h1 class="title">Sign in with a Lichess token</h1>
  <p class="label">For testing accounts: a personal access token from lichess.org (Preferences → API access tokens) with the board:play, challenge:read, challenge:write and preference:read permissions.</p>
  <form onsubmit={(e) => (e.preventDefault(), go())}>
    <input type="password" bind:value={token} placeholder="lip_…" aria-label="Lichess access token" autocomplete="off" disabled={busy} />
    <button class="btn primary" type="submit" disabled={busy || !token.trim()}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <a href="/">Back to Chess Castles</a>
</div>

<style>
  .box {
    max-width: 440px;
    margin: 60px auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
    align-items: center;
  }
  form {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  input {
    flex: 1;
    min-height: 44px;
  }
  .error {
    margin: 0;
    color: var(--bad, #ef4444);
  }
</style>

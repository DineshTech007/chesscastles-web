<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { finishSignIn } from '$lib/auth';

  let error = $state('');
  onMount(async () => {
    try {
      const next = await finishSignIn(page.url.searchParams);
      await goto(next, { replaceState: true });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Sign-in failed. Please try again.';
    }
  });
</script>

<svelte:head><title>Signing in · Chess Castles</title></svelte:head>

<div class="card box">
  {#if error}
    <h1 class="title">Couldn't sign you in</h1>
    <p>{error}</p>
    <a class="btn primary" href="/">Back to Chess Castles</a>
  {:else}
    <h1 class="title">Signing you in…</h1>
    <p class="label">Connecting your Lichess account to Chess Castles.</p>
  {/if}
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
  .title {
    font-size: 24px;
  }
  p {
    margin: 0;
  }
</style>

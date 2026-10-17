<script lang="ts">
  /** Maia-3's state, with a one-time download button: shown where a human-like engine plays. */
  import { onMount } from 'svelte';
  import { maia, maiaProgress, maiaStatus } from '$lib/engine/maia';

  let {
    ready = 'Maia-3 learned from millions of human games, so it plays like a real person, including human-style mistakes.',
    fallback = 'Stockfish',
    quiet = false,
  }: {
    ready?: string;
    fallback?: string;
    /** Says nothing about the engine: only the one-time download, when it needs the player. */
    quiet?: boolean;
  } = $props();

  onMount(() => maia.autoLoad(0));
</script>

{#if quiet}
  {#if $maiaStatus === 'downloading'}
    <div class="maia"><div class="dl"><span style="width: {$maiaProgress}%"></span></div><p class="label">Preparing your opponent… {$maiaProgress}%</p></div>
  {:else if $maiaStatus === 'no-cache'}
    <div class="maia">
      <p class="label">Download your opponent’s full playing style (58 MB).</p>
      <button class="btn primary" onclick={() => maia.download()}>Download (58 MB)</button>
    </div>
  {/if}
{:else}
<div class="maia">
  {#if $maiaStatus === 'ready'}
    <p class="label"><span class="ok">●</span> {ready}</p>
  {:else if $maiaStatus === 'downloading'}
    <div class="dl"><span style="width: {$maiaProgress}%"></span></div>
    <p class="label">Getting the human-like engine ready… {$maiaProgress}% (only the first time).</p>
  {:else if $maiaStatus === 'error'}
    <p class="label">Maia-3 could not start in this browser, so {fallback} plays instead.</p>
  {:else if $maiaStatus === 'no-cache'}
    <p class="label">Your connection is in data-saver mode, so Maia-3 (about 58 MB) was not downloaded. Until it is, {fallback} plays.</p>
    <button class="btn primary" onclick={() => maia.download()}>Download Maia-3 (58 MB)</button>
  {:else}
    <p class="label">Loading Maia-3…</p>
  {/if}
</div>
{/if}

<style>
  .maia {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .maia p {
    margin: 0;
  }
  .ok {
    color: var(--win);
  }
  .dl {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: var(--border);
    overflow: hidden;
  }
  .dl span {
    display: block;
    height: 100%;
    background: var(--brand);
    transition: width 0.3s;
  }
</style>

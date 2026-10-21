<script lang="ts">
  /** The class chat. A student's message goes to the coach only (unless the coach lets the class see them all). */
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Live } from './live.svelte';

  let { live }: { live: Live } = $props();
  let text = $state('');
  let box: HTMLDivElement;

  onMount(() => {
    live.chatOpen = true;
    live.unread = 0;
  });
  onDestroy(() => (live.chatOpen = false));
  $effect(() => {
    void live.chat.length;
    live.unread = 0;
    void tick().then(() => box?.scrollTo({ top: box.scrollHeight }));
  });
  function send(e: Event) {
    e.preventDefault();
    live.sendChat(text);
    text = '';
  }
  const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
</script>

<div class="chat">
  <div class="msgs" bind:this={box}>
    {#each live.chat as c (c.id)}
      <div class="msg" class:mine={c.uid === live.me.uid} class:coach={c.uid === live.info.coach}>
        <span class="who">{c.uid === live.me.uid ? 'You' : c.name}{c.coachOnly && live.coach ? ' · to you' : ''} <small>{time(c.at)}</small></span>
        <span class="text">{c.text}</span>
      </div>
    {:else}
      <p class="muted">{live.coach ? 'Students’ answers and questions show here.' : 'Ask your coach a question or type your answer.'}</p>
    {/each}
  </div>
  <form onsubmit={send}>
    <input bind:value={text} maxlength="300" placeholder={live.coach ? 'Message the class' : live.settings.chat ? 'Message the class' : 'Message your coach'} aria-label="Message" />
    <button class="btn primary" disabled={!text.trim()}>Send</button>
  </form>
  {#if !live.coach && !live.settings.chat}<p class="muted small">Only your coach sees your messages.</p>{/if}
</div>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    height: 100%;
  }
  .msgs {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 120px;
    max-height: 46vh;
  }
  .msg {
    display: flex;
    flex-direction: column;
    background: var(--raised);
    border-radius: 10px;
    padding: 6px 9px;
    align-self: flex-start;
    max-width: 92%;
  }
  .msg.mine {
    align-self: flex-end;
    background: color-mix(in srgb, var(--live) 18%, var(--raised));
  }
  .msg.coach .who {
    color: var(--gold);
  }
  .who {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
  .who small {
    font-weight: 400;
  }
  .text {
    white-space: pre-wrap;
    word-break: break-word;
  }
  form {
    display: flex;
    gap: 6px;
  }
  input {
    flex: 1;
    min-width: 0;
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    font: 500 15px var(--font-body);
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
</style>

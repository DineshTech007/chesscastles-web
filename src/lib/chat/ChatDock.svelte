<script lang="ts">
  /**
   * The chat (Puzzle Racer, Puzzle Battle, games): not a plain list of messages but a little comic strip, with big
   * emoji buttons, ready phrases and a box for something nice to say. Castle Guard 🛡️ watches (src/lib/chat/chat.ts):
   * its warnings slide in as a knight's card, and a paused chat still lets emojis through. Each child can hide a
   * player's messages (tap the name) or turn chat off, without blocking anyone.
   */
  import { tick } from 'svelte';
  import { EMOJIS, MAX_TEXT, PHRASES, chatOff, colourOf, hiddenChat, setChatOff, toggleHidden, type ChatLine, type Guard } from './chat';
  import { t, type Key } from '$lib/i18n';

  let {
    lines,
    me,
    guard,
    onsend,
    note = '',
  }: {
    lines: ChatLine[];
    me: string;
    guard?: Guard;
    onsend: (kind: ChatLine['kind'], text: string | number) => void;
    /** A line under the title (e.g. "Waiting for your opponent to open the chat"). */
    note?: string;
  } = $props();

  let text = $state('');
  let box = $state<HTMLDivElement>();
  let menu = $state<string | undefined>();
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });
  const shown = $derived(lines.filter((l) => l.uid === me || !$hiddenChat.has(l.uid)).slice(-30));
  const paused = $derived(!!guard && guard.until > now);
  const guardShown = $derived(!!guard && (paused || now - guard.at < 9000));
  /** Sending too fast: the room takes one a second. */
  let lastSent = 0;
  function send(kind: ChatLine['kind'], v: string | number) {
    const t = Date.now();
    if (t - lastSent < 1000) return;
    lastSent = t;
    onsend(kind, v);
  }
  function sendText(e: Event) {
    e.preventDefault();
    const v = text.trim();
    if (!v || paused) return;
    send('text', v.slice(0, MAX_TEXT));
    text = '';
  }
  // New messages: the strip scrolls to the newest.
  $effect(() => {
    void shown.length;
    void tick().then(() => box?.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }));
  });
  const initial = (n: string) => (n.trim()[0] ?? '?').toUpperCase();
  /** A ready phrase in my language (the server sends the English text). */
  function phraseText(text: string): string {
    const i = (PHRASES as readonly string[]).indexOf(text);
    return i < 0 ? text : $t(`kidsclass.phrase.${i}` as Key);
  }
  /** Castle Guard's warning in my language, when the server says which one. */
  const guardText = $derived(guard?.code ? $t(`kidsclass.guard.${guard.code}` as Key, { m: guard.minutes ?? '' }) : (guard?.text ?? ''));
</script>

{#if $chatOff}
  <button class="off-pill" onclick={() => setChatOff(false)}>{$t('kidsclass.chat.off')}</button>
{:else}
  <section class="dock" aria-label="Chat">
    <header class="top">
      <span class="ttl">💬 Chat</span>
      <span class="guardian" title={$t('kidsclass.chat.guardTitle')}>{$t('kidsclass.chat.watching')}</span>
      <button class="mini" onclick={() => setChatOff(true)} title={$t('kidsclass.chat.offTitle')}>🔕</button>
    </header>
    {#if note}<p class="note">{note}</p>{/if}

    <div class="strip" bind:this={box}>
      {#each shown as l (l.id)}
        {@const mine = l.uid === me}
        <div class="msg" class:mine class:big={l.kind === 'emoji'}>
          {#if !mine}
            <button class="who" style="--c: {colourOf(l.uid)}" onclick={() => (menu = menu === l.uid ? undefined : l.uid)} title={$t('kidsclass.chat.tapHide', { name: l.name })}>{initial(l.name)}</button>
          {/if}
          <div class="bubble" class:emoji={l.kind === 'emoji'} class:phrase={l.kind === 'phrase'}>
            {#if !mine && l.kind !== 'emoji'}<span class="nm" style="color: {colourOf(l.uid)}">{l.name}</span>{/if}
            <span class="tx">{l.kind === 'phrase' ? phraseText(l.text) : l.text}</span>
          </div>
        </div>
        {#if menu === l.uid && !mine}
          <div class="menu">
            <button class="btn ghost small" onclick={() => (toggleHidden(l.uid), (menu = undefined))}>{$t('kidsclass.chat.hide', { name: l.name })}</button>
            <span class="muted small">{$t('kidsclass.chat.stillPlay')}</span>
          </div>
        {/if}
      {:else}
        <p class="empty">{$t('kidsclass.chat.empty')}</p>
      {/each}
    </div>

    {#if guardShown && guard}
      <div class="guard" class:paused role="alert">
        <span class="knight" aria-hidden="true">🛡️</span>
        <span><b>Castle Guard:</b> {guardText}</span>
      </div>
    {/if}

    <div class="emojis" role="group" aria-label={$t('kidsclass.chat.sendEmoji')}>
      {#each EMOJIS as e (e)}<button class="emo" onclick={() => send('emoji', e)} aria-label={$t('kidsclass.chat.sendThis', { e })}>{e}</button>{/each}
    </div>
    <div class="phrases" role="group" aria-label={$t('kidsclass.chat.sendPhrase')}>
      {#each PHRASES as p, i (p)}<button class="chip" onclick={() => send('phrase', i)}>{$t(`kidsclass.phrase.${i}` as Key)}</button>{/each}
    </div>
    <form class="say" onsubmit={sendText}>
      <input bind:value={text} maxlength={MAX_TEXT} placeholder={paused ? $t('kidsclass.chat.pausedPlaceholder') : $t('kidsclass.chat.placeholder')} disabled={paused} aria-label="Message" />
      <button class="go" disabled={paused || !text.trim()} aria-label={$t('kidsclass.chat.send')}>🚀</button>
    </form>
    {#if $hiddenChat.size}<button class="link" onclick={() => [...$hiddenChat].forEach((u) => toggleHidden(u))}>{$t('kidsclass.chat.showHidden', { n: $hiddenChat.size })}</button>{/if}
  </section>
{/if}

<style>
  .dock {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 16px;
    background:
      radial-gradient(90% 60% at 100% 0%, color-mix(in srgb, #38bdf8 12%, transparent), transparent 70%),
      var(--card);
    border: 1px solid var(--border);
    position: relative;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ttl {
    font: 800 16px var(--font-title);
  }
  .guardian {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--win);
    background: color-mix(in srgb, var(--win) 12%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .mini {
    margin-left: auto;
    border: 0;
    background: transparent;
    font-size: 16px;
    cursor: pointer;
  }
  .note {
    margin: 0;
    font-size: 12.5px;
    color: var(--muted);
  }
  .strip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 190px;
    min-height: 70px;
    overflow-y: auto;
    padding: 4px 2px;
    scrollbar-width: thin;
  }
  .empty {
    margin: auto;
    color: var(--muted);
    font-size: 14px;
  }
  .msg {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    animation: pop 0.25s ease-out;
  }
  .msg.mine {
    justify-content: flex-end;
  }
  @keyframes pop {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
  }
  .who {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 0;
    background: var(--c);
    color: #fff;
    font: 800 12px var(--font-body);
    cursor: pointer;
  }
  .bubble {
    position: relative;
    max-width: 78%;
    padding: 6px 10px;
    border-radius: 14px 14px 14px 4px;
    background: var(--raised);
    display: flex;
    flex-direction: column;
    font-size: 14px;
    line-height: 1.25;
    word-break: break-word;
  }
  .mine .bubble {
    border-radius: 14px 14px 4px 14px;
    background: linear-gradient(135deg, #f7d27a, #edb040);
    color: #1b1300;
  }
  .bubble.phrase {
    font-weight: 700;
  }
  .bubble.emoji {
    background: transparent;
    padding: 0 4px;
  }
  .bubble.emoji .tx {
    font-size: 32px;
    animation: wiggle 0.6s ease-in-out;
  }
  @keyframes wiggle {
    30% {
      transform: rotate(-12deg) scale(1.2);
    }
    60% {
      transform: rotate(10deg);
    }
  }
  .nm {
    font: 800 11px var(--font-body);
  }
  .menu {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 32px;
    flex-wrap: wrap;
  }
  .guard {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 8px 10px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--gold) 16%, var(--raised));
    border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
    font-size: 13.5px;
    animation: slide 0.35s ease-out;
  }
  .guard.paused {
    background: color-mix(in srgb, var(--loss) 14%, var(--raised));
    border-color: color-mix(in srgb, var(--loss) 55%, transparent);
  }
  .knight {
    font-size: 22px;
  }
  @keyframes slide {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
  }
  .emojis {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }
  .emo {
    aspect-ratio: 1.3;
    border: 0;
    border-radius: 12px;
    background: var(--raised);
    font-size: 22px;
    cursor: pointer;
    transition: transform 0.12s;
  }
  .emo:hover {
    transform: scale(1.15) rotate(-6deg);
  }
  .emo:active {
    transform: scale(0.9);
  }
  .phrases {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .phrases::-webkit-scrollbar {
    display: none;
  }
  .phrases .chip {
    flex: none;
    white-space: nowrap;
  }
  .say {
    display: flex;
    gap: 6px;
  }
  .say input {
    flex: 1;
    min-width: 0;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    padding: 9px 14px;
    font: 600 14px var(--font-body);
  }
  .go {
    width: 42px;
    border-radius: 50%;
    border: 0;
    background: linear-gradient(135deg, #38bdf8, #6366f1);
    font-size: 18px;
    cursor: pointer;
  }
  .go:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .off-pill {
    align-self: flex-start;
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--muted);
    border-radius: 999px;
    padding: 6px 12px;
    font: 700 13px var(--font-body);
    cursor: pointer;
  }
  .link {
    align-self: flex-start;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12px;
  }
  @media (prefers-reduced-motion: reduce) {
    .msg,
    .bubble.emoji .tx,
    .guard {
      animation: none;
    }
  }
</style>

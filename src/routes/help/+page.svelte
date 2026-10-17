<script lang="ts">
  /**
   * Help & support: Chess Castles' helper answers how-to questions from the
   * guide (it never invents answers), and players can write to the team.
   */
  import { tick } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import GuruAvatar from '$lib/coach/GuruAvatar.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { contactSupport } from '$lib/social';
  import { findAnswers, KB, type HelpAnswer } from '$lib/help/kb';

  type Msg = { from: 'me' | 'bot'; text: string; answers?: HelpAnswer[]; none?: boolean };
  let msgs = $state<Msg[]>([{ from: 'bot', text: 'Hi! I am the Chess Castles helper. Ask me how to do anything on Chess Castles, or tap a question below.' }]);
  let q = $state('');
  let box: HTMLDivElement | undefined = $state();
  const POPULAR = ['kfide', 'resume', 'import', 'tournament', 'friends', 'watch-friend', 'books', 'report'].map((id) => KB.find((k) => k.id === id)!);

  async function ask(text: string) {
    const t = text.trim();
    if (!t) return;
    q = '';
    const found = findAnswers(t);
    msgs = [
      ...msgs,
      { from: 'me', text: t },
      found.length
        ? { from: 'bot', text: found[0].a, answers: found }
        : { from: 'bot', text: "I don't know that one yet. Try other words, pick a question below, or send a message to our team.", none: true },
    ];
    await tick();
    box?.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }
  function pick(k: HelpAnswer) {
    void ask(k.q);
  }

  // ---------- writing to the team ----------
  let reason = $state<'help' | 'bug' | 'idea' | 'account' | 'refund'>('help');
  let details = $state('');
  let sending = $state(false);
  let sent = $state('');
  async function send(e: Event) {
    e.preventDefault();
    sending = true;
    sent = '';
    try {
      await contactSupport(reason, details.trim());
      sent = 'Thank you! Your message reached the Chess Castles team.';
      details = '';
    } catch (err) {
      sent = err instanceof Error ? err.message : 'The message could not be sent. Try again.';
    } finally {
      sending = false;
    }
  }
</script>

<svelte:head><title>Help & support · Chess Castles</title></svelte:head>

<div class="page">
  <header>
    <h1 class="display">Help &amp; support</h1>
    <p class="label">Ask the helper, or write to the Chess Castles team.</p>
  </header>

  <section class="card chat" aria-label="Chess Castles helper">
    <div class="msgs" bind:this={box} aria-live="polite">
      {#each msgs as m, i (i)}
        <div class="msg {m.from}">
          {#if m.from === 'bot'}<span class="av"><GuruAvatar size={34} /></span>{/if}
          <div class="bubble">
            <p>{m.text}</p>
            {#if m.answers?.[0].link}<a class="btn small" href={m.answers[0].link.href}>{m.answers[0].link.label} →</a>{/if}
            {#if m.answers && m.answers.length > 1}
              <div class="more"><span class="label">Related:</span>{#each m.answers.slice(1) as k (k.id)}<button class="chip" onclick={() => pick(k)}>{k.q}</button>{/each}</div>
            {/if}
            {#if m.none}<a class="btn small" href="#contact">Write to the team ↓</a>{/if}
          </div>
        </div>
      {/each}
    </div>
    <div class="popular">
      {#each POPULAR as k (k.id)}<button class="chip" onclick={() => pick(k)}>{k.q}</button>{/each}
    </div>
    <form class="ask" onsubmit={(e) => (e.preventDefault(), ask(q))}>
      <input bind:value={q} placeholder="Ask a question, e.g. “How do I import a game?”" aria-label="Your question" maxlength="200" />
      <button class="btn primary" type="submit" disabled={!q.trim()}><Icon name="send" size={16} />Ask</button>
    </form>
  </section>

  <section class="card" id="contact">
    <h2 class="title">Write to the team</h2>
    {#if $session.status !== 'in'}
      <p>Sign in to send a message, so we can answer you.</p>
      <button class="btn primary" onclick={() => startSignIn()}>Sign in with Lichess</button>
    {:else}
      <form class="contact" onsubmit={send}>
        <label class="field">
          <span class="label">About</span>
          <select bind:value={reason}>
            <option value="help">I need help</option>
            <option value="bug">Something is not working</option>
            <option value="idea">An idea for Chess Castles</option>
            <option value="account">My account or data (including deleting it)</option>
            <option value="refund">A payment or refund</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Message</span>
          <textarea bind:value={details} rows="4" maxlength="2000" placeholder="Tell us what happened, and on which page."></textarea>
        </label>
        <div class="row">
          <button class="btn primary" type="submit" disabled={sending || details.trim().length < 5}>{sending ? 'Sending…' : 'Send'}</button>
          {#if sent}<span class="label" role="status">{sent}</span>{/if}
        </div>
      </form>
    {/if}
  </section>

  <section class="card links">
    <a href="/legal/terms">Terms of use</a>
    <a href="/legal/privacy">Privacy policy</a>
    <a href="/legal/refunds">Refund policy</a>
    <a href="/feedback">Send feedback</a>
    <a href="/legal/fair-play">Fair play policy</a>
    <a href="/about">About and licences</a>
  </section>
</div>

<style>
  .page {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    margin: 0;
    font-size: 38px;
  }
  header p {
    margin: 4px 0 0;
  }
  .chat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
    overflow: hidden;
  }
  .msgs {
    max-height: 440px;
    min-height: 220px;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .msg {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .msg.me {
    justify-content: flex-end;
  }
  .av {
    flex: none;
  }
  .bubble {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--raised);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .me .bubble {
    background: var(--action);
    color: var(--on-action);
    border-bottom-right-radius: 4px;
  }
  .bot .bubble {
    border-bottom-left-radius: 4px;
  }
  .bubble p {
    margin: 0;
    line-height: 1.5;
  }
  .more {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .popular {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding: 0 16px;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    border-radius: 999px;
    padding: 5px 11px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .chip:hover {
    border-color: var(--accent);
  }
  .ask {
    display: flex;
    gap: 8px;
    padding: 12px 16px 16px;
    border-top: 1px solid var(--border);
  }
  .ask input,
  .field select,
  .field textarea {
    flex: 1;
    min-width: 0;
    font: inherit;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .ask .btn {
    gap: 6px;
  }
  .small {
    min-height: 32px;
    padding: 0 12px;
    font-size: 13.5px;
  }
  #contact h2 {
    margin: 0 0 10px;
    font-size: 19px;
  }
  .contact {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .links {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
</style>

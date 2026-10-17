<script lang="ts">
  /** Feedback: a rating, what kind, which part of Chess Castles, and a few words. Read on the admin page. */
  import Icon from '$lib/components/Icon.svelte';
  import { API } from '$lib/api';
  import { auth, session } from '$lib/auth';
  import { track } from '$lib/analytics';

  const KINDS = [
    { id: 'idea', icon: '💡', label: 'An idea' },
    { id: 'bug', icon: '🐞', label: 'Something’s broken' },
    { id: 'love', icon: '❤️', label: 'Something I love' },
    { id: 'other', icon: '💬', label: 'Something else' },
  ] as const;
  const AREAS = [
    ['', 'The whole site'],
    ['play', 'Playing FIDE-rated opponents'],
    ['online', 'Online play'],
    ['puzzles', 'Puzzles'],
    ['learn', 'Learn and the opening trainer'],
    ['coach', 'Chess Guru'],
    ['analysis', 'Analysis and the database'],
    ['insights', 'Game Insights'],
    ['vision', 'Vision Gym'],
    ['books', 'Books'],
    ['plans', 'Plans'],
    ['other', 'Something else'],
  ] as const;
  const FACES = ['😞', '🙁', '😐', '🙂', '😍'];

  let rating = $state(0);
  let kind = $state<string>('idea');
  let area = $state<string>('');
  let message = $state('');
  let contact = $state(true);
  let trap = $state('');
  let busy = $state(false);
  let sent = $state(false);
  let error = $state('');

  async function send(e: Event) {
    e.preventDefault();
    error = '';
    if (!rating && message.trim().length < 3) return void (error = 'Pick a face or write a few words.');
    busy = true;
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => undefined);
      const res = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating, kind, area, message, contact, website: trap }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Not sent. Try again in a minute.');
      track('feature', 'feedback');
      sent = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Not sent. Try again in a minute.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Feedback · Chess Castles</title></svelte:head>

<div class="page">
  {#if sent}
    <section class="card done">
      <span class="big" aria-hidden="true">🙏</span>
      <h1 class="display">Thank you!</h1>
      <p>We read every message. Your feedback helps decide what Chess Castles builds next.</p>
      <div class="btns">
        <a class="btn primary" href="/">Home</a>
        <button class="btn" onclick={() => ((sent = false), (message = ''), (rating = 0))}>Send more</button>
      </div>
    </section>
  {:else}
    <header>
      <h1 class="display">Help us make Chess Castles better</h1>
      <p class="label">Tell us what you love, what is missing, or what doesn’t work. Every message is read.</p>
    </header>

    <form class="card form" onsubmit={send}>
      <fieldset>
        <legend class="title">How do you like Chess Castles?</legend>
        <div class="faces" role="radiogroup" aria-label="Your rating">
          {#each FACES as f, i (i)}
            <button type="button" role="radio" aria-checked={rating === i + 1} aria-label="{i + 1} of 5" class:on={rating === i + 1} onclick={() => (rating = i + 1)}>{f}</button>
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend class="title">What is it about?</legend>
        <div class="kinds">
          {#each KINDS as k (k.id)}
            <button type="button" class="kind" aria-pressed={kind === k.id} onclick={() => (kind = k.id)}><span aria-hidden="true">{k.icon}</span>{k.label}</button>
          {/each}
        </div>
      </fieldset>

      <label class="field">
        <span class="title">Which part of Chess Castles?</span>
        <select bind:value={area}>{#each AREAS as [id, label] (id)}<option value={id}>{label}</option>{/each}</select>
      </label>

      <label class="field">
        <span class="title">Your message</span>
        <textarea bind:value={message} rows="6" maxlength="2000" placeholder={kind === 'bug' ? 'What did you do, and what happened? On a phone or a computer?' : 'Tell us in a few words…'}></textarea>
        <span class="label count">{message.length} / 2000</span>
      </label>

      <!-- Left empty by people; bots fill it in. -->
      <input class="trap" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={trap} name="website" />

      {#if $session.status === 'in'}
        <label class="check"><input type="checkbox" bind:checked={contact} />You may contact me about this</label>
      {:else}
        <p class="label">You are not signed in, so this is anonymous. Sign in if you’d like us to be able to reply.</p>
      {/if}

      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="btn primary big" disabled={busy}><Icon name="send" size={18} />{busy ? 'Sending…' : 'Send feedback'}</button>
    </form>
    <p class="label foot">Need help with a problem right now? See <a href="/help">Help & support</a>.</p>
  {/if}
</div>

<style>
  .page {
    max-width: 680px;
    margin: 8px auto 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  header h1 {
    margin: 0;
    font-size: clamp(28px, 3.4vw, 40px);
  }
  header p {
    margin: 6px 0 0;
  }
  .form {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  legend,
  .field .title {
    font-size: 16px;
    margin-bottom: 10px;
  }
  .faces {
    display: flex;
    gap: 10px;
  }
  .faces button {
    width: 58px;
    height: 58px;
    border-radius: 16px;
    border: 2px solid var(--border);
    background: var(--raised);
    font-size: 30px;
    cursor: pointer;
    filter: grayscale(0.7);
    transition: transform 0.12s ease;
  }
  .faces button:hover {
    transform: translateY(-2px);
  }
  .faces button.on {
    border-color: var(--accent);
    filter: none;
    background: color-mix(in srgb, var(--accent) 16%, var(--raised));
    transform: scale(1.08);
  }
  .kinds {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .kind {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }
  .kind[aria-pressed='true'] {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--raised));
  }
  .field {
    display: flex;
    flex-direction: column;
  }
  select,
  textarea {
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 10px 12px;
    font: inherit;
  }
  textarea {
    resize: vertical;
  }
  .count {
    align-self: flex-end;
    margin-top: 4px;
    font-size: 12px;
  }
  .trap {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }
  .check input {
    width: 18px;
    height: 18px;
  }
  .btn.big {
    gap: 8px;
    align-self: flex-start;
  }
  .error {
    margin: 0;
    color: var(--loss);
  }
  .foot {
    text-align: center;
  }
  .done {
    padding: 32px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }
  .done .big {
    font-size: 54px;
  }
  .done h1 {
    margin: 0;
  }
  .done p {
    margin: 0;
    color: var(--text-2);
  }
  .btns {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  @media (max-width: 480px) {
    .kinds {
      grid-template-columns: minmax(0, 1fr);
    }
    .faces button {
      width: 50px;
      height: 50px;
      font-size: 26px;
    }
  }
</style>

<script lang="ts">
  /** A conversation with a friend (friends only); new messages arrive every few seconds while it is open. */
  import TitleBadge from '$lib/components/TitleBadge.svelte';
  import { onDestroy, tick } from 'svelte';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import { session, startSignIn } from '$lib/auth';
  import { getPlayer, initialsOf, messagesWith, playerPhoto, refreshBadge, sendMessage, type Message, type Player } from '$lib/social';
  import { poll as keepAsking } from '$lib/poll';

  const uid = decodeURIComponent(page.params.uid!);
  let friend = $state<Player | undefined>();
  let msgs = $state<Message[]>([]);
  let text = $state('');
  let error = $state('');
  let sending = $state(false);
  let box: HTMLDivElement | undefined = $state();
  let stopPolling: (() => void) | undefined;
  /** The error shown came from loading messages (it clears once they load again). */
  let loadFailed = false;

  async function poll() {
    try {
      const after = msgs.length ? msgs[msgs.length - 1].id : 0;
      const more = await messagesWith(uid, after);
      if (more.length) {
        msgs = [...msgs, ...more];
        await tick();
        box?.scrollTo({ top: box.scrollHeight });
        void refreshBadge();
      }
      if (loadFailed) (error = ''), (loadFailed = false);
      return true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Messages could not be loaded.';
      loadFailed = true;
      return false;
    }
  }

  $effect(() => {
    if ($session.status !== 'in') return;
    getPlayer(uid).then(
      (r) => {
        friend = r.player;
        if (r.relation !== 'friends') error = 'You can message friends only.';
        // Now, then every 6 seconds while the chat is in front (slower after failures).
        else stopPolling = keepAsking(poll, 6000);
      },
      () => (error = 'This player could not be loaded.'),
    );
    return () => stopPolling?.();
  });
  onDestroy(() => stopPolling?.());

  async function send(e: Event) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    sending = true;
    try {
      await sendMessage(uid, body);
      text = '';
      await poll();
    } catch (err) {
      error = err instanceof Error ? err.message : "The message couldn't be sent.";
    } finally {
      sending = false;
    }
  }

  const time = (at: number) => new Date(at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const photo = $derived(friend ? playerPhoto(friend) : undefined);
</script>

<svelte:head><title>{friend?.name ?? 'Messages'} · Chess Castles</title></svelte:head>

<div class="page">
  <a class="back" href="/friends"><Icon name="back" size={16} />Friends</a>
  {#if $session.status === 'out'}
    <div class="card pad"><p>Sign in to message your friends.</p><button class="btn primary" onclick={() => startSignIn()}>Sign in</button></div>
  {:else}
    <section class="card chat">
      <header class="top">
        <span class="av">{#if photo}<img src={photo} alt="" />{:else}{friend ? initialsOf(friend.name) : ''}{/if}</span>
        <div class="who">
          <a class="title" href="/players/{encodeURIComponent(uid)}"><TitleBadge title={friend?.title} size={12} />{friend?.name ?? '…'}</a>
          <span class="label">{friend?.online ? 'Online now' : friend ? `@${friend.username}` : ''}</span>
        </div>
        {#if friend}<a class="btn" href="/play?mode=online&friend={encodeURIComponent(friend.username)}"><Icon name="knight" size={16} />Challenge</a>{/if}
      </header>
      <div class="msgs" bind:this={box} aria-live="polite">
        {#if error}
          <p class="label center">{error}</p>
        {:else if !msgs.length}
          <p class="label center">No messages yet. Say hello, or challenge {friend?.name ?? 'your friend'} to a game!</p>
        {/if}
        {#each msgs as m (m.id)}
          {@const join = /https:\/\/chesscastles\.com(\/play\/join\/\w+\?c=(?:white|black))/.exec(m.body)}
          <div class="msg" class:mine={m.mine}>
            {#if join}
              <p>{m.body.replace(/\s*Join: \S+$/, '')}</p>
              {#if !m.mine}<a class="btn primary join" href={join[1]}><Icon name="knight" size={16} />Join the game</a>{/if}
            {:else}
              <p>{m.body}</p>
            {/if}
            <span class="label">{time(m.at)}</span>
          </div>
        {/each}
      </div>
      <form class="compose" onsubmit={send}>
        <textarea id="chat-text" bind:value={text} maxlength="500" rows="2" placeholder="Write a message" disabled={!!error} onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && send(e)}></textarea>
        <button class="btn primary" type="submit" disabled={sending || !text.trim() || !!error}><Icon name="send" size={18} />Send</button>
      </form>
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .pad {
    padding: 18px;
  }
  .chat {
    display: flex;
    flex-direction: column;
    height: min(78vh, 760px);
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }
  .av {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex: none;
    display: grid;
    place-items: center;
    background: #5a3a1c;
    color: #eef3ff;
    font-weight: 700;
  }
  .av img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  .who {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .who a {
    color: var(--text);
  }
  .msgs {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .center {
    text-align: center;
    margin: auto 0;
  }
  .msg {
    max-width: 78%;
    align-self: flex-start;
    padding: 8px 12px;
    border-radius: 14px 14px 14px 4px;
    background: var(--raised);
  }
  .msg.mine {
    align-self: flex-end;
    border-radius: 14px 14px 4px 14px;
    background: color-mix(in srgb, var(--brand) 40%, var(--raised));
  }
  .msg .join {
    margin-top: 8px;
  }
  .msg p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg .label {
    font-size: 11px;
  }
  .compose {
    display: flex;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--border);
  }
  .compose textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    font: inherit;
    padding: 8px 10px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--raised);
    color: inherit;
  }
</style>

<script lang="ts">
  /** The sign-in chooser: Google (quickest for parents) or Lichess (needed for online games). Opened by startSignIn(). */
  import { signInOpen, signInWithGoogle, startLichessSignIn } from '$lib/auth';
  import { track } from '$lib/analytics';
  import Icon from './Icon.svelte';

  let busy = $state<'google' | 'lichess' | undefined>();
  let error = $state('');
  const close = () => {
    if (busy) return;
    signInOpen.set(false);
    error = '';
  };
  async function google() {
    busy = 'google';
    error = '';
    try {
      await signInWithGoogle();
      track('feature', 'signin_google');
      signInOpen.set(false);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Google sign-in did not work. Please try again.';
    } finally {
      busy = undefined;
    }
  }
  function lichess() {
    busy = 'lichess';
    track('feature', 'signin_lichess');
    void startLichessSignIn();
  }
</script>

<svelte:window onkeydown={(e) => $signInOpen && e.key === 'Escape' && close()} />

{#if $signInOpen}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="signin-h">
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <img class="crest logo-dark" src="/brand/chesscastles-crest-dark.svg" alt="" width="52" height="58" />
    <img class="crest logo-light" src="/brand/chesscastles-crest-light.svg" alt="" width="52" height="58" />
    <h2 id="signin-h" class="title">Sign in to Chess Castles</h2>
    <p class="label">Free. Keep your games, ratings and progress on every device.</p>

    <button class="opt google" onclick={google} disabled={!!busy}>
      <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      <span>{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</span>
    </button>
    <button class="opt lichess" onclick={lichess} disabled={!!busy}>
      <Icon name="knight" size={22} />
      <span>{busy === 'lichess' ? 'Opening Lichess…' : 'Continue with Lichess'}</span>
    </button>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <p class="label fine">
      Google is quickest for parents. Lichess is needed to play real opponents online, and you can connect it later. By signing in you agree to the
      <a href="/legal/terms" onclick={close}>terms</a> and <a href="/legal/privacy" onclick={close}>privacy policy</a>.
    </p>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 10, 20, 0.6);
    z-index: 95;
  }
  .dialog {
    position: fixed;
    z-index: 96;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(400px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 26px 22px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .x {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  h2 {
    margin: 0;
    font-size: 21px;
  }
  .dialog > p {
    margin: 0;
  }
  .opt {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 14px;
    font: inherit;
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
  }
  .opt:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .google {
    background: #fff;
    color: #1f1f1f;
    border: 1px solid #dadce0;
  }
  .lichess {
    background: var(--raised);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .error {
    color: var(--loss);
    font-size: 14px;
  }
  .fine {
    font-size: 12.5px;
    line-height: 1.45;
  }
</style>

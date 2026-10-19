<script lang="ts">
  /**
   * The sign-in chooser: Google (quickest, recommended for parents) or Lichess (recommended for players,
   * and needed to play real opponents online). Opened by startSignIn(). Nobody signs in before agreeing to
   * the terms and privacy policy (and saying whether they are an adult): the choice is saved in this
   * browser and sent to the account after sign-in.
   */
  import { signInOpen, signInWithGoogle, startLichessSignIn } from '$lib/auth';
  import { track } from '$lib/analytics';
  import { hasConsent, readConsent, saveConsent, type AgeGroup } from '$lib/consent';
  import { formatDate } from '$lib/format';
  import { t } from '$lib/i18n';
  import ConsentForm from './ConsentForm.svelte';
  import Icon from './Icon.svelte';

  let busy = $state<'google' | 'lichess' | undefined>();
  let error = $state('');
  let age = $state<AgeGroup | undefined>();
  let agreed = $state(false);
  let showErrors = $state(false);
  /** This browser already agreed to the current terms: the form is not asked again. */
  let known = $state(false);
  const agreedOn = $derived(readConsent()?.at);

  $effect(() => {
    if (!$signInOpen) return;
    known = hasConsent();
    age = undefined;
    agreed = false;
    showErrors = false;
    error = '';
  });

  const close = () => {
    if (busy) return;
    signInOpen.set(false);
    error = '';
  };
  /** True when the player may go on: they agreed before, or they agree now. */
  function consented(): boolean {
    if (known) return true;
    if (!age || !agreed) {
      showErrors = true;
      return false;
    }
    saveConsent(age);
    track('feature', `consent_${age}`);
    return true;
  }
  async function google() {
    if (!consented()) return;
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
    if (!consented()) return;
    busy = 'lichess';
    track('feature', 'signin_lichess');
    void startLichessSignIn();
  }
</script>

<svelte:window onkeydown={(e) => $signInOpen && e.key === 'Escape' && close()} />

{#if $signInOpen}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="signin-h">
    <button class="x" onclick={close} aria-label={$t('si.close')}><Icon name="close" size={18} /></button>
    <img class="crest logo-dark" src="/brand/chesscastles-crest-dark.svg" alt="" width="52" height="58" />
    <img class="crest logo-light" src="/brand/chesscastles-crest-light.svg" alt="" width="52" height="58" />
    <h2 id="signin-h" class="title">{$t('si.title')}</h2>
    <p class="label">{$t('si.sub')}</p>

    {#if known}
      <p class="agreed">{$t('si.agreed1')}<a href="/legal/terms" onclick={close}>{$t('si.terms')}</a>{$t('si.and')}<a href="/legal/privacy" onclick={close}>{$t('si.privacy')}</a>{agreedOn ? $t('si.end.on', { date: formatDate(agreedOn) }) : $t('si.end')}</p>
    {:else}
      <ConsentForm bind:age bind:agreed {showErrors} />
    {/if}

    <button class="opt google" onclick={google} disabled={!!busy}>
      <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      <span class="opt-text">
        <span class="opt-main">{busy === 'google' ? $t('si.opening.g') : $t('si.google')}</span>
        <span class="opt-sub">{$t('si.google.s')}</span>
        <span class="rec">{$t('si.rec.parents')}</span>
      </span>
    </button>
    <button class="opt lichess" onclick={lichess} disabled={!!busy}>
      <Icon name="knight" size={22} />
      <span class="opt-text">
        <span class="opt-main">{busy === 'lichess' ? $t('si.opening.l') : $t('si.lichess')}</span>
        <span class="opt-sub">{$t('si.lichess.s')}</span>
        <span class="rec">{$t('si.rec.players')}</span>
      </span>
    </button>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <p class="label fine">{$t('si.notsure')}</p>
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
    width: min(440px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 24px 20px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
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
  /* One crest: the one for the theme. */
  .crest.logo-light {
    display: none;
  }
  :global(:root[data-theme='light']) .crest.logo-light {
    display: block;
  }
  :global(:root[data-theme='light']) .crest.logo-dark {
    display: none;
  }
  h2 {
    margin: 0;
    font-size: 21px;
  }
  .dialog > p {
    margin: 0;
  }
  .agreed {
    width: 100%;
    padding: 8px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--win) 12%, var(--card));
    font-size: 13px;
    text-align: left;
  }
  .agreed a {
    color: var(--accent);
    text-decoration: underline;
  }
  /* Nothing in the box may shrink or overlap: the box scrolls instead. */
  .dialog > :global(*) {
    flex-shrink: 0;
  }
  .opt {
    width: 100%;
    min-height: 64px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 14px;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .opt:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .opt svg {
    flex: none;
  }
  .opt-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .opt-main {
    font-weight: 700;
    font-size: 16px;
  }
  .opt-sub {
    font-size: 12.5px;
    opacity: 0.75;
    line-height: 1.3;
  }
  .rec {
    align-self: flex-start;
    margin-top: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold) 22%, transparent);
    border: 1px solid var(--gold);
    color: inherit;
    font-size: 10.5px;
    font-weight: 800;
    line-height: 1.2;
  }
  .google {
    background: #fff;
    color: #1f1f1f;
    border: 1px solid #dadce0;
  }
  .google .rec {
    background: #fff4d6;
    color: #6b4a07;
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

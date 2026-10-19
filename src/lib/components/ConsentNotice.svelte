<script lang="ts">
  /** Players who signed in before the consent form existed agree once, here (shown over any page except the legal pages themselves). */
  import { page } from '$app/state';
  import { session, signOut } from '$lib/auth';
  import { consentNeeded, saveConsent, type AgeGroup } from '$lib/consent';
  import { t } from '$lib/i18n';
  import ConsentForm from './ConsentForm.svelte';

  let age = $state<AgeGroup | undefined>();
  let agreed = $state(false);
  let showErrors = $state(false);
  const open = $derived($consentNeeded && $session.status === 'in' && !page.url.pathname.startsWith('/legal'));

  function go() {
    if (!age || !agreed) {
      showErrors = true;
      return;
    }
    saveConsent(age);
    consentNeeded.set(false);
  }
</script>

{#if open}
  <div class="scrim" role="presentation"></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="consent-h">
    <img class="crest" src="/brand/chesscastles-crest-dark.svg" alt="" width="46" height="52" />
    <h2 id="consent-h" class="title">{$t('cn.title')}</h2>
    <p class="label">{$t('cn.sub')}</p>
    <ConsentForm bind:age bind:agreed {showErrors} />
    <button class="btn primary big" onclick={go}>{$t('cn.go')}</button>
    <button class="link" onclick={() => signOut()}>{$t('cn.no')}</button>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 10, 20, 0.7);
    z-index: 97;
  }
  .dialog {
    position: fixed;
    z-index: 98;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(440px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 22px 20px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  h2,
  p {
    margin: 0;
  }
  .big {
    width: 100%;
  }
  .link {
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }
</style>

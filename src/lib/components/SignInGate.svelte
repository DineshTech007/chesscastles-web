<script lang="ts">
  /**
   * The sign-in wall's page (src/lib/gate.ts): shown instead of any page that needs an account (owner, 2026-10-24).
   * The sign-in box opens by itself once; the card stays behind it with a button for anyone who closed it.
   */
  import { onMount } from 'svelte';
  import { startSignIn } from '$lib/auth';
  import { t } from '$lib/i18n';

  onMount(() => startSignIn());
</script>

<section class="gate card" data-testid="signin-gate">
  <img class="crest logo-dark" src="/brand/chesscastles-crest-dark.svg" alt="" width="64" height="72" />
  <img class="crest logo-light" src="/brand/chesscastles-crest-light.svg" alt="" width="64" height="72" />
  <h1>{$t('gate.title')}</h1>
  <p class="sub">{$t('gate.sub')}</p>
  <ul>
    <li>{$t('gate.b1')}</li>
    <li>{$t('gate.b2')}</li>
    <li>{$t('gate.b3')}</li>
  </ul>
  <button class="btn primary big" onclick={() => startSignIn()}>{$t('gate.btn')}</button>
  <p class="note">{$t('gate.note')}</p>
  <a class="back" href="/">{$t('gate.back')}</a>
</section>

<style>
  .gate {
    max-width: 460px;
    margin: 24px auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  .sub {
    margin: 0;
    color: var(--text-dim, inherit);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
  }
  li::before {
    content: '✓ ';
    color: var(--accent, #f0b429);
    font-weight: 700;
  }
  .btn.big {
    min-width: 200px;
    min-height: 48px;
  }
  .note {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.8;
  }
  .back {
    font-size: 0.9rem;
  }
  .logo-light {
    display: none;
  }
  :global(:root[data-theme='light']) .logo-dark {
    display: none;
  }
  :global(:root[data-theme='light']) .logo-light {
    display: block;
  }
</style>

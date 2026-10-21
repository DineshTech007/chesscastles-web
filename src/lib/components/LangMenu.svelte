<script lang="ts">
  /**
   * The language choice, beside the profile picture: English (default), हिन्दी or मराठी. It changes the whole
   * site, the Chess Guide and the Blog, and is remembered in this browser.
   */
  import { LANGS } from '$lib/coach/i18n';
  import { contentLang, setContentLang } from '$lib/contentLang';
  import { track } from '$lib/analytics';
  import { t } from '$lib/i18n';
  import Icon from './Icon.svelte';

  let open = $state(false);
  const SHORT = { en: 'EN', hi: 'हिं', mr: 'मरा' } as const;
  function pick(id: 'en' | 'hi' | 'mr') {
    setContentLang(id);
    track('feature', `lang_${id}`);
    open = false;
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} onclick={(e) => open && !(e.target as HTMLElement).closest?.('.lm') && (open = false)} />

<div class="lm">
  <button class="lm-btn" aria-haspopup="menu" aria-expanded={open} aria-label="{SHORT[$contentLang]} · {$t('lang.menu')}" title={$t('lang.menu')} onclick={() => (open = !open)}>
    <Icon name="globe" size={18} /><span class="code">{SHORT[$contentLang]}</span>
  </button>
  {#if open}
    <div class="menu card" role="menu" aria-label={$t('lang.menu')}>
      {#each LANGS as l (l.id)}
        <button role="menuitemradio" aria-checked={$contentLang === l.id} lang={l.id} onclick={() => pick(l.id)}>
          <span>{l.name}</span>{#if $contentLang === l.id}<Icon name="check" size={16} color="var(--accent)" />{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .lm {
    position: relative;
  }
  .lm-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 44px;
    padding: 0 10px;
    border-radius: var(--r-control);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font: inherit;
    font-weight: 800;
    font-size: 13.5px;
    cursor: pointer;
  }
  .lm-btn:hover {
    border-color: var(--brand);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 80;
    min-width: 150px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
  }
  .menu button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--text);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover,
  .menu button[aria-checked='true'] {
    background: var(--raised);
  }
  @media (max-width: 480px) {
    .lm-btn {
      height: 40px;
      padding: 0 8px;
    }
  }
</style>

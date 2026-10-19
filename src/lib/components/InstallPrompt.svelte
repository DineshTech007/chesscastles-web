<script lang="ts">
  /**
   * "Get the Chess Castles app": offered once each time someone opens the
   * site (not inside the installed app, and never in the middle of a game),
   * and from the menu any time. One tap where the browser can install, the
   * steps on an iPhone or in an Android browser's menu.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { initInstall, installNow, installOpen, installQuiet, installWay, snoozeInstall } from '$lib/install';
  import { track } from '$lib/analytics';
  import Icon from './Icon.svelte';

  /** Pages where a popup would get in the way: games, puzzles, analysis, watching a game. */
  const BUSY = /^\/(play\/.|analysis|puzzles|vision|watch\/.|learn\/.|coach)/;
  const KEY = 'cc.installAsked';
  let ready = $state(false);
  let installed = $state(false);

  onMount(() => {
    const force = page.url.searchParams.get('install') === 'show';
    initInstall();
    // Automated checks of the site (and their taps) get no popup, unless asked for.
    if (navigator.webdriver && !force) return;
    if (force) {
      installOpen.set(true);
      return;
    }
    const t = setTimeout(() => (ready = true), 4000);
    return () => clearTimeout(t);
  });

  // Once a visit, on a page that isn't busy, when this browser can install.
  $effect(() => {
    if (!ready || BUSY.test(page.url.pathname) || $installWay === 'none' || $installWay === 'installed' || installQuiet()) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      return;
    }
    installOpen.set(true);
    track('feature', 'install_offer');
  });

  /** Closing it (any way) keeps the popup from opening by itself again for a while; an install keeps it away for good. */
  const close = () => {
    if ($installOpen && !installed) snoozeInstall($installWay === 'prompt' ? 14 : 90);
    installOpen.set(false);
    installed = false;
  };
  async function install() {
    track('feature', 'install_tap');
    if (await installNow()) {
      track('feature', 'install_done');
      snoozeInstall(365);
      installed = true;
    } else close();
  }
</script>

<svelte:window onkeydown={(e) => $installOpen && e.key === 'Escape' && close()} />

{#if $installOpen}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="install-h">
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <img class="icon" src="/icon-192.png" alt="" width="64" height="64" />
    {#if installed || $installWay === 'installed'}
      <h2 id="install-h" class="title">Installed!</h2>
      <p class="label">Open Chess Castles from your home screen or app list. It updates itself: you always get the newest version.</p>
      <button class="btn primary wide" onclick={close}>Great</button>
    {:else}
      <h2 id="install-h" class="title">Get the Chess Castles app</h2>
      <p class="label">Free, and no app store needed.</p>
      <p class="label">Already on your phone? Just open it from your home screen. No need to install it again.</p>
      <ul class="why">
        <li><Icon name="phone" size={18} color="var(--accent)" /><span>Opens from your home screen, full screen, like any app</span></li>
        <li><Icon name="sparkle" size={18} color="var(--accent)" /><span>Always up to date: new features reach it the moment we add them</span></li>
        <li><Icon name="download" size={18} color="var(--accent)" /><span>Installs in seconds and takes almost no space</span></li>
      </ul>
      {#if $installWay === 'prompt'}
        <button class="btn primary wide" onclick={install}><Icon name="download" size={18} />Install the app</button>
        <button class="btn ghost wide" onclick={close}>Not now</button>
      {:else if $installWay === 'ios'}
        <ol class="steps">
          <li><span class="n">1</span><span>Tap <strong>Share</strong> <span class="glyph"><Icon name="share" size={16} /></span> in Safari's bar</span></li>
          <li><span class="n">2</span><span>Choose <strong>Add to Home Screen</strong></span></li>
          <li><span class="n">3</span><span>Tap <strong>Add</strong></span></li>
        </ol>
        <button class="btn primary wide" onclick={close}>Got it</button>
      {:else if $installWay === 'none'}
        <ol class="steps">
          <li><span class="n">1</span><span>Open chesscastles.com in <strong>Chrome</strong> or <strong>Edge</strong></span></li>
          <li><span class="n">2</span><span>Click <strong>Install</strong> <span class="glyph"><Icon name="download" size={16} /></span> at the right of the address bar</span></li>
        </ol>
        <button class="btn primary wide" onclick={close}>Got it</button>
      {:else}
        <ol class="steps">
          <li><span class="n">1</span><span>Tap the browser's menu <span class="glyph"><Icon name="dots" size={16} /></span> at the top right</span></li>
          <li><span class="n">2</span><span>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></span></li>
        </ol>
        <button class="btn primary wide" onclick={close}>Got it</button>
      {/if}
    {/if}
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
  /* A phone: a sheet from the bottom, within thumb reach. */
  @media (max-width: 599px) {
    .dialog {
      top: auto;
      bottom: 0;
      transform: translateX(-50%);
      width: 100vw;
      max-height: 90vh;
      border-radius: 20px 20px 0 0;
      padding-bottom: calc(20px + env(safe-area-inset-bottom));
    }
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
  .icon {
    border-radius: 16px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }
  h2 {
    margin: 0;
    font-size: 21px;
  }
  .dialog > p {
    margin: 0;
  }
  .why,
  .steps {
    list-style: none;
    margin: 2px 0 4px;
    padding: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: left;
  }
  .why li,
  .steps li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14.5px;
    line-height: 1.35;
  }
  .why li :global(svg) {
    flex: none;
  }
  .steps {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--raised);
    border: 1px solid var(--border);
  }
  .n {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: #0b1426;
    font-weight: 800;
    font-size: 13px;
  }
  .glyph {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid var(--border);
    vertical-align: middle;
  }
  .wide {
    width: 100%;
    min-height: 48px;
    justify-content: center;
  }
</style>

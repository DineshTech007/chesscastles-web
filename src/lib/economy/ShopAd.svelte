<script lang="ts">
  /**
   * The Castle Shop ad, once (owner, 2026-10-23: "show this ad once, when a new user logs in the first time"): a
   * player whose Treasury was made in the last two days sees it on Home, a few seconds after the first popups (language,
   * reminders, the consent form) are done, and never again on that account. Not during a game, a puzzle or a class.
   */
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { session } from '$lib/auth';
  import { busyPage } from '$lib/busy';
  import { wallet, walletMode } from './wallet';
  import { track } from '$lib/analytics';
  import Icon from '$lib/components/Icon.svelte';

  const NEW_MS = 2 * 86_400_000;
  const key = (uid: string) => `cc.shopAd.${uid}`;
  let show = $state(false);
  let tries = 0;

  const seen = (uid: string) => {
    try {
      return localStorage.getItem(key(uid)) !== null;
    } catch {
      return true;
    }
  };
  const markSeen = (uid: string) => {
    try {
      localStorage.setItem(key(uid), String(Date.now()));
    } catch {
      /* blocked: it may show again */
    }
  };

  // A new player (their Treasury is new), on Home, not seen it yet: a moment after other popups are done.
  onMount(() => {
    const timer = setInterval(() => {
      const s = $session;
      if (show || s.status !== 'in' || $walletMode === 'loading' || ++tries > 40) return;
      if (page.url.pathname !== '/' || busyPage(page.url.pathname) || seen(s.uid)) return;
      if (Date.now() - $wallet.created > NEW_MS) return;
      // Another popup is open (language, reminders, consent): wait.
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
      if (tries < 3) return;
      show = true;
      markSeen(s.uid);
      track('feature', 'shop_ad_seen');
    }, 3000);
    return () => clearInterval(timer);
  });
  const close = () => (show = false);
</script>

<svelte:window onkeydown={(e) => show && e.key === 'Escape' && close()} />

{#if show}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div class="ad" role="dialog" aria-modal="true" aria-label="The Castle Shop">
    <button class="x" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    <a href="/shop" onclick={() => (track('feature', 'shop_ad_open'), close())}>
      <img src="/art/shop-ad.webp" srcset="/art/shop-ad-640.webp 640w, /art/shop-ad.webp 1024w" sizes="(max-width: 560px) 92vw, 520px" width="1024" height="1024" alt="Play, learn, unlock: earn gold and gems for every game, puzzle and lesson. Visit the Castle Shop." />
    </a>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 960;
    background: rgba(4, 8, 18, 0.72);
  }
  .ad {
    position: fixed;
    z-index: 961;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, 92vw, calc(100vh - 40px));
    border-radius: 22px;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    border: 2px solid var(--gold);
    background: #0f1733;
  }
  .ad img {
    display: block;
    width: 100%;
    height: auto;
  }
  .x {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: rgba(8, 14, 30, 0.7);
    color: #fff;
    cursor: pointer;
  }
</style>

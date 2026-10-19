/**
 * Installing Chess Castles as an app from the browser (no app store): on
 * Android and on a computer (Chrome, Edge, Samsung Internet) the browser's
 * own install, one tap; on an iPhone or iPad, Share → Add to Home Screen.
 * The installed app opens this site full screen, so it always runs the
 * latest version: every deploy reaches it at once.
 */
import { writable } from 'svelte/store';

/** How this browser installs: its own prompt, the steps on an iPhone, the steps in an Android browser's menu, not at all, or it is the app already. */
export type InstallWay = 'prompt' | 'ios' | 'android' | 'none' | 'installed';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | undefined;
export const installWay = writable<InstallWay>('none');
/** The install popup is open. */
export const installOpen = writable(false);

/** Opened as the installed app (from the home screen). */
export const isInstalledApp = () =>
  typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

let started = false;
export function initInstall(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (isInstalledApp()) return installWay.set('installed');
  // The browser's offer can come before the site has loaded: app.html keeps it.
  const early = (window as Window & { __bip?: InstallEvent }).__bip;
  if (early) {
    deferred = early;
    installWay.set('prompt');
  }
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    installWay.set('prompt');
  });
  addEventListener('appinstalled', () => {
    deferred = undefined;
    installWay.set('installed');
  });
  if (!deferred) installWay.set(byHand());
}

/** Without the browser's offer: the steps for an iPhone or an Android browser's menu (a computer has none to show). */
function byHand(): InstallWay {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/.test(ua) ? 'android' : 'none';
}

/** The browser's install dialog; true when the player installed. */
export async function installNow(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  // The offer can be used once.
  deferred = undefined;
  installWay.set(outcome === 'accepted' ? 'installed' : byHand());
  return outcome === 'accepted';
}

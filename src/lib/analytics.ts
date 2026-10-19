/**
 * Anonymous usage counts, for the admin dashboard: pages viewed, features
 * used, limits reached, and where visitors come from. A random visitor id
 * is kept in this browser (no cookies, nothing about who you are); events
 * are sent in small batches to the API worker (src/analytics.ts), the last
 * ones when the tab is hidden. Browsers asking not to be tracked (Do Not
 * Track) send nothing, nor automated browsers (the site check and other
 * bots), and nothing is sent while developing locally.
 */
import { API } from '$lib/api';

type Metric = 'view' | 'feature' | 'limit' | 'interest';
const queue: [Metric, string][] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let signedIn = false;
/** The first batch goes quickly (short visits count too), later ones every few seconds. */
let sentOnce = false;

const off = () =>
  typeof window === 'undefined' || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || navigator.doNotTrack === '1' || navigator.webdriver || (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

function visitor(): { vid: string; fresh: boolean } {
  try {
    let vid = localStorage.getItem('cc.vid');
    const day = new Date().toISOString().slice(0, 10);
    if (!vid) {
      vid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
      localStorage.setItem('cc.vid', vid);
      localStorage.setItem('cc.vidDay', day);
    }
    return { vid, fresh: localStorage.getItem('cc.vidDay') === day };
  } catch {
    // Storage blocked: one id for this page only.
    return { vid: 'tmp' + Math.random().toString(36).slice(2, 12), fresh: true };
  }
}

/** Counts one event (sent within a few seconds). */
export function track(metric: Metric, key: string) {
  if (off()) return;
  queue.push([metric, key.slice(0, 64)]);
  if (queue.length >= 40) flush();
  else if (!timer) timer = setTimeout(() => flush(), sentOnce ? 8000 : 1500);
}

/** A page view: the route ("/players/[uid]"), not the address, so no names are sent. */
export const pageView = (route: string) => track('view', route || '/');

export const setSignedIn = (v: boolean) => (signedIn = v);

/** Sends what is queued; `leaving`: the tab is closing (sent with sendBeacon). */
export function flush(leaving = false) {
  clearTimeout(timer);
  timer = undefined;
  if (off()) return;
  let visit: { ref: string; device: string; fresh: boolean; signedIn: boolean } | undefined;
  try {
    if (!sessionStorage.getItem('cc.session')) {
      sessionStorage.setItem('cc.session', '1');
      const ref = document.referrer ? new URL(document.referrer).hostname : '';
      const w = Math.min(screen.width, innerWidth);
      visit = { ref: ref && ref !== location.hostname ? ref.toLowerCase() : 'direct', device: w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop', fresh: visitor().fresh, signedIn };
    }
  } catch {
    /* storage blocked */
  }
  if (!queue.length && !visit) return;
  sentOnce = true;
  const body = JSON.stringify({ vid: visitor().vid, visit, ev: queue.splice(0, 60) });
  const url = `${API}/track`;
  try {
    if (leaving && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
    else void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
  } catch {
    /* offline: these counts are lost, that's fine */
  }
}

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
/** The first batch goes quickly (short visits count too), later ones every 30 seconds: every batch is database writes, and launch day is busy. */
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

// ---------- site health: errors, the browser, page-load speed ----------

export type ErrorKind = 'js' | 'promise' | 'api' | 'lichess' | 'chunk' | 'engine';
const errs: { k: ErrorKind; m: string; p: string }[] = [];
const sentErrors = new Set<string>();
let currentPage = '/';

/**
 * Reports an error to the admin dashboard (Site health): each message once per visit, at most 15 a visit,
 * without names or addresses (a route, not the page's address). Sent with the next batch.
 */
export function reportError(kind: ErrorKind, message: string) {
  if (off()) return;
  const m = String(message || '').replace(/https?:\/\/\S+/g, (u) => u.replace(/[?#].*$/, '')).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!m || sentErrors.size >= 15 || sentErrors.has(`${kind}:${m}`)) return;
  sentErrors.add(`${kind}:${m}`);
  errs.push({ k: kind, m, p: currentPage });
  if (!timer) timer = setTimeout(() => flush(), 1500);
}

function browserOf(): { browser: string; os: string } {
  const ua = navigator.userAgent;
  const browser = /SamsungBrowser/i.test(ua) ? 'samsung' : /Edg\//.test(ua) ? 'edge' : /OPR\//.test(ua) ? 'opera' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other';
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Windows/i.test(ua) ? 'windows' : /Mac OS X/i.test(ua) ? 'mac' : /Linux/i.test(ua) ? 'linux' : 'other';
  return { browser, os };
}

/** How long the first page took to load (ms), from the browser's navigation timing. */
function loadTime(): number | undefined {
  try {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const t = n ? n.domContentLoadedEventEnd || n.responseEnd : 0;
    return t > 0 ? Math.round(t) : undefined;
  } catch {
    return undefined;
  }
}

/** Counts one event (sent within a few seconds). */
export function track(metric: Metric, key: string) {
  if (off()) return;
  queue.push([metric, key.slice(0, 64)]);
  if (queue.length >= 40) flush();
  else if (!timer) timer = setTimeout(() => flush(), sentOnce ? 30_000 : 1500);
}

/** A page view: the route ("/players/[uid]"), not the address, so no names are sent. */
export const pageView = (route: string) => {
  currentPage = (route || '/').slice(0, 64);
  track('view', route || '/');
};

export const setSignedIn = (v: boolean) => (signedIn = v);

/** Sends what is queued; `leaving`: the tab is closing (sent with sendBeacon). */
export function flush(leaving = false) {
  clearTimeout(timer);
  timer = undefined;
  if (off()) return;
  let visit: { ref: string; device: string; fresh: boolean; signedIn: boolean; browser: string; os: string; load?: number } | undefined;
  try {
    if (!sessionStorage.getItem('cc.session')) {
      sessionStorage.setItem('cc.session', '1');
      const ref = document.referrer ? new URL(document.referrer).hostname : '';
      const w = Math.min(screen.width, innerWidth);
      visit = { ref: ref && ref !== location.hostname ? ref.toLowerCase() : 'direct', device: w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop', fresh: visitor().fresh, signedIn, ...browserOf(), load: loadTime() };
    }
  } catch {
    /* storage blocked */
  }
  if (!queue.length && !visit && !errs.length) return;
  sentOnce = true;
  const w = Math.min(screen.width, innerWidth);
  const body = JSON.stringify({
    vid: visitor().vid,
    visit,
    ev: queue.splice(0, 60),
    page: currentPage,
    ...(errs.length ? { err: errs.splice(0, 5), device: w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop', browser: browserOf().browser } : {}),
  });
  const url = `${API}/track`;
  try {
    if (leaving && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
    else void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
  } catch {
    /* offline: these counts are lost, that's fine */
  }
}

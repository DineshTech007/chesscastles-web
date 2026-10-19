import { writable } from 'svelte/store';

/**
 * Consent to the terms of use and privacy policy, asked before anyone signs in (Google or Lichess) and
 * once from people who were already signed in. Kept in this browser, and sent to the player's account
 * after sign-in so Chess Castles can show when and what they agreed to. Change CONSENT_VERSION when the
 * terms or the privacy policy change in a way people must agree to again.
 */
export const CONSENT_VERSION = '2026-10-20';

export type AgeGroup = 'adult' | 'minor';
export interface Consent {
  version: string;
  at: number;
  /** 'adult': 18 or older. 'minor': under 18, with a parent or guardian who has read and agrees. */
  age: AgeGroup;
}

const KEY = 'cc.consent';
const SYNCED = 'cc.consentSynced';

export function readConsent(): Consent | undefined {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return c && typeof c.version === 'string' && (c.age === 'adult' || c.age === 'minor') ? c : undefined;
  } catch {
    return undefined;
  }
}

/** Whether this browser has agreed to the current version. */
export const hasConsent = () => readConsent()?.version === CONSENT_VERSION;

export function saveConsent(age: AgeGroup): Consent {
  const c: Consent = { version: CONSENT_VERSION, at: Date.now(), age };
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* blocked: asked again next time */
  }
  return c;
}

/** Signed-in players from before this form: asked once, in a box over the page. */
export const consentNeeded = writable(false);

/** Whether the agreement was already sent to this account (so it is sent once). */
export const consentSynced = (uid: string) => {
  try {
    return localStorage.getItem(SYNCED) === `${uid}|${CONSENT_VERSION}`;
  } catch {
    return false;
  }
};
export const markConsentSynced = (uid: string) => {
  try {
    localStorage.setItem(SYNCED, `${uid}|${CONSENT_VERSION}`);
  } catch {
    /* sent again next time */
  }
};

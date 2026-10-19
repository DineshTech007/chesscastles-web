import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { writable } from 'svelte/store';
import { firebaseConfig } from './firebaseConfig';

/**
 * Two ways in, both ending in a Firebase account:
 * - Lichess (uid "lichess:<id>"): Lichess OAuth with PKCE (no password ever
 *   reaches Chess Castles), then the sign-in Worker swaps the Lichess token for
 *   a Firebase custom token (server/auth-worker). Needed for online play.
 * - Google (a Firebase uid): Firebase's Google sign-in in a popup, for parents
 *   and players without a Lichess account.
 * The profile at users/{uid} is created the way the app creates it.
 */

const LICHESS = 'https://lichess.org';
const CLIENT_ID = 'chesscastles';
const SCOPES = ['preference:read', 'challenge:read', 'challenge:write', 'board:play', 'tournament:write'];
const BRIDGE = 'https://auth.chesscastles.com/firebase-token';
const TOKEN_KEY = 'k24.lichess';
const PENDING_KEY = 'k24.oauth';
export const STARTING_RATING = 1500;

export const app = initializeApp(firebaseConfig);
// Without the popup helper: Google's sign-in script loads only when someone signs in with Google.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
export const db = getFirestore(app);

export interface Profile {
  uid: string;
  name: string;
  /** Their photo (base64 JPEG), set in the app or here. */
  photo?: string;
  ratings: { puzzle: number; blitz: number; rapid: number };
  puzzles: { attempted: number; solved: number; streak: number; best: number; themes: Record<string, number> };
  games: { played: number; won: number; drawn: number; lost: number };
}

export type Session =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; uid: string; username: string; profile?: Profile };

export const session = writable<Session>({ status: 'loading' });

/** The app's cleanName: trimmed, single spaces, 2–24 characters. */
export function cleanName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length < 2) return 'Player';
  return s.length > 24 ? s.slice(0, 24) : s;
}

/** A new player's document, exactly as the app writes it (see firestore.rules). */
export function newProfileDoc(name: string) {
  return {
    name: cleanName(name),
    avatar: 'knight',
    state: null,
    ratings: { puzzle: STARTING_RATING, blitz: STARTING_RATING, rapid: STARTING_RATING },
    puzzles: { attempted: 0, solved: 0, streak: 0, best: 0, themes: {} },
    games: { played: 0, won: 0, drawn: 0, lost: 0 },
  };
}

export function profileFrom(uid: string, m: Record<string, any>): Profile {
  const n = (o: any, k: string, f = 0) => (typeof o?.[k] === 'number' ? o[k] : f);
  return {
    uid,
    name: typeof m.name === 'string' ? m.name : 'Player',
    photo: typeof m.photo === 'string' && m.photo ? m.photo : undefined,
    ratings: {
      puzzle: n(m.ratings, 'puzzle', STARTING_RATING),
      blitz: n(m.ratings, 'blitz', STARTING_RATING),
      rapid: n(m.ratings, 'rapid', STARTING_RATING),
    },
    puzzles: { attempted: n(m.puzzles, 'attempted'), solved: n(m.puzzles, 'solved'), streak: n(m.puzzles, 'streak'), best: n(m.puzzles, 'best'), themes: m.puzzles?.themes && typeof m.puzzles.themes === 'object' ? m.puzzles.themes : {} },
    games: { played: n(m.games, 'played'), won: n(m.games, 'won'), drawn: n(m.games, 'drawn'), lost: n(m.games, 'lost') },
  };
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const redirectUri = () => `${location.origin}/auth/callback`;

/** Opens the sign-in chooser (Google or Lichess); SignInModal.svelte shows it. */
export const signInOpen = writable(false);
export function startSignIn(): void {
  signInOpen.set(true);
}

/** Signs in with Google (a popup). Throws a readable message if it fails. */
export async function signInWithGoogle(): Promise<void> {
  const { GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    // A Lichess login left in this browser belongs to another account.
    localStorage.removeItem(TOKEN_KEY);
    await ensureProfile(cred.user.uid, cred.user.displayName ?? cred.user.email?.split('@')[0] ?? 'Player');
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw new Error('');
    if (code === 'auth/popup-blocked') throw new Error('Your browser blocked the sign-in window. Allow pop-ups for chesscastles.com and try again.');
    throw new Error('Google sign-in did not work. Please try again.');
  }
}

/** Whether this account signed in with Lichess (online play needs it). */
export const isLichessAccount = (uid: string) => uid.startsWith('lichess:');

/**
 * Sends the player to Lichess to sign in. `connect`: a Google account adds its
 * Lichess login for online play (it stays the same Chess Castles account).
 */
export async function startLichessSignIn(connect = false): Promise<void> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, back: location.pathname + location.search, connect }));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES.join(' '),
    state,
  });
  location.assign(`${LICHESS}/oauth?${q}`);
}

/** Finishes sign-in on /auth/callback; returns where to go next. */
export async function finishSignIn(params: URLSearchParams): Promise<string> {
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
  sessionStorage.removeItem(PENDING_KEY);
  if (params.get('error')) throw new Error('Sign-in was cancelled on Lichess.');
  const code = params.get('code');
  if (!pending || !code || params.get('state') !== pending.state) {
    throw new Error('This sign-in link has expired. Please try again.');
  }
  const tokenRes = await fetch(`${LICHESS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: pending.verifier,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
    }),
  });
  if (!tokenRes.ok) throw new Error('Lichess did not accept the sign-in. Please try again.');
  const { access_token } = await tokenRes.json();
  const back = pending.back && pending.back !== '/auth/callback' ? pending.back : '/';

  // A Google account connecting Lichess for online play: keep the Lichess login only.
  if (pending.connect && auth.currentUser && !isLichessAccount(auth.currentUser.uid)) {
    const who = await fetch(`${LICHESS}/api/account`, { headers: { Authorization: `Bearer ${access_token}` } }).then((r) => (r.ok ? r.json() : undefined));
    if (!who?.username) throw new Error('Lichess did not accept the sign-in. Please try again.');
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: access_token, username: who.username }));
    return back;
  }

  const bridge = await fetch(BRIDGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lichessToken: access_token }),
  });
  const body = await bridge.json().catch(() => ({}));
  if (!bridge.ok) throw new Error(body.error ?? 'Chess Castles sign-in is unavailable right now.');

  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: access_token, username: body.username }));
  const cred = await signInWithCustomToken(auth, body.firebaseToken);
  await ensureProfile(cred.user.uid, body.username);
  return back;
}

async function ensureProfile(uid: string, username: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...newProfileDoc(username), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

/** The Lichess token for online play, if signed in. */
export function lichessToken(): { token: string; username: string } | undefined {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
}

/** Signs out of both, and revokes the Lichess token. */
export async function signOut(): Promise<void> {
  try {
    localStorage.removeItem('k24.accountPhoto');
  } catch {
    /* private mode */
  }
  const t = lichessToken();
  localStorage.removeItem(TOKEN_KEY);
  if (t) {
    fetch(`${LICHESS}/api/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${t.token}` } }).catch(() => {});
  }
  await fbSignOut(auth);
}

/** Keeps `session` in step with Firebase and loads the profile. */
export function watchSession(): () => void {
  return onAuthStateChanged(auth, async (user) => {
    // A hint for the first screen in app.html (shown before the app loads).
    try {
      if (user) localStorage.setItem('k24.in', '1');
      else localStorage.removeItem('k24.in');
    } catch {
      /* storage blocked */
    }
    if (!user) {
      session.set({ status: 'out' });
      return;
    }
    const username = isLichessAccount(user.uid)
      ? (lichessToken()?.username ?? user.uid.replace(/^lichess:/, ''))
      : (user.displayName ?? user.email?.split('@')[0] ?? 'Player');
    session.set({ status: 'in', uid: user.uid, username });
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) session.set({ status: 'in', uid: user.uid, username, profile: profileFrom(user.uid, snap.data()) });
    } catch {
      /* offline: keep the session without the profile */
    }
  });
}

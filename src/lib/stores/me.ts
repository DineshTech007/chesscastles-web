import { derived, get, writable } from 'svelte/store';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import { db, session } from '$lib/auth';
import { computeKfideAll } from '$lib/kfide';
import { myGames, type SavedGame } from './myGames';

const LEGACY = 'k24.kfideOwner';
/**
 * The account that owns the games saved before games were marked with their
 * account: the first one to sign in on this browser.
 */
function legacyOwner(uid: string | undefined): string | undefined {
  try {
    let o = localStorage.getItem(LEGACY) ?? undefined;
    if (!o && uid) localStorage.setItem(LEGACY, (o = uid));
    return o;
  } catch {
    return undefined;
  }
}

/**
 * The player's three CC Ratings (Standard, Rapid, Blitz), from their
 * FIDE-bot games kept in this browser: only the signed-in account's games,
 * so someone else signing in on the same browser starts their own CC Rating.
 */
export const kfideAll = derived([myGames, session], ([list, s]) => {
  const uid = s.status === 'in' ? s.uid : undefined;
  const legacy = s.status === 'loading' ? undefined : legacyOwner(uid);
  return computeKfideAll(list.filter((g) => ownedBy(g, uid, legacy)));
});

/** Whether a game kept in this browser is this account's (or, signed out, an unmarked one). */
const ownedBy = (g: SavedGame, uid: string | undefined, legacy: string | undefined) => (g.owner ? g.owner === uid : !uid || legacy === uid);
/** The games in this browser that belong to `uid`. */
export const gamesOf = (list: SavedGame[], uid: string) => list.filter((g) => ownedBy(g, uid, legacyOwner(uid)));

/** The games this browser shows in My games: the signed-in account's, or (signed out) the unmarked ones. */
export const shownGames = derived([myGames, session], ([list, s]) => {
  if (s.status === 'loading') return list.filter((g) => !g.owner);
  const uid = s.status === 'in' ? s.uid : undefined;
  return list.filter((g) => ownedBy(g, uid, legacyOwner(uid)));
});
/** The headline CC Rating: the speed the player plays most. */
export const kfide = derived(kfideAll, (a) => ({ ...a[a.main], speed: a.main }));

const COUNTRY = 'k24.country';

/** ISO country (from the browser's language, e.g. "en-IN") to FIDE federation code, for common ones. */
const ISO_TO_FIDE: Record<string, string> = {
  IN: 'IND', US: 'USA', GB: 'ENG', CA: 'CAN', AU: 'AUS', NZ: 'NZL', DE: 'GER', FR: 'FRA', ES: 'ESP', IT: 'ITA', NL: 'NED',
  RU: 'RUS', UA: 'UKR', PL: 'POL', CN: 'CHN', JP: 'JPN', AE: 'UAE', SA: 'KSA', SG: 'SGP', MY: 'MAS', ID: 'INA', PH: 'PHI',
  BD: 'BAN', PK: 'PAK', LK: 'SRI', NP: 'NEP', ZA: 'RSA', NG: 'NGR', KE: 'KEN', BR: 'BRA', AR: 'ARG', MX: 'MEX', IE: 'IRL',
  SE: 'SWE', NO: 'NOR', DK: 'DEN', FI: 'FIN', CH: 'SUI', AT: 'AUT', BE: 'BEL', PT: 'POR', GR: 'GRE', TR: 'TUR', IR: 'IRI',
  IL: 'ISR', EG: 'EGY', KZ: 'KAZ', UZ: 'UZB', AM: 'ARM', AZ: 'AZE', GE: 'GEO', HU: 'HUN', CZ: 'CZE', RO: 'ROU', BG: 'BUL',
  RS: 'SRB', HR: 'CRO', VN: 'VIE', TH: 'THA', KR: 'KOR', QA: 'QAT', OM: 'OMA', KW: 'KUW', BH: 'BRN',
};

/**
 * A first guess at the player's country, until they pick one on their
 * profile: India for an Indian time zone, else the browser language's region.
 */
export function guessCountry(): string {
  if (typeof Intl === 'undefined' || typeof navigator === 'undefined') return '';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IND';
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = /-([A-Z]{2})\b/.exec(lang ?? '')?.[1];
    if (region && ISO_TO_FIDE[region]) return ISO_TO_FIDE[region];
  }
  return '';
}

/** The player's country (FIDE code, e.g. "IND"), for the flag next to their name. */
export const myCountry = writable<string>(typeof localStorage === 'undefined' ? '' : (localStorage.getItem(COUNTRY) || guessCountry()));
export function setMyCountry(code: string) {
  myCountry.set(code);
  try {
    localStorage.setItem(COUNTRY, code);
  } catch {
    /* private mode */
  }
}

const LOCAL_PHOTO = 'k24.photo';
const localPhoto = writable<string | undefined>(
  typeof localStorage === 'undefined' ? undefined : (localStorage.getItem(LOCAL_PHOTO) ?? undefined),
);

/** The signed-in account's photo, kept on this device so it shows at once while the account loads. */
const ACCOUNT_PHOTO = 'k24.accountPhoto';
function cachedPhoto(): { uid: string; photo: string } | undefined {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_PHOTO) ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The player's photo (base64 JPEG, as the app stores it): from their account
 * when signed in (shown from this device's copy while the account loads),
 * else from this browser.
 */
export const myPhoto = derived([session, localPhoto], ([s, local]) => {
  const cached = typeof localStorage === 'undefined' ? undefined : cachedPhoto();
  if (s.status === 'loading') return cached?.photo ?? local;
  if (s.status !== 'in') return local;
  const photo = s.profile?.photo ?? (cached?.uid === s.uid ? cached.photo : undefined) ?? local;
  if (s.profile?.photo && (cached?.uid !== s.uid || cached.photo !== s.profile.photo)) {
    try {
      localStorage.setItem(ACCOUNT_PHOTO, JSON.stringify({ uid: s.uid, photo: s.profile.photo }));
    } catch {
      /* storage full */
    }
  }
  return photo;
});

/** The photo as an image address. */
export const photoSrc = (b64: string) => `data:image/jpeg;base64,${b64}`;

/**
 * Shrinks a picked picture the way the app does (a centred square, about
 * 256 px, under 45 KB) and returns it as base64; undefined if it can't be read.
 */
export async function shrinkPhoto(file: Blob): Promise<string | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return undefined;
  }
  const side = Math.min(bitmap.width, bitmap.height);
  for (const [size, quality] of [[256, 0.72], [192, 0.6], [160, 0.5]] as const) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(size, side);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    if (b64 && b64.length * 0.75 <= 45000) return b64;
  }
  return undefined;
}

/** Saves (or with undefined removes) the photo: in the account when signed in (shared with the app), else in this browser. */
export async function savePhoto(b64: string | undefined): Promise<void> {
  const s = get(session);
  if (s.status === 'in' && s.profile) {
    await updateDoc(doc(db, 'users', s.uid), { photo: b64 ?? null, updatedAt: serverTimestamp() });
    try {
      if (b64) localStorage.setItem(ACCOUNT_PHOTO, JSON.stringify({ uid: s.uid, photo: b64 }));
      else localStorage.removeItem(ACCOUNT_PHOTO);
    } catch {
      /* storage full */
    }
    session.set({ ...s, profile: { ...s.profile, photo: b64 } });
    return;
  }
  try {
    if (b64) localStorage.setItem(LOCAL_PHOTO, b64);
    else localStorage.removeItem(LOCAL_PHOTO);
  } catch {
    /* private browsing: this visit only */
  }
  localPhoto.set(b64);
}

/**
 * Your display name on Chess Castles (set on your profile), shown everywhere
 * instead of the Lichess username. Kept in this browser so it shows at once.
 */
const NAME = 'cc.displayName';
const savedName = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(NAME) ?? '{}');
  } catch {
    return {};
  }
};
const displayNames = writable<Record<string, string>>(typeof localStorage === 'undefined' ? {} : savedName());
export function setMyName(uid: string, name: string) {
  if (!name) return;
  displayNames.update((m) => {
    const next = { ...m, [uid]: name };
    try {
      localStorage.setItem(NAME, JSON.stringify(next));
    } catch {
      /* storage full or blocked */
    }
    return next;
  });
}
/** Your name as others see it ('' when signed out). */
export const myName = derived([session, displayNames], ([s, names]) => (s.status === 'in' ? names[s.uid] || s.profile?.name || s.username : ''));
/** Two letters for the avatar. */
export const myInitials = derived(myName, (n) => n.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || n.slice(0, 2).toUpperCase());

/** The FIDE ID on your profile (your own photo shows on your FIDE pages instead of none). */
export const myFideId = writable('');

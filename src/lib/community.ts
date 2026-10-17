import { collection, getDocs, query, where, type Timestamp } from 'firebase/firestore/lite';
import { API } from '$lib/api';
import { db } from '$lib/auth';

/**
 * The Community page's data: FIDE-rated tournaments in India (FIDE and
 * AICF, through the Chess Castles API worker), plus the tournaments organisers
 * list and the coaches' profiles in Chess Castles (from the app; public once an
 * admin approves them).
 */

export type Speed = 'classical' | 'rapid' | 'blitz';

export interface IndianEvent {
  id: string;
  name: string;
  city: string;
  start: string;
  end?: string;
  state?: string;
  brochure?: string;
  national?: string;
  onFide: boolean;
  speed: Speed;
}

export async function indianEvents(): Promise<IndianEvent[]> {
  const res = await fetch(`${API}/events/india`);
  if (!res.ok) throw new Error("FIDE's tournament list couldn't be loaded.");
  return res.json();
}

/** A tournament an organiser listed on Chess Castles. */
export interface LocalEvent {
  id: string;
  title: string;
  organizer: string;
  phone: string;
  whatsapp: boolean;
  email?: string;
  city: string;
  state: string;
  venue: string;
  start: string;
  end: string;
  registerBy?: string;
  speed: Speed;
  fideRated: boolean;
  categories: string[];
  entryFee?: string;
  prizes?: string;
  description?: string;
  link?: string;
}

export interface Coach {
  id: string;
  name: string;
  title?: string;
  fideId?: string;
  fideRating?: number;
  /** Base64 JPEG. */
  photo?: string;
  city: string;
  state: string;
  area?: string;
  pincode?: string;
  modes: ('online' | 'home' | 'academy')[];
  levels: ('beginner' | 'intermediate' | 'advanced' | 'tournament')[];
  languages: string[];
  experience: number;
  fee?: string;
  about: string;
  achievements?: string;
  phone: string;
  whatsapp: boolean;
  email?: string;
  link?: string;
}

const day = (t: unknown) => {
  const d = (t as Timestamp | undefined)?.toDate?.();
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
};
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Approved organiser listings that have not ended yet, soonest first. */
export async function localEvents(today: string): Promise<LocalEvent[]> {
  const snap = await getDocs(query(collection(db, 'events'), where('status', '==', 'approved')));
  return snap.docs
    .map((d) => {
      const m = d.data();
      return {
        id: d.id,
        title: str(m.title) ?? 'Tournament',
        organizer: str(m.organizer) ?? '',
        phone: str(m.phone) ?? '',
        whatsapp: m.whatsapp === true,
        email: str(m.email),
        city: str(m.city) ?? '',
        state: str(m.state) ?? '',
        venue: str(m.venue) ?? '',
        start: day(m.start),
        end: day(m.end),
        registerBy: day(m.registerBy) || undefined,
        speed: (['classical', 'rapid', 'blitz'].includes(m.speed) ? m.speed : 'classical') as Speed,
        fideRated: m.fideRated === true,
        categories: list(m.categories),
        entryFee: str(m.entryFee),
        prizes: str(m.prizes),
        description: str(m.description),
        link: str(m.link),
      };
    })
    .filter((e) => e.start && (e.end || e.start) >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Approved coaches. */
export async function coaches(): Promise<Coach[]> {
  const snap = await getDocs(query(collection(db, 'coaches'), where('status', '==', 'approved')));
  return snap.docs.map((d) => {
    const m = d.data();
    return {
      id: d.id,
      name: str(m.name) ?? 'Coach',
      title: str(m.title),
      fideId: str(m.fideId),
      fideRating: typeof m.fideRating === 'number' ? m.fideRating : undefined,
      photo: str(m.photo),
      city: str(m.city) ?? '',
      state: str(m.state) ?? '',
      area: str(m.area),
      pincode: str(m.pincode),
      modes: list(m.modes) as Coach['modes'],
      levels: list(m.levels) as Coach['levels'],
      languages: list(m.languages),
      experience: typeof m.experience === 'number' ? m.experience : 0,
      fee: str(m.fee),
      about: str(m.about) ?? '',
      achievements: str(m.achievements),
      phone: str(m.phone) ?? '',
      whatsapp: m.whatsapp === true,
      email: str(m.email),
      link: str(m.link),
    };
  });
}

/** "+91…" for a 10-digit Indian number. */
export function phoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

/** "17–19 Oct 2026", "30 Oct – 2 Nov 2026". */
export function dateRange(start: string, end?: string): string {
  const d = (s: string) => new Date(`${s}T12:00:00`);
  const a = d(start);
  const b = end && end !== start ? d(end) : undefined;
  const fmt = (x: Date, o: Intl.DateTimeFormatOptions) => x.toLocaleDateString('en-IN', o);
  if (!b) return fmt(a, { day: 'numeric', month: 'short', year: 'numeric' });
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()}–${fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export const COACH_LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Assamese', 'Urdu', 'Konkani'];

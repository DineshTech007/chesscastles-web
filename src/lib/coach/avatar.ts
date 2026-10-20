import { writable } from 'svelte/store';
import { loadCoach, updateCoach } from './progress';

/**
 * Who Guru looks like, and how Guru sounds: three coaches (a senior grandmaster, and a younger coach of each
 * gender) and four characters for young children, all as portraits made for Chess Castles. Each has a voice:
 * a man's or a woman's (see voice.ts, which picks a matching voice on the device, or deepens one when the
 * device has no man's voice), its pitch and pace.
 */
export type AvatarId = 'guruji' | 'rohan' | 'meera' | 'hoot' | 'gaja' | 'robo' | 'knight';

export interface AvatarInfo {
  id: AvatarId;
  name: string;
  about: string;
  /** The portrait. */
  image: string;
  /** For young children (shown as a group in the chooser). */
  kids?: boolean;
  voice: 'male' | 'female';
  /** Speech pitch and rate (1 = the voice's own). */
  pitch: number;
  rate: number;
}

export const AVATARS: AvatarInfo[] = [
  { id: 'guruji', name: 'Guruji', about: 'A senior grandmaster coach: calm, wise and patient', image: '/coach/guruji.webp', voice: 'male', pitch: 0.92, rate: 0.9 },
  { id: 'rohan', name: 'Coach Rohan', about: 'A young titled coach: clear and energetic', image: '/coach/rohan.webp', voice: 'male', pitch: 0.98, rate: 0.98 },
  { id: 'meera', name: 'Coach Meera', about: 'A patient coach who explains every idea step by step', image: '/coach/meera.webp', voice: 'female', pitch: 1, rate: 0.95 },
  { id: 'hoot', name: 'Professor Hoot', about: 'A wise owl professor for young players', image: '/coach/hoot.webp', kids: true, voice: 'female', pitch: 1.12, rate: 0.95 },
  { id: 'gaja', name: 'Gaja', about: 'A gentle elephant from chaturanga, the first chess', image: '/coach/gaja.webp', kids: true, voice: 'male', pitch: 1.02, rate: 0.92 },
  { id: 'robo', name: 'Robo', about: 'A friendly chess robot', image: '/coach/robo.webp', kids: true, voice: 'male', pitch: 1.1, rate: 1 },
  { id: 'knight', name: 'Knight Guru', about: 'The Chess Castles knight, the first Guru', image: '/coach/knight.webp', kids: true, voice: 'male', pitch: 1, rate: 0.95 },
];

/** Looks that were replaced: the closest new one. */
const RENAMED: Record<string, AvatarId> = { wizard: 'guruji', owl: 'hoot', teacher: 'rohan', 'teacher-woman': 'meera' };

const initial = (): AvatarId => {
  if (typeof localStorage === 'undefined') return 'guruji';
  const a = loadCoach().avatar ?? '';
  return AVATARS.some((x) => x.id === a) ? (a as AvatarId) : (RENAMED[a] ?? 'guruji');
};

export const avatarInfo = (id: AvatarId) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];

/** The chosen look, kept with the coach settings in this browser. */
export const coachAvatar = writable<AvatarId>(initial());

export function chooseAvatar(id: AvatarId) {
  coachAvatar.set(id);
  // A new coach speaks in their own voice: voices picked for the last coach are set aside.
  updateCoach({ avatar: id, voices: {} });
}

import { writable } from 'svelte/store';
import { loadCoach, updateCoach } from './progress';

/** Who Guru looks like: four characters drawn for Chess Castles, four 3D cartoons, and the original knight. */
export type AvatarId = 'hoot' | 'guruji' | 'robo' | 'gaja' | 'wizard' | 'owl' | 'teacher' | 'teacher-woman' | 'knight';

export interface AvatarInfo {
  id: AvatarId;
  name: string;
  about: string;
  /** For the 3D cartoons: the picture (their mouths do not move). */
  image?: string;
}

export const AVATARS: AvatarInfo[] = [
  { id: 'guruji', name: 'Guruji', about: 'A kind Indian chess teacher with a white beard' },
  { id: 'hoot', name: 'Professor Hoot', about: 'A wise owl in a graduation cap' },
  { id: 'robo', name: 'Robo', about: 'A friendly chess robot' },
  { id: 'gaja', name: 'Gaja', about: 'A wise elephant, the bishop of chaturanga' },
  { id: 'wizard', name: 'The Wizard', about: 'A wise old wizard (3D)', image: '/coach/wizard.png' },
  { id: 'owl', name: 'Owl Master', about: 'A big-eyed owl (3D)', image: '/coach/owl.png' },
  { id: 'teacher', name: 'Teacher Sir', about: 'A friendly teacher (3D)', image: '/coach/teacher.png' },
  { id: 'teacher-woman', name: "Teacher Ma'am", about: 'A friendly teacher (3D)', image: '/coach/teacher-woman.png' },
  { id: 'knight', name: 'Knight Guru', about: 'The first Guru: a knight with glasses' },
];

const initial = (): AvatarId => {
  if (typeof localStorage === 'undefined') return 'guruji';
  const a = loadCoach().avatar;
  return AVATARS.some((x) => x.id === a) ? (a as AvatarId) : 'guruji';
};

/** The chosen look, kept with the coach settings in this browser. */
export const coachAvatar = writable<AvatarId>(initial());

export function chooseAvatar(id: AvatarId) {
  coachAvatar.set(id);
  updateCoach({ avatar: id });
}

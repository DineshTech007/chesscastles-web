/** Coach tools (the Elite plan): a coach's students and the work set for them (server/api-worker/src/students.ts). */
import { call, type Player } from '$lib/social';

export type WorkKind = 'puzzles' | 'opening' | 'lesson' | 'note';
export interface Assignment {
  id: number;
  coach: string;
  student: string;
  kind: WorkKind;
  /** A link inside Chess Castles ("/puzzles/themes?theme=fork") or empty. */
  ref: string;
  title: string;
  note: string;
  created: number;
  done: number;
}
export interface Student extends Player {
  since: number;
  seen: number;
  games: { week: number; total: number; last: number };
  work: { open: number; done: number };
}

export const myStudents = () => call<{ students: Student[]; assignments: Assignment[] }>('GET', 'students');
export const removeStudent = (uid: string) => call<{ ok: true }>('POST', 'students', { action: 'remove', uid });
export const myCoaches = () => call<{ coaches: (Player & { since: number })[]; assignments: Assignment[] }>('GET', 'coaches');
export const joinCoach = (coach: string) => call<{ ok: true; coach: Player }>('POST', 'coaches', { action: 'join', coach });
export const leaveCoach = (coach: string) => call<{ ok: true }>('POST', 'coaches', { action: 'leave', coach });
export const setWork = (w: { student: string; kind: WorkKind; ref: string; title: string; note: string }) => call<{ id: number }>('POST', 'assignments', w);
export const markDone = (id: number, done = true) => call<{ ok: true }>('POST', `assignments/${id}`, { done });
export const deleteWork = (id: number) => call<{ ok: true }>('DELETE', `assignments/${id}`);

/** The link a coach shares; students open it to join. */
export const coachLink = (uid: string) => `https://chesscastles.com/students/join/${encodeURIComponent(uid)}`;

/** Ready-made work a coach can pick (titles and links into Chess Castles). */
export const WORK_PRESETS: { kind: WorkKind; title: string; ref: string }[] = [
  { kind: 'puzzles', title: '10 fork puzzles', ref: '/puzzles/themes?theme=fork&n=10' },
  { kind: 'puzzles', title: '10 pin puzzles', ref: '/puzzles/themes?theme=pin&n=10' },
  { kind: 'puzzles', title: '10 mate-in-2 puzzles', ref: '/puzzles/themes?theme=mateIn2&n=10' },
  { kind: 'puzzles', title: '10 endgame puzzles', ref: '/puzzles/themes?theme=endgame&n=10' },
  { kind: 'lesson', title: 'A Vision Gym blindfold session', ref: '/vision/blind' },
  { kind: 'lesson', title: 'Play 3 games against a FIDE-rated opponent', ref: '/play' },
  { kind: 'lesson', title: 'Review your last game with Guru', ref: '/games' },
  { kind: 'opening', title: 'Practise your opening in the trainer', ref: '/learn' },
];

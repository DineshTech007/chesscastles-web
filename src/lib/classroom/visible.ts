/**
 * Whether the menus show Classroom: always to admins (they make the classes); to a student only when an admin has
 * opened the Classroom and the student is in a class (owner, 2026-10-22: not shown to players during the beta, only
 * for a coach's demo). Asked once per sign-in and remembered on the device for ten minutes.
 */
import { writable } from 'svelte/store';
import { adminMe } from '$lib/admin';
import { classroomAccess } from './api';

export const classroomShown = writable(false);
const KEY = 'cc.classroom';
let asked = '';

export function checkClassroom(uid: string | undefined) {
  if (!uid) {
    asked = '';
    classroomShown.set(false);
    return;
  }
  if (asked === uid) return;
  asked = uid;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved?.uid === uid && Date.now() - saved.at < 600_000) return classroomShown.set(!!saved.show);
  } catch {
    /* private mode */
  }
  void decide(uid).then((show) => {
    classroomShown.set(show);
    try {
      localStorage.setItem(KEY, JSON.stringify({ uid, show, at: Date.now() }));
    } catch {
      /* private mode */
    }
  });
}

async function decide(uid: string): Promise<boolean> {
  void uid;
  const admin = await adminMe().then(
    () => true,
    () => false,
  );
  if (admin) return true;
  try {
    const r = await classroomAccess();
    return !r.closed && r.classes.length > 0;
  } catch {
    return false;
  }
}

/** After the switch changes or a class is joined: ask again next time. */
export function forgetClassroom() {
  asked = '';
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

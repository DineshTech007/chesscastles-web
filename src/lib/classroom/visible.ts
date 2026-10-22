/**
 * Whether the menus show CastleClass: to admins and coaches always; to a player only once a coach has enrolled them in
 * a class (owner, 2026-10-22: off by default). Asked once per sign-in; a yes is remembered on the device for
 * ten minutes, a no for two (a student just added sees it soon).
 */
import { writable } from 'svelte/store';
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
    if (saved?.uid === uid && Date.now() - saved.at < (saved.show ? 600_000 : 120_000)) return classroomShown.set(!!saved.show);
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
  try {
    const r = await classroomAccess();
    return !!r.admin || !!r.coach?.active || r.classes.length > 0;
  } catch {
    return false;
  }
}


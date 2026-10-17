import { BASIC_LESSONS } from './content/basics';
import { ENDGAME_LESSONS } from './content/endgames';
import { libraryCourse, OPENING_LESSONS } from './content/openings';
import { TACTIC_LESSONS } from './content/tactics';
import type { Lesson, LessonEntry } from './types';

/** Every lesson in the Coach section, in catalogue order. */
export const CATALOG: LessonEntry[] = [...BASIC_LESSONS, ...OPENING_LESSONS, ...TACTIC_LESSONS, ...ENDGAME_LESSONS];

export const entryById = (id: string) => CATALOG.find((l) => l.id === id);

/** Loads a lesson's slides: a catalogue lesson, or "lib-N" for any opening in the library. */
export async function loadLesson(id: string): Promise<Lesson | undefined> {
  if (/^lib-\d+$/.test(id)) return libraryCourse(Number(id.slice(4)));
  return entryById(id)?.load();
}
